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

  storage.updateSettings({
    httpsFirst: false,
    searchEngine: "unknown",
    startupBehavior: "restore",
    newTabPage: "blank",
    theme: "light",
    accentColor: "blue",
    showSidebar: false,
    sidebarMode: "compact",
    compactLayout: true,
    newTabDensity: "compact",
    compactTabs: true,
    tabCloseButtonMode: "hover",
    defaultZoom: 1.2,
    askDownloadLocation: true,
    downloadPath: path.join(dir, "downloads"),
  });
  storage.saveSession({
    tabs: [
      { url: "https://example.com/", title: "Example" },
      { url: 42, title: "Invalid" },
    ],
  });

  const reloaded = createStorage(dir);
  assert.equal(reloaded.getSettings().httpsFirst, false);
  assert.equal(reloaded.getSettings().searchEngine, "duckduckgo");
  assert.equal(reloaded.getSettings().startupBehavior, "restore");
  assert.equal(reloaded.getSettings().restoreSession, true);
  assert.equal(reloaded.getSettings().newTabPage, "blank");
  assert.equal(reloaded.getSettings().theme, "light");
  assert.equal(reloaded.getSettings().accentColor, "blue");
  assert.equal(reloaded.getSettings().showSidebar, false);
  assert.equal(reloaded.getSettings().sidebarMode, "compact");
  assert.equal(reloaded.getSettings().compactLayout, true);
  assert.equal(reloaded.getSettings().newTabDensity, "compact");
  assert.equal(reloaded.getSettings().compactTabs, true);
  assert.equal(reloaded.getSettings().tabCloseButtonMode, "hover");
  assert.equal(reloaded.getSettings().defaultZoom, 1.2);
  assert.equal(reloaded.getSettings().askDownloadLocation, true);
  assert.equal(reloaded.getSettings().downloadPath, path.join(dir, "downloads"));
  assert.deepEqual(reloaded.getSession().tabs, [
    { url: "https://example.com/", title: "Example" },
  ]);
}

{
  const dir = tempDir();
  const storage = createStorage(dir);

  storage.addBookmark({ url: "https://example.com/", title: "Example" });
  storage.addBookmark({ url: "https://example.com/", title: "Duplicate" });
  storage.addBookmark({ url: "https://nyra.test/" });

  assert.deepEqual(storage.getBookmarks(), [
    { url: "https://example.com/", title: "Duplicate" },
    { url: "https://nyra.test/", title: "https://nyra.test/" },
  ]);

  storage.removeBookmark("https://example.com/");
  assert.deepEqual(storage.getBookmarks(), [
    { url: "https://nyra.test/", title: "https://nyra.test/" },
  ]);
}

{
  const dir = tempDir();
  const storage = createStorage(dir);

  storage.addHistoryEntry({
    url: "https://example.com/",
    title: "Example",
    visitedAt: "2026-04-27T08:00:00.000Z",
  });
  storage.addHistoryEntry({
    url: "https://nyra.test/",
    visitedAt: "2026-04-27T08:05:00.000Z",
  });
  storage.addHistoryEntry({
    url: "https://example.com/",
    title: "Updated",
    visitedAt: "2026-04-27T08:10:00.000Z",
  });

  assert.deepEqual(storage.getHistory(), [
    {
      url: "https://example.com/",
      title: "Updated",
      visitedAt: "2026-04-27T08:10:00.000Z",
    },
    {
      url: "https://nyra.test/",
      title: "https://nyra.test/",
      visitedAt: "2026-04-27T08:05:00.000Z",
    },
  ]);

  storage.removeHistoryEntry("https://example.com/");
  assert.deepEqual(storage.getHistory(), [
    {
      url: "https://nyra.test/",
      title: "https://nyra.test/",
      visitedAt: "2026-04-27T08:05:00.000Z",
    },
  ]);

  storage.clearHistory();
  assert.deepEqual(storage.getHistory(), []);

  const reloaded = createStorage(dir);
  assert.deepEqual(reloaded.getHistory(), storage.getHistory());
}

{
  const dir = tempDir();
  const storage = createStorage(dir);

  for (let index = 0; index < 105; index += 1) {
    storage.addHistoryEntry({
      url: `https://example.com/${index}`,
      visitedAt: `2026-04-27T08:${String(index % 60).padStart(2, "0")}:00.000Z`,
    });
  }

  assert.equal(storage.getHistory().length, 100);
  assert.equal(storage.getHistory()[0].url, "https://example.com/104");
  assert.equal(storage.getHistory()[99].url, "https://example.com/5");
}

console.log("storage: defaults, corrupted fallback, persistence, bookmarks, and history controls passed");
