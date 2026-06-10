const fs = require('fs');
const path = require('path');

const MAX_PASSWORD_ENTRIES = 500;
const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const PERSONAL_SPACE_ID = 'personal';

function safeSpaceId(value) {
  const normalized = String(value || PERSONAL_SPACE_ID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 41);
  return normalized || PERSONAL_SPACE_ID;
}

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
    spaceId: safeSpaceId(credential.spaceId),
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
      const key = `${credential.spaceId}\n${credential.origin}\n${credential.username.toLowerCase()}`;
      const existing = deduped.get(key);
      if (!existing || String(credential.updatedAt) >= String(existing.updatedAt)) {
        deduped.set(key, credential);
      }
    });

  return {
    version: 3,
    neverSaveOrigins: Array.isArray(store && store.neverSaveOrigins)
      ? Array.from(new Map(store.neverSaveOrigins
        .map((entry) => {
          const origin = originForUrl(typeof entry === 'string' ? entry : entry && entry.origin);
          const spaceId = safeSpaceId(entry && typeof entry === 'object' ? entry.spaceId : PERSONAL_SPACE_ID);
          return origin ? [`${spaceId}\n${origin}`, { origin, spaceId }] : null;
        })
        .filter(Boolean)).values())
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
    spaceId: credential.spaceId,
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
      if (!fs.existsSync(filePath)) return { version: 3, neverSaveOrigins: [], credentials: [] };

      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const normalized = normalizeStore(parsed, now());
      writeStore(normalized);
      return normalized;
    } catch (error) {
      backupCorruptStore(error);
      writeStore({ version: 3, neverSaveOrigins: [], credentials: [] });
      return { version: 3, neverSaveOrigins: [], credentials: [] };
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

  function listLogins(spaceId) {
    const store = readStore();
    const normalizedSpaceId = spaceId ? safeSpaceId(spaceId) : '';
    return {
      available: isEncryptionAvailable(),
      recovery: recoveryInfo ? { ...recoveryInfo } : null,
      logins: store.credentials
        .filter((credential) => !normalizedSpaceId || credential.spaceId === normalizedSpaceId)
        .map(safeListCredential),
      neverSaveOrigins: clone(store.neverSaveOrigins)
    };
  }

  function findLoginsForUrl(url, spaceId = PERSONAL_SPACE_ID) {
    const origin = originForUrl(url);
    if (!origin || !isEncryptionAvailable()) return { available: isEncryptionAvailable(), logins: [] };
    const normalizedSpaceId = safeSpaceId(spaceId);

    return {
      available: true,
      logins: readStore().credentials
        .filter((credential) => credential.origin === origin && credential.spaceId === normalizedSpaceId)
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

  function classifyLogin({ url, username, password, spaceId = PERSONAL_SPACE_ID }) {
    if (!webUrl(url) || !isEncryptionAvailable()) {
      return { action: 'unavailable', available: isEncryptionAvailable() };
    }

    const origin = originForUrl(url);
    const normalizedSpaceId = safeSpaceId(spaceId);
    if (readStore().neverSaveOrigins.some((entry) => entry.origin === origin && entry.spaceId === normalizedSpaceId)) {
      return { action: 'never', available: true, origin };
    }
    const safeUsername = String(username || '').trim().slice(0, 320);
    const safePassword = String(password || '');
    if (!safeUsername || !safePassword) return { action: 'ignore', available: true };

    const existing = readStore().credentials.find((credential) => (
      credential.origin === origin &&
      credential.spaceId === normalizedSpaceId &&
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

  function saveLogin({ url, username, password, spaceId = PERSONAL_SPACE_ID }) {
    const normalizedSpaceId = safeSpaceId(spaceId);
    const classification = classifyLogin({ url, username, password, spaceId: normalizedSpaceId });
    if (classification.action === 'unavailable') return { ok: false, reason: 'encryption-unavailable' };
    if (classification.action === 'ignore') return { ok: false, reason: 'missing-credentials' };
    if (classification.action === 'unchanged') return { ok: true, action: 'unchanged', login: classification.login };

    const origin = originForUrl(url);
    const safeUsername = String(username || '').trim().slice(0, 320);
    const store = readStore();
    const existing = store.credentials.find((credential) => (
      credential.origin === origin &&
      credential.spaceId === normalizedSpaceId &&
      credential.username.toLowerCase() === safeUsername.toLowerCase()
    ));
    const savedAt = now();
    const nextCredential = {
      id: existing ? existing.id : createId(),
      origin,
      domain: domainForUrl(origin),
      spaceId: normalizedSpaceId,
      username: safeUsername,
      passwordEncrypted: encrypt(password),
      createdAt: existing ? existing.createdAt : savedAt,
      updatedAt: savedAt
    };
    const nextStore = writeStore({
      version: 3,
      neverSaveOrigins: store.neverSaveOrigins.filter((entry) => (
        entry.origin !== origin || entry.spaceId !== normalizedSpaceId
      )),
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
      version: 3,
      neverSaveOrigins: store.neverSaveOrigins,
      credentials: store.credentials.filter((credential) => credential.id !== id)
    });
    return listLogins();
  }

  function clearLogins(spaceId) {
    const store = readStore();
    const normalizedSpaceId = spaceId ? safeSpaceId(spaceId) : '';
    writeStore({
      version: 3,
      neverSaveOrigins: normalizedSpaceId
        ? store.neverSaveOrigins.filter((entry) => entry.spaceId !== normalizedSpaceId)
        : store.neverSaveOrigins,
      credentials: normalizedSpaceId
        ? store.credentials.filter((credential) => credential.spaceId !== normalizedSpaceId)
        : []
    });
    return listLogins();
  }

  function neverSaveForUrl(url, spaceId = PERSONAL_SPACE_ID) {
    const origin = originForUrl(url);
    if (!origin) return listLogins();
    const normalizedSpaceId = safeSpaceId(spaceId);

    const store = readStore();
    writeStore({
      version: 3,
      neverSaveOrigins: [
        { origin, spaceId: normalizedSpaceId },
        ...store.neverSaveOrigins.filter((entry) => (
          entry.origin !== origin || entry.spaceId !== normalizedSpaceId
        ))
      ],
      credentials: store.credentials.filter((credential) => (
        credential.origin !== origin || credential.spaceId !== normalizedSpaceId
      ))
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
