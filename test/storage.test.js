const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DEFAULT_STATE, createStorage } = require("../src/storage");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nyra-storage-"));
}

{
  const dir = tempDir();
  const storage = createStorage(dir);
  assert.deepEqual(storage.getState(), DEFAULT_STATE);
}

{
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "nyra-state.json"), "{ not valid json");
  const storage = createStorage(dir);
  assert.deepEqual(storage.getState(), DEFAULT_STATE);
}

{
  const dir = tempDir();
  const storage = createStorage(dir);

  storage.updateSettings({ httpsFirst: false, searchEngine: "unknown" });
  storage.saveSession({
    tabs: [
      { url: "https://example.com/", title: "Example" },
      { url: 42, title: "Invalid" },
    ],
  });

  const reloaded = createStorage(dir);
  assert.equal(reloaded.getSettings().httpsFirst, false);
  assert.equal(reloaded.getSettings().searchEngine, "duckduckgo");
  assert.deepEqual(reloaded.getSession().tabs, [
    { url: "https://example.com/", title: "Example" },
  ]);
}

console.log("storage: defaults, corrupted fallback, and persistence passed");
