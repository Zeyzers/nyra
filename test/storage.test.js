const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DEFAULT_STATE, createStorage, spacePartitionForId } = require("../src/storage");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nyra-storage-"));
}

{
  const dir = tempDir();
  const storage = createStorage(dir);
  assert.deepEqual(storage.getState(), DEFAULT_STATE);
  assert.equal(fs.existsSync(path.join(dir, "nyra-state.json")), true);
}

{
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "nyra-state.json"), "{ not valid json");
  const storage = createStorage(dir);
  assert.deepEqual(storage.getState(), DEFAULT_STATE);
  assert.equal(fs.existsSync(path.join(dir, "nyra-state.json")), true);
  assert.equal(
    fs.readdirSync(dir).some((entry) => entry.startsWith("nyra-state.corrupt.")),
    true,
  );
  assert.equal(storage.getRecoveryInfo().type, "corrupt-state-backup");
}

{
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "nyra-state.json"), JSON.stringify({
    settings: {
      restoreSession: true,
      theme: "system",
    },
    bookmarks: [
      { title: "Legacy", url: "https://legacy.example/" },
      { title: "Bad", url: "javascript:alert(1)" },
    ],
    session: {
      tabs: [
        { url: "https://example.com/", title: "Legacy tab" },
        { url: "ftp://example.com/", title: "Legacy protocol" },
      ],
    },
  }));

  const storage = createStorage(dir);
  assert.equal(storage.getSettings().startupBehavior, "restore");
  assert.equal(storage.getSettings().theme, "system");
  assert.equal(storage.getBookmarks().length, 1);
  assert.equal(storage.getBookmarks()[0].title, "Legacy");
  assert.deepEqual(storage.getDownloads(), []);
  assert.deepEqual(storage.getPermissions(), []);
  assert.equal(storage.getSession().tabs.length, 2);

  const migrated = JSON.parse(fs.readFileSync(path.join(dir, "nyra-state.json"), "utf8"));
  assert.deepEqual(Object.keys(migrated).sort(), [
    "bookmarkFolders",
    "bookmarks",
    "downloads",
    "extensions",
    "history",
    "permissions",
    "session",
    "settings",
    "spaces",
  ]);
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
    hardwareAcceleration: false,
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
  assert.equal(reloaded.getSettings().hardwareAcceleration, false);
  assert.deepEqual(reloaded.getSession().tabs, [
    { url: "https://example.com/", title: "Example", pinned: false, muted: false, favicon: "", spaceId: "personal" },
  ]);
  assert.equal(reloaded.getSession().activeSpaceId, "personal");
  assert.equal(reloaded.getSession().activeTabIndex, 0);
}

{
  const dir = tempDir();
  const storage = createStorage(dir);

  assert.equal(storage.getSpaces()[0].id, "personal");
  assert.equal(storage.getSpaces()[0].partition, spacePartitionForId("personal"));

  const spaces = storage.createSpace({
    id: "Work Stuff!",
    name: "Work",
    icon: "briefcase",
    color: "#3b82f6",
  });
  const work = spaces.find((space) => space.name === "Work");
  assert.equal(work.id, "work-stuff");
  assert.equal(work.partition, "persist:nyra-space-work-stuff");

  storage.saveSession({
    activeSpaceId: work.id,
    activeTabIndex: 0,
    tabs: [
      { url: "https://github.com/", title: "GitHub", spaceId: work.id },
      { url: "https://example.com/", title: "Legacy" },
      { url: "https://missing-space.test/", title: "Missing", spaceId: "missing" },
    ],
  });

  assert.deepEqual(storage.getSession().tabs.map((tab) => tab.spaceId), [
    work.id,
    "personal",
    "personal",
  ]);
  assert.equal(storage.getSession().activeSpaceId, work.id);

  storage.removeSpace("personal");
  assert.equal(storage.getSpaces().some((space) => space.id === "personal"), true);

  storage.removeSpace(work.id);
  assert.equal(storage.getSpaces().some((space) => space.id === work.id), false);
  assert.deepEqual(storage.getSession().tabs.map((tab) => tab.spaceId), [
    "personal",
    "personal",
    "personal",
  ]);
  assert.equal(storage.getSession().activeSpaceId, "personal");

  const banking = storage.createSpace({ id: "banking", name: "Banking", color: "#22c55e" })
    .find((space) => space.id === "banking");
  storage.setPermission({ domain: "example.com", permission: "camera", value: "allow", spaceId: "personal" });
  storage.setPermission({ domain: "example.com", permission: "camera", value: "deny", spaceId: banking.id });
  assert.equal(storage.getPermission("example.com", "camera", "personal").value, "allow");
  assert.equal(storage.getPermission("example.com", "camera", banking.id).value, "deny");
}

