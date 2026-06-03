const fs = require('fs');
const path = require('path');

const MAX_PASSWORD_ENTRIES = 500;
const WEB_PROTOCOLS = new Set(['http:', 'https:']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createId() {
  return `login-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeDate(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function webUrl(value) {
  try {
    const parsed = new URL(value);
    return WEB_PROTOCOLS.has(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function originForUrl(value) {
  try {
    const parsed = new URL(value);
    return WEB_PROTOCOLS.has(parsed.protocol) ? parsed.origin : '';
  } catch {
    return '';
  }
}

function domainForUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizeCredential(credential, now) {
  if (!credential || typeof credential !== 'object') return null;

  const origin = typeof credential.origin === 'string' && originForUrl(credential.origin)
    ? originForUrl(credential.origin)
    : originForUrl(credential.url);
  const username = String(credential.username || '').trim().slice(0, 320);
  const passwordEncrypted = typeof credential.passwordEncrypted === 'string'
    ? credential.passwordEncrypted
    : '';

  if (!origin || !username || !passwordEncrypted) return null;

  return {
    id: typeof credential.id === 'string' && credential.id ? credential.id : createId(),
    origin,
    domain: typeof credential.domain === 'string' && credential.domain
      ? credential.domain.toLowerCase()
      : domainForUrl(origin),
    username,
    passwordEncrypted,
    createdAt: safeDate(credential.createdAt, now),
    updatedAt: safeDate(credential.updatedAt, safeDate(credential.createdAt, now))
  };
}

function normalizeStore(store, now = new Date().toISOString()) {
  const rawCredentials = Array.isArray(store && store.credentials)
    ? store.credentials
    : Array.isArray(store && store.logins)
      ? store.logins
      : [];
  const deduped = new Map();

  rawCredentials
    .map((credential) => normalizeCredential(credential, now))
    .filter(Boolean)
    .forEach((credential) => {
      const key = `${credential.origin}\n${credential.username.toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || String(credential.updatedAt) >= String(existing.updatedAt)) {
        deduped.set(key, credential);
      }
    });

  return {
    version: 2,
    neverSaveOrigins: Array.isArray(store && store.neverSaveOrigins)
      ? Array.from(new Set(store.neverSaveOrigins
        .map((origin) => originForUrl(origin))
        .filter(Boolean)))
      : [],
    credentials: Array.from(deduped.values())
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, MAX_PASSWORD_ENTRIES)
  };
}

function safeListCredential(credential) {
  return {
    id: credential.id,
    origin: credential.origin,
    domain: credential.domain,
    username: credential.username,
    createdAt: credential.createdAt,
    updatedAt: credential.updatedAt
  };
}

