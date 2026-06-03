const fs = require('fs');
const path = require('path');

const MAX_HISTORY_ENTRIES = 100;
const MAX_DOWNLOAD_ENTRIES = 100;
const VALID_THEMES = new Set(['dark', 'light', 'system']);
const VALID_ACCENTS = new Set(['pink', 'blue', 'purple', 'green', 'orange']);
const VALID_SEARCH_ENGINES = new Set(['duckduckgo', 'google', 'bing']);
const VALID_STARTUP_BEHAVIORS = new Set(['newtab', 'restore']);
const VALID_NEW_TAB_PAGES = new Set(['start', 'blank']);
const VALID_SIDEBAR_MODES = new Set(['expanded', 'compact']);
const VALID_NEW_TAB_DENSITIES = new Set(['comfortable', 'compact']);
const VALID_TAB_CLOSE_MODES = new Set(['always', 'hover']);
const VALID_PERMISSION_TYPES = new Set(['camera', 'microphone', 'geolocation', 'notifications']);
const VALID_PERMISSION_VALUES = new Set(['allow', 'deny']);

const DEFAULT_STATE = Object.freeze({
  settings: {
    httpsFirst: true,
    searchEngine: 'duckduckgo',
    restoreSession: true,
    startupBehavior: 'newtab',
    newTabPage: 'start',
    theme: 'dark',
    accentColor: 'pink',
    showSidebar: true,
    sidebarMode: 'expanded',
    compactLayout: false,
    newTabDensity: 'comfortable',
    compactTabs: false,
    tabCloseButtonMode: 'always',
    defaultZoom: 1,
    askDownloadLocation: false,
    downloadPath: '',
    hardwareAcceleration: true
  },
  session: {
    tabs: []
  },
  bookmarks: [],
  bookmarkFolders: [],
  downloads: [],
  extensions: [],
  permissions: [],
  history: []
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeDate(value) {
  return typeof value === 'string' && value.trim() ? value : new Date().toISOString();
}

function safeWebUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function faviconForUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function domainForUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function normalizeSettings(settings = {}) {
  const defaultZoom = Number(settings.defaultZoom);
  const restoreSession = typeof settings.restoreSession === 'boolean'
    ? settings.restoreSession
    : DEFAULT_STATE.settings.restoreSession;
  const startupBehavior = VALID_STARTUP_BEHAVIORS.has(settings.startupBehavior)
    ? settings.startupBehavior
    : restoreSession ? 'restore' : DEFAULT_STATE.settings.startupBehavior;

  return {
    ...clone(DEFAULT_STATE.settings),
    httpsFirst: typeof settings.httpsFirst === 'boolean'
      ? settings.httpsFirst
      : DEFAULT_STATE.settings.httpsFirst,
    searchEngine: VALID_SEARCH_ENGINES.has(settings.searchEngine)
      ? settings.searchEngine
      : DEFAULT_STATE.settings.searchEngine,
    restoreSession: startupBehavior === 'restore',
    startupBehavior,
    newTabPage: VALID_NEW_TAB_PAGES.has(settings.newTabPage)
      ? settings.newTabPage
      : DEFAULT_STATE.settings.newTabPage,
    theme: VALID_THEMES.has(settings.theme)
      ? settings.theme
      : DEFAULT_STATE.settings.theme,
    accentColor: VALID_ACCENTS.has(settings.accentColor)
      ? settings.accentColor
      : DEFAULT_STATE.settings.accentColor,
    showSidebar: typeof settings.showSidebar === 'boolean'
      ? settings.showSidebar
      : DEFAULT_STATE.settings.showSidebar,
    sidebarMode: VALID_SIDEBAR_MODES.has(settings.sidebarMode)
      ? settings.sidebarMode
      : settings.showSidebar === false ? 'compact' : DEFAULT_STATE.settings.sidebarMode,
    compactLayout: typeof settings.compactLayout === 'boolean'
      ? settings.compactLayout
      : DEFAULT_STATE.settings.compactLayout,
    newTabDensity: VALID_NEW_TAB_DENSITIES.has(settings.newTabDensity)
      ? settings.newTabDensity
      : DEFAULT_STATE.settings.newTabDensity,
    compactTabs: typeof settings.compactTabs === 'boolean'
      ? settings.compactTabs
      : DEFAULT_STATE.settings.compactTabs,
    tabCloseButtonMode: VALID_TAB_CLOSE_MODES.has(settings.tabCloseButtonMode)
      ? settings.tabCloseButtonMode
      : DEFAULT_STATE.settings.tabCloseButtonMode,
    defaultZoom: Number.isFinite(defaultZoom)
      ? Math.min(1.5, Math.max(0.75, Math.round(defaultZoom * 20) / 20))
      : DEFAULT_STATE.settings.defaultZoom,
    askDownloadLocation: typeof settings.askDownloadLocation === 'boolean'
      ? settings.askDownloadLocation
      : DEFAULT_STATE.settings.askDownloadLocation,
    downloadPath: typeof settings.downloadPath === 'string'
      ? settings.downloadPath
      : DEFAULT_STATE.settings.downloadPath,
    hardwareAcceleration: typeof settings.hardwareAcceleration === 'boolean'
      ? settings.hardwareAcceleration
      : DEFAULT_STATE.settings.hardwareAcceleration
  };
}

function normalizeTabs(tabs) {
  if (!Array.isArray(tabs)) return [];

  return tabs
    .filter((tab) => tab && typeof tab.url === 'string')
    .map((tab) => ({
      url: tab.url,
      title: typeof tab.title === 'string' ? tab.title : 'New Tab',
      pinned: Boolean(tab.pinned),
      muted: Boolean(tab.muted),
      favicon: typeof tab.favicon === 'string' ? tab.favicon : ''
    }));
}

function normalizeBookmarkFolders(folders) {
  if (!Array.isArray(folders)) return [];

  const seen = new Set();
  return folders
    .filter((folder) => folder && typeof folder.name === 'string' && folder.name.trim())
    .map((folder, index) => ({
      id: typeof folder.id === 'string' && folder.id ? folder.id : createId('folder'),
      name: folder.name.trim(),
      order: Number.isFinite(Number(folder.order)) ? Number(folder.order) : index,
      createdAt: safeDate(folder.createdAt),
      updatedAt: safeDate(folder.updatedAt || folder.createdAt)
    }))
    .filter((folder) => {
      if (seen.has(folder.id)) return false;
      seen.add(folder.id);
      return true;
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function normalizeBookmarks(bookmarks, folders = []) {
  if (!Array.isArray(bookmarks)) return [];

  const folderIds = new Set(normalizeBookmarkFolders(folders).map((folder) => folder.id));
  const seen = new Set();
  return bookmarks
    .filter((bookmark) => bookmark && typeof bookmark.url === 'string')
    .map((bookmark, index) => {
      const url = safeWebUrl(bookmark.url);
      return {
        id: typeof bookmark.id === 'string' && bookmark.id ? bookmark.id : createId('bookmark'),
        url,
        title: typeof bookmark.title === 'string' && bookmark.title.trim()
          ? bookmark.title.trim()
          : url,
        folderId: folderIds.has(bookmark.folderId) ? bookmark.folderId : '',
        favicon: typeof bookmark.favicon === 'string' && bookmark.favicon ? bookmark.favicon : faviconForUrl(url),
        createdAt: safeDate(bookmark.createdAt),
        updatedAt: safeDate(bookmark.updatedAt || bookmark.createdAt),
        order: Number.isFinite(Number(bookmark.order)) ? Number(bookmark.order) : index
      };
    })
    .filter((bookmark) => {
      if (!bookmark.url || seen.has(bookmark.url)) return false;
      seen.add(bookmark.url);
      return true;
    })
    .sort((a, b) => a.folderId.localeCompare(b.folderId) || a.order - b.order || a.title.localeCompare(b.title));
}

function normalizeDownloads(downloads) {
  if (!Array.isArray(downloads)) return [];

  const seen = new Set();
  return downloads
    .filter((download) => download && typeof download.filename === 'string')
    .map((download) => {
      const totalBytes = Number(download.totalBytes) || 0;
      const receivedBytes = Number(download.receivedBytes) || 0;
      const state = ['downloading', 'completed', 'failed', 'cancelled', 'canceled', 'interrupted', 'missing']
        .includes(download.state)
        ? download.state
        : 'completed';
      return {
        id: typeof download.id === 'string' && download.id
          ? download.id
          : typeof download.id === 'number'
            ? String(download.id)
            : createId('download'),
        filename: download.filename,
        url: typeof download.url === 'string' ? download.url : '',
        savePath: typeof download.savePath === 'string' ? download.savePath : '',
        state,
        receivedBytes,
        totalBytes,
        percent: Number.isFinite(Number(download.percent))
          ? Math.min(100, Math.max(0, Math.round(Number(download.percent))))
          : totalBytes > 0
            ? Math.round((receivedBytes / totalBytes) * 100)
            : state === 'completed' ? 100 : 0,
        startedAt: safeDate(download.startedAt),
        completedAt: typeof download.completedAt === 'string' ? download.completedAt : ''
      };
    })
    .filter((download) => {
      if (seen.has(download.id)) return false;
      seen.add(download.id);
      return true;
    })
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
    .slice(0, MAX_DOWNLOAD_ENTRIES);
}

function normalizeExtensions(extensions) {
  if (!Array.isArray(extensions)) return [];

  const seen = new Set();
  return extensions
    .filter((extension) => extension && typeof extension.path === 'string' && extension.path.trim())
    .map((extension) => ({
      id: typeof extension.id === 'string' && extension.id
        ? extension.id
        : createId('extension'),
      extensionId: typeof extension.extensionId === 'string' ? extension.extensionId : '',
      name: typeof extension.name === 'string' && extension.name.trim()
        ? extension.name.trim()
        : 'Unpacked extension',
      version: typeof extension.version === 'string' ? extension.version : '',
      manifestVersion: Number.isFinite(Number(extension.manifestVersion))
        ? Number(extension.manifestVersion)
        : 0,
      permissions: Array.isArray(extension.permissions)
        ? extension.permissions.filter((permission) => typeof permission === 'string' && permission.trim()).map((permission) => permission.trim())
        : [],
      path: extension.path.trim(),
      enabled: typeof extension.enabled === 'boolean' ? extension.enabled : true,
      lastError: typeof extension.lastError === 'string' ? extension.lastError : '',
      createdAt: safeDate(extension.createdAt),
      updatedAt: safeDate(extension.updatedAt || extension.createdAt)
    }))
    .filter((extension) => {
      const key = extension.path.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function normalizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];

  const seen = new Set();
  return permissions
    .filter((permission) => permission && typeof permission.domain === 'string')
    .map((permission) => ({
      domain: permission.domain.trim().toLowerCase().replace(/^www\./, ''),
      permission: permission.permission,
      value: permission.value,
      updatedAt: safeDate(permission.updatedAt)
    }))
    .filter((permission) => {
      const key = `${permission.domain}:${permission.permission}`;
      if (
        !permission.domain ||
        !VALID_PERMISSION_TYPES.has(permission.permission) ||
        !VALID_PERMISSION_VALUES.has(permission.value) ||
        seen.has(key)
      ) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.domain.localeCompare(b.domain) || a.permission.localeCompare(b.permission));
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  const seen = new Set();
  return history
    .filter((entry) => entry && typeof entry.url === 'string')
    .map((entry) => ({
      url: entry.url,
      title: typeof entry.title === 'string' && entry.title.trim()
        ? entry.title.trim()
        : entry.url,
      visitedAt: safeDate(entry.visitedAt)
    }))
    .filter((entry) => {
      if (seen.has(entry.url)) return false;
      seen.add(entry.url);
      return true;
    })
    .slice(0, MAX_HISTORY_ENTRIES);
}

function normalizeState(state = {}) {
  const bookmarkFolders = normalizeBookmarkFolders(state.bookmarkFolders);
  return {
    settings: normalizeSettings(state.settings),
    session: {
      tabs: normalizeTabs(state.session && state.session.tabs)
    },
    bookmarks: normalizeBookmarks(state.bookmarks, bookmarkFolders),
    bookmarkFolders,
    downloads: normalizeDownloads(state.downloads),
    extensions: normalizeExtensions(state.extensions),
    permissions: normalizePermissions(state.permissions),
    history: normalizeHistory(state.history)
  };
}

function bookmarksToHtml(bookmarks, folders) {
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
  const groups = new Map([['', []]]);
  bookmarks.forEach((bookmark) => {
    const key = bookmark.folderId || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bookmark);
  });

  const linkFor = (bookmark) => `        <DT><A HREF="${bookmark.url}" ADD_DATE="${Math.floor(new Date(bookmark.createdAt).getTime() / 1000)}">${bookmark.title}</A>`;
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>'
  ];

  (groups.get('') || []).forEach((bookmark) => lines.push(linkFor(bookmark)));
  folders.forEach((folder) => {
    lines.push(`    <DT><H3>${folder.name}</H3>`);
    lines.push('    <DL><p>');
    (groups.get(folder.id) || []).forEach((bookmark) => lines.push(linkFor(bookmark)));
    lines.push('    </DL><p>');
  });
  lines.push('</DL><p>');
  return lines.join('\n');
}

function parseBookmarksHtml(html) {
  const folders = [];
  const bookmarks = [];
  const folderStack = [''];
  const tokenRe = /<DT><H3[^>]*>(.*?)<\/H3>|<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>(.*?)<\/A>|<\/DL>/gis;
  let match;

  while ((match = tokenRe.exec(html))) {
    if (match[1]) {
      const folder = {
        id: createId('folder'),
        name: match[1].replace(/<[^>]+>/g, '').trim(),
        order: folders.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      folders.push(folder);
      folderStack.push(folder.id);
    } else if (match[2]) {
      const url = safeWebUrl(match[2]);
      if (url) {
        bookmarks.push({
          id: createId('bookmark'),
          url,
          title: match[3].replace(/<[^>]+>/g, '').trim() || url,
          folderId: folderStack[folderStack.length - 1] || '',
          order: bookmarks.length,
          favicon: faviconForUrl(url),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } else if (folderStack.length > 1) {
      folderStack.pop();
    }
  }

  return { folders, bookmarks };
}

function createStorage(userDataDir, filename = 'nyra-state.json') {
  const filePath = path.join(userDataDir, filename);
  let recoveryInfo = null;
  let state = loadState();

  function writeStateFile(nextState) {
    fs.mkdirSync(userDataDir, { recursive: true });

    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(nextState, null, 2));
    fs.renameSync(tempPath, filePath);
  }

  function writeDefaultState() {
    const defaults = clone(DEFAULT_STATE);
    try {
      writeStateFile(defaults);
    } catch {
      // Loading must remain best-effort. Runtime writes can still surface
      // errors, but boot should not fail because defaults could not be saved.
    }
    return defaults;
  }

  function backupCorruptState(error) {
    const backupPath = path.join(
      userDataDir,
      `nyra-state.corrupt.${timestampForFilename()}.json`
    );

    try {
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, backupPath);
        recoveryInfo = {
          type: 'corrupt-state-backup',
          backupPath,
          error: error && error.message ? error.message : String(error || 'Unknown storage error')
        };
      }
    } catch (backupError) {
      recoveryInfo = {
        type: 'corrupt-state-backup-failed',
        backupPath,
        error: backupError && backupError.message ? backupError.message : String(backupError)
      };
    }
  }

  function loadState() {
    try {
      fs.mkdirSync(userDataDir, { recursive: true });

      if (!fs.existsSync(filePath)) {
        recoveryInfo = { type: 'missing-state-created' };
        return writeDefaultState();
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      let parsed;

      try {
        parsed = JSON.parse(raw);
      } catch (parseError) {
        backupCorruptState(parseError);
        return writeDefaultState();
      }

      try {
        const normalized = normalizeState(parsed);
        writeStateFile(normalized);
        return normalized;
      } catch (normalizeError) {
        backupCorruptState(normalizeError);
        return writeDefaultState();
      }
    } catch (loadError) {
      recoveryInfo = {
        type: 'storage-load-fallback',
        error: loadError && loadError.message ? loadError.message : String(loadError)
      };
      return clone(DEFAULT_STATE);
    }
  }

  function writeState(nextState) {
    state = normalizeState(nextState);
    writeStateFile(state);
    return clone(state);
  }

  function getState() {
    return clone(state);
  }

  function getRecoveryInfo() {
    return recoveryInfo ? { ...recoveryInfo } : null;
  }

  function resetState() {
    return writeState(clone(DEFAULT_STATE));
  }

  function getSettings() {
    return clone(state.settings);
  }

  function updateSettings(partialSettings) {
    const normalizedPartial = { ...(partialSettings || {}) };

    if (
      Object.prototype.hasOwnProperty.call(normalizedPartial, 'restoreSession') &&
      !Object.prototype.hasOwnProperty.call(normalizedPartial, 'startupBehavior')
    ) {
      normalizedPartial.startupBehavior = normalizedPartial.restoreSession ? 'restore' : 'newtab';
    }

    return writeState({
      ...state,
      settings: normalizeSettings({
        ...state.settings,
        ...normalizedPartial
      })
    }).settings;
  }

  function getSession() {
    return clone(state.session);
  }

  function saveSession(session) {
    return writeState({
      ...state,
      session: {
        tabs: normalizeTabs(session && session.tabs)
      }
    }).session;
  }

  function getBookmarksData() {
    return {
      bookmarks: clone(state.bookmarks),
      folders: clone(state.bookmarkFolders)
    };
  }

  function getBookmarks() {
    return clone(state.bookmarks);
  }

  function addBookmark(bookmark) {
    const now = new Date().toISOString();
    const [normalizedBookmark] = normalizeBookmarks([{
      ...bookmark,
      id: bookmark && bookmark.id ? bookmark.id : createId('bookmark'),
      createdAt: bookmark && bookmark.createdAt ? bookmark.createdAt : now,
      updatedAt: now,
      order: bookmark && Number.isFinite(Number(bookmark.order))
        ? Number(bookmark.order)
        : state.bookmarks.length
    }], state.bookmarkFolders);
    if (!normalizedBookmark) return getBookmarks();

    return writeState({
      ...state,
      bookmarks: normalizeBookmarks([
        ...state.bookmarks.filter((item) => item.url !== normalizedBookmark.url && item.id !== normalizedBookmark.id),
        normalizedBookmark
      ], state.bookmarkFolders)
    }).bookmarks;
  }

  function updateBookmark(id, updates) {
    if (typeof id !== 'string') return getBookmarks();

    const now = new Date().toISOString();
    return writeState({
      ...state,
      bookmarks: normalizeBookmarks(state.bookmarks.map((bookmark) => (
        bookmark.id === id || bookmark.url === id
          ? { ...bookmark, ...(updates || {}), id: bookmark.id, updatedAt: now }
          : bookmark
      )), state.bookmarkFolders)
    }).bookmarks;
  }

  function removeBookmark(idOrUrl) {
    if (typeof idOrUrl !== 'string') return getBookmarks();

    return writeState({
      ...state,
      bookmarks: state.bookmarks.filter((bookmark) => bookmark.url !== idOrUrl && bookmark.id !== idOrUrl)
    }).bookmarks;
  }

  function reorderBookmarks(bookmarkIds) {
    if (!Array.isArray(bookmarkIds)) return getBookmarks();
    const order = new Map(bookmarkIds.map((id, index) => [id, index]));

    return writeState({
      ...state,
      bookmarks: normalizeBookmarks(state.bookmarks.map((bookmark) => ({
        ...bookmark,
        order: order.has(bookmark.id) ? order.get(bookmark.id) : bookmark.order
      })), state.bookmarkFolders)
    }).bookmarks;
  }

  function createBookmarkFolder(folder) {
    const now = new Date().toISOString();
    const [normalizedFolder] = normalizeBookmarkFolders([{
      id: createId('folder'),
      name: folder && folder.name,
      order: state.bookmarkFolders.length,
      createdAt: now,
      updatedAt: now
    }]);

    if (!normalizedFolder) return getBookmarksData();

    const nextState = writeState({
      ...state,
      bookmarkFolders: normalizeBookmarkFolders([...state.bookmarkFolders, normalizedFolder])
    });
    return { bookmarks: nextState.bookmarks, folders: nextState.bookmarkFolders };
  }

  function updateBookmarkFolder(id, updates) {
    const now = new Date().toISOString();
    const nextState = writeState({
      ...state,
      bookmarkFolders: normalizeBookmarkFolders(state.bookmarkFolders.map((folder) => (
        folder.id === id ? { ...folder, ...(updates || {}), id: folder.id, updatedAt: now } : folder
      )))
    });
    return { bookmarks: nextState.bookmarks, folders: nextState.bookmarkFolders };
  }

  function removeBookmarkFolder(id) {
    const nextState = writeState({
      ...state,
      bookmarkFolders: state.bookmarkFolders.filter((folder) => folder.id !== id),
      bookmarks: state.bookmarks.map((bookmark) => (
        bookmark.folderId === id ? { ...bookmark, folderId: '', updatedAt: new Date().toISOString() } : bookmark
      ))
    });
    return { bookmarks: nextState.bookmarks, folders: nextState.bookmarkFolders };
  }

  function importBookmarksHtml(html) {
    const parsed = parseBookmarksHtml(String(html || ''));
    const nextState = writeState({
      ...state,
      bookmarkFolders: normalizeBookmarkFolders([...state.bookmarkFolders, ...parsed.folders]),
      bookmarks: normalizeBookmarks([...state.bookmarks, ...parsed.bookmarks], [...state.bookmarkFolders, ...parsed.folders])
    });
    return { bookmarks: nextState.bookmarks, folders: nextState.bookmarkFolders };
  }

  function exportBookmarksHtml() {
    return bookmarksToHtml(state.bookmarks, state.bookmarkFolders);
  }

  function getDownloads() {
    return clone(state.downloads);
  }

  function upsertDownload(download) {
    const [normalizedDownload] = normalizeDownloads([download]);
    if (!normalizedDownload) return getDownloads();

    return writeState({
      ...state,
      downloads: normalizeDownloads([
        normalizedDownload,
        ...state.downloads.filter((item) => item.id !== normalizedDownload.id)
      ])
    }).downloads;
  }

  function removeDownload(id) {
    if (typeof id !== 'string') return getDownloads();

    return writeState({
      ...state,
      downloads: state.downloads.filter((download) => download.id !== id)
    }).downloads;
  }

  function clearDownloads() {
    return writeState({
      ...state,
      downloads: []
    }).downloads;
  }

  function getExtensions() {
    return clone(state.extensions);
  }

  function upsertExtension(extension) {
    const now = new Date().toISOString();
    const [normalizedExtension] = normalizeExtensions([{
      ...(extension || {}),
      id: extension && extension.id ? extension.id : createId('extension'),
      createdAt: extension && extension.createdAt ? extension.createdAt : now,
      updatedAt: now
    }]);
    if (!normalizedExtension) return getExtensions();

    return writeState({
      ...state,
      extensions: normalizeExtensions([
        ...state.extensions.filter((item) => (
          item.id !== normalizedExtension.id &&
          item.path.toLowerCase() !== normalizedExtension.path.toLowerCase()
        )),
        normalizedExtension
      ])
    }).extensions;
  }

  function updateExtension(id, updates) {
    if (typeof id !== 'string') return getExtensions();

    const now = new Date().toISOString();
    return writeState({
      ...state,
      extensions: normalizeExtensions(state.extensions.map((extension) => (
        extension.id === id || extension.extensionId === id
          ? { ...extension, ...(updates || {}), id: extension.id, updatedAt: now }
          : extension
      )))
    }).extensions;
  }

  function removeExtension(id) {
    if (typeof id !== 'string') return getExtensions();

    return writeState({
      ...state,
      extensions: state.extensions.filter((extension) => extension.id !== id && extension.extensionId !== id)
    }).extensions;
  }

  function getPermissions() {
    return clone(state.permissions);
  }

  function getPermission(domain, permission) {
    const normalizedDomain = String(domain || '').trim().toLowerCase().replace(/^www\./, '');
    return state.permissions.find((item) => item.domain === normalizedDomain && item.permission === permission) || null;
  }

  function setPermission(permission) {
    const [normalizedPermission] = normalizePermissions([{
      ...(permission || {}),
      updatedAt: new Date().toISOString()
    }]);
    if (!normalizedPermission) return getPermissions();

    return writeState({
      ...state,
      permissions: normalizePermissions([
        normalizedPermission,
        ...state.permissions.filter((item) => (
          item.domain !== normalizedPermission.domain || item.permission !== normalizedPermission.permission
        ))
      ])
    }).permissions;
  }

  function removePermission(domain, permission) {
    const normalizedDomain = String(domain || '').trim().toLowerCase().replace(/^www\./, '');
    return writeState({
      ...state,
      permissions: state.permissions.filter((item) => (
        item.domain !== normalizedDomain || (permission && item.permission !== permission)
      ))
    }).permissions;
  }

  function clearPermissions() {
    return writeState({
      ...state,
      permissions: []
    }).permissions;
  }

  function getHistory() {
    return clone(state.history);
  }

  function addHistoryEntry(entry) {
    const [normalizedEntry] = normalizeHistory([entry]);
    if (!normalizedEntry) return getHistory();

    return writeState({
      ...state,
      history: normalizeHistory([
        normalizedEntry,
        ...state.history.filter((item) => item.url !== normalizedEntry.url)
      ])
    }).history;
  }

  function removeHistoryEntry(url) {
    if (typeof url !== 'string') return getHistory();

    return writeState({
      ...state,
      history: state.history.filter((entry) => entry.url !== url)
    }).history;
  }

  function clearHistory() {
    return writeState({
      ...state,
      history: []
    }).history;
  }

  return {
    filePath,
    getRecoveryInfo,
    getState,
    resetState,
    getSettings,
    updateSettings,
    getSession,
    saveSession,
    getBookmarksData,
    getBookmarks,
    addBookmark,
    updateBookmark,
    removeBookmark,
    reorderBookmarks,
    createBookmarkFolder,
    updateBookmarkFolder,
    removeBookmarkFolder,
    importBookmarksHtml,
    exportBookmarksHtml,
    getDownloads,
    upsertDownload,
    removeDownload,
    clearDownloads,
    getExtensions,
    upsertExtension,
    updateExtension,
    removeExtension,
    getPermissions,
    getPermission,
    setPermission,
    removePermission,
    clearPermissions,
    getHistory,
    addHistoryEntry,
    removeHistoryEntry,
    clearHistory
  };
}

module.exports = {
  DEFAULT_STATE,
  createStorage,
  domainForUrl,
  normalizeState
};