{
  const dir = tempDir();
  const storage = createStorage(dir);

  storage.addBookmark({ url: "https://example.com/", title: "Example" });
  storage.addBookmark({ url: "https://example.com/", title: "Duplicate" });
  storage.addBookmark({ url: "https://nyra.test/" });

  assert.equal(storage.getBookmarks().length, 2);
  assert.equal(storage.getBookmarks()[0].url, "https://example.com/");
  assert.equal(storage.getBookmarks()[0].title, "Duplicate");
  assert.equal(storage.getBookmarks()[1].url, "https://nyra.test/");

  storage.removeBookmark("https://example.com/");
  assert.equal(storage.getBookmarks().length, 1);
  assert.equal(storage.getBookmarks()[0].url, "https://nyra.test/");
}

{
  const dir = tempDir();
  const storage = createStorage(dir);

  const folderData = storage.createBookmarkFolder({ name: "Work" });
  const folderId = folderData.folders[0].id;
  storage.addBookmark({ url: "https://example.com/", title: "Example", folderId });
  storage.updateBookmark(storage.getBookmarks()[0].id, { title: "Updated" });
  assert.equal(storage.getBookmarks()[0].title, "Updated");
  assert.equal(storage.getBookmarks()[0].folderId, folderId);

  storage.upsertDownload({
    id: "download-1",
    filename: "file.txt",
    url: "https://example.com/file.txt",
    savePath: path.join(dir, "file.txt"),
    state: "completed",
    receivedBytes: 10,
    totalBytes: 10,
    percent: 100,
    startedAt: "2026-04-27T08:00:00.000Z",
    completedAt: "2026-04-27T08:00:01.000Z",
  });
  assert.equal(storage.getDownloads()[0].id, "download-1");
  assert.equal(storage.getDownloads()[0].url, "https://example.com/file.txt");
  storage.removeDownload("download-1");
  assert.deepEqual(storage.getDownloads(), []);

  storage.upsertDownload({
    id: "download-2",
    filename: "file.pdf",
    url: "https://example.com/file.pdf",
    state: "failed",
    receivedBytes: 4,
    totalBytes: 10,
    startedAt: "2026-04-27T08:00:00.000Z",
  });
  assert.equal(storage.getDownloads()[0].state, "failed");
  assert.equal(storage.getDownloads()[0].percent, 40);
  storage.clearDownloads();
  assert.deepEqual(storage.getDownloads(), []);

  storage.upsertExtension({
    path: path.join(dir, "extension"),
    name: "Example extension",
    version: "1.0.0",
    manifestVersion: 3,
    permissions: ["tabs", "storage"],
    extensionId: "abc",
    enabled: true,
  });
  assert.equal(storage.getExtensions()[0].name, "Example extension");
  assert.deepEqual(storage.getExtensions()[0].permissions, ["tabs", "storage"]);
  storage.updateExtension(storage.getExtensions()[0].id, { enabled: false, lastError: "Disabled" });
  assert.equal(storage.getExtensions()[0].enabled, false);
  assert.equal(storage.getExtensions()[0].lastError, "Disabled");
  storage.removeExtension(storage.getExtensions()[0].id);
  assert.deepEqual(storage.getExtensions(), []);

  storage.setPermission({ domain: "Example.com", permission: "camera", value: "allow" });
  assert.equal(storage.getPermission("example.com", "camera").value, "allow");
  storage.removePermission("example.com", "camera");
  assert.deepEqual(storage.getPermissions(), []);

  const imported = storage.importBookmarksHtml('<DT><H3>Imported</H3><DL><p><DT><A HREF="https://imported.test/">Imported</A></DL><p>');
  assert.equal(imported.bookmarks.some((bookmark) => bookmark.url === "https://imported.test/"), true);
  assert.equal(storage.exportBookmarksHtml().includes("Imported"), true);
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

console.log("storage: defaults, corrupted fallback, persistence, spaces, bookmarks, downloads, permissions, and history controls passed");
