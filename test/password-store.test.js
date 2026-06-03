const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPasswordStore, normalizeStore } = require('../src/password-store');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nyra-password-store-'));
}

function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (buffer) => {
      const value = Buffer.from(buffer).toString('utf8');
      return value.startsWith('enc:') ? value.slice(4) : '';
    }
  };
}

function createTestStore(available = true) {
  return createPasswordStore({
    userDataDir: tempDir(),
    safeStorage: fakeSafeStorage(available),
    now: () => '2026-05-31T10:00:00.000Z'
  });
}

{
  const encrypted = Buffer.from('enc:secret', 'utf8').toString('base64');
  const normalized = normalizeStore({
    credentials: [
      { origin: 'https://example.com/login', username: 'gab', passwordEncrypted: encrypted, updatedAt: '2026-01-01T00:00:00.000Z' },
      { origin: 'https://example.com', username: 'Gab', passwordEncrypted: encrypted, updatedAt: '2026-01-02T00:00:00.000Z' }
    ]
  });

  assert.equal(normalized.version, 2);
  assert.equal(normalized.credentials.length, 1);
  assert.equal(normalized.credentials[0].origin, 'https://example.com');
  assert.equal(normalized.credentials[0].username, 'Gab');
}

{
  const store = createTestStore();
  const first = store.saveLogin({ url: 'https://example.com/login', username: 'gab@example.com', password: 'one' });
  const second = store.saveLogin({ url: 'https://example.com/account', username: 'other@example.com', password: 'two' });

  assert.equal(first.action, 'saved');
  assert.equal(second.action, 'saved');
  assert.equal(store.findLoginsForUrl('https://example.com/login').logins.length, 2);
}

{
  const store = createTestStore();
  store.saveLogin({ url: 'https://example.com/login', username: 'gab@example.com', password: 'one' });
  store.neverSaveForUrl('https://blocked.example/login');

  assert.equal(
    store.classifyLogin({ url: 'https://example.com/login', username: 'gab@example.com', password: 'one' }).action,
    'unchanged'
  );
  assert.equal(
    store.classifyLogin({ url: 'https://example.com/login', username: 'gab@example.com', password: 'two' }).action,
    'update'
  );
  assert.equal(
    store.classifyLogin({ url: 'https://blocked.example/login', username: 'gab@example.com', password: 'one' }).action,
    'never'
  );
  assert.equal(
    store.classifyLogin({ url: 'https://example.com/login', username: 'new@example.com', password: 'two' }).action,
    'save'
  );

  const updated = store.saveLogin({ url: 'https://example.com/login', username: 'gab@example.com', password: 'two' });
  assert.equal(updated.action, 'updated');
  assert.equal(store.findLoginsForUrl('https://example.com/login').logins.length, 1);
  const secret = store.getLoginSecret(updated.login.id);
  assert.equal(secret.credential.password, 'two');
}

{
  const store = createTestStore();
  const saved = store.saveLogin({ url: 'https://example.com/login', username: 'gab@example.com', password: 'one' });
  assert.equal(store.listLogins().logins.length, 1);
  store.deleteLogin(saved.login.id);
  assert.equal(store.listLogins().logins.length, 0);
  store.saveLogin({ url: 'https://example.com/login', username: 'gab@example.com', password: 'one' });
  store.clearLogins();
  assert.equal(store.listLogins().logins.length, 0);
}

{
  const store = createTestStore(false);
  assert.equal(store.listLogins().available, false);
  assert.equal(store.classifyLogin({ url: 'https://example.com', username: 'gab', password: 'one' }).action, 'unavailable');
  assert.equal(store.saveLogin({ url: 'https://example.com', username: 'gab', password: 'one' }).ok, false);
}

{
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'passwords.json'), '{broken json');
  const store = createPasswordStore({
    userDataDir: dir,
    safeStorage: fakeSafeStorage(),
    now: () => '2026-05-31T10:00:00.000Z'
  });
  const list = store.listLogins();
  assert.equal(list.logins.length, 0);
  assert.equal(list.recovery.type, 'password-store-corrupt');
  assert.ok(fs.readdirSync(dir).some((name) => name.startsWith('passwords.corrupt.')));
}

console.log('password-store: migration, multi-account, update, delete, unavailable, and corrupt fallback passed');