function createPasswordStore({ userDataDir, safeStorage, now = () => new Date().toISOString() }) {
  const filePath = path.join(userDataDir, 'passwords.json');
  let recoveryInfo = null;

  function isEncryptionAvailable() {
    return Boolean(safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable());
  }

  function backupCorruptStore(error) {
    recoveryInfo = {
      type: 'password-store-corrupt',
      error: error && error.message ? error.message : String(error)
    };

    try {
      if (!fs.existsSync(filePath)) return;
      const backupPath = path.join(
        path.dirname(filePath),
        `passwords.corrupt.${timestampForFilename()}.json`
      );
      fs.renameSync(filePath, backupPath);
      recoveryInfo.backupPath = backupPath;
    } catch (backupError) {
      recoveryInfo.backupError = backupError && backupError.message
        ? backupError.message
        : String(backupError);
    }
  }

  function readStore() {
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      if (!fs.existsSync(filePath)) return { version: 2, neverSaveOrigins: [], credentials: [] };

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const normalized = normalizeStore(parsed, now());
      writeStore(normalized);
      return normalized;
    } catch (error) {
      backupCorruptStore(error);
      writeStore({ version: 2, credentials: [] });
      return { version: 2, neverSaveOrigins: [], credentials: [] };
    }
  }

  function writeStore(store) {
    const normalized = normalizeStore(store, now());
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
    return clone(normalized);
  }

  function encrypt(password) {
    if (!isEncryptionAvailable()) return '';
    return safeStorage.encryptString(String(password)).toString('base64');
  }

  function decrypt(passwordEncrypted) {
    if (!isEncryptionAvailable()) return '';

    try {
      return safeStorage.decryptString(Buffer.from(String(passwordEncrypted || ''), 'base64'));
    } catch {
      return '';
    }
  }

  function listLogins() {
    const store = readStore();
    return {
      available: isEncryptionAvailable(),
      recovery: recoveryInfo ? { ...recoveryInfo } : null,
      logins: store.credentials.map(safeListCredential),
      neverSaveOrigins: clone(store.neverSaveOrigins)
    };
  }

  function findLoginsForUrl(url) {
    const origin = originForUrl(url);
    if (!origin || !isEncryptionAvailable()) return { available: isEncryptionAvailable(), logins: [] };

    return {
      available: true,
      logins: readStore().credentials
        .filter((credential) => credential.origin === origin)
        .map(safeListCredential)
    };
  }

  function getLoginSecret(id) {
    if (typeof id !== 'string' || !isEncryptionAvailable()) {
      return { ok: false, reason: 'encryption-unavailable' };
    }

    const credential = readStore().credentials.find((item) => item.id === id);
    if (!credential) return { ok: false, reason: 'not-found' };

    const password = decrypt(credential.passwordEncrypted);
    if (!password) return { ok: false, reason: 'decrypt-failed' };

    return {
      ok: true,
      credential: {
        ...safeListCredential(credential),
        password
      }
    };
  }

  function classifyLogin({ url, username, password }) {
    if (!webUrl(url) || !isEncryptionAvailable()) {
      return { action: 'unavailable', available: isEncryptionAvailable() };
    }

    const origin = originForUrl(url);
    if (readStore().neverSaveOrigins.includes(origin)) {
      return { action: 'never', available: true, origin };
    }
    const safeUsername = String(username || '').trim().slice(0, 320);
    const safePassword = String(password || '');
    if (!safeUsername || !safePassword) return { action: 'ignore', available: true };

    const existing = readStore().credentials.find((credential) => (
      credential.origin === origin &&
      credential.username.toLowerCase() === safeUsername.toLowerCase()
    ));
    if (!existing) {
      return { action: 'save', available: true, origin, domain: domainForUrl(origin), username: safeUsername };
    }

    const existingPassword = decrypt(existing.passwordEncrypted);
    if (existingPassword === safePassword) {
      return { action: 'unchanged', available: true, login: safeListCredential(existing) };
    }

    return { action: 'update', available: true, login: safeListCredential(existing) };
  }

  function saveLogin({ url, username, password }) {
    const classification = classifyLogin({ url, username, password });
    if (classification.action === 'unavailable') return { ok: false, reason: 'encryption-unavailable' };
    if (classification.action === 'ignore') return { ok: false, reason: 'missing-credentials' };
    if (classification.action === 'unchanged') return { ok: true, action: 'unchanged', login: classification.login };

    const origin = originForUrl(url);
    const safeUsername = String(username || '').trim().slice(0, 320);
    const store = readStore();
    const existing = store.credentials.find((credential) => (
      credential.origin === origin &&
      credential.username.toLowerCase() === safeUsername.toLowerCase()
    ));
    const savedAt = now();
    const nextCredential = {
      id: existing ? existing.id : createId(),
      origin,
      domain: domainForUrl(origin),
      username: safeUsername,
      passwordEncrypted: encrypt(password),
      createdAt: existing ? existing.createdAt : savedAt,
      updatedAt: savedAt
    };
    const nextStore = writeStore({
      version: 2,
      neverSaveOrigins: store.neverSaveOrigins.filter((originItem) => originItem !== origin),
      credentials: [
        nextCredential,
        ...store.credentials.filter((credential) => credential.id !== nextCredential.id)
      ]
    });

    return {
      ok: true,
      action: existing ? 'updated' : 'saved',
      login: safeListCredential(nextStore.credentials.find((credential) => credential.id === nextCredential.id))
    };
  }

  function deleteLogin(id) {
    if (typeof id !== 'string') return listLogins();

    const store = readStore();
    writeStore({
      version: 2,
      neverSaveOrigins: store.neverSaveOrigins,
      credentials: store.credentials.filter((credential) => credential.id !== id)
    });
    return listLogins();
  }

  function clearLogins() {
    const store = readStore();
    writeStore({ version: 2, neverSaveOrigins: store.neverSaveOrigins, credentials: [] });
    return listLogins();
  }

  function neverSaveForUrl(url) {
    const origin = originForUrl(url);
    if (!origin) return listLogins();

    const store = readStore();
    writeStore({
      version: 2,
      neverSaveOrigins: [origin, ...store.neverSaveOrigins.filter((item) => item !== origin)],
      credentials: store.credentials.filter((credential) => credential.origin !== origin)
    });
    return listLogins();
  }

  return {
    filePath,
    classifyLogin,
    clearLogins,
    deleteLogin,
    findLoginsForUrl,
    getLoginSecret,
    listLogins,
    neverSaveForUrl,
    readStore,
    saveLogin,
    writeStore
  };
}

module.exports = {
  createPasswordStore,
  domainForUrl,
  normalizeStore,
  originForUrl
};
