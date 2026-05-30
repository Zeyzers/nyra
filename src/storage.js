const fs = require('fs');
const path = require('path');

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
    downloadPath: ''
  },
  session: {
    tabs: []
  },
  bookmarks: [],
  history: []
});

const MAX_HISTORY_ENTRIES = 100;
const VALID_THEMES = new Set(['dark', 'light', 'system']);
const VALID_ACCENTS = new Set(['pink', 'blue', 'purple', 'green', 'orange']);
const VALID_SEARCH_ENGINES = new Set(['duckduckgo', 'google', 'bing']);
const VALID_STARTUP_BEHAVIORS = new Set(['newtab', 'restore']);
const VALID_NEW_TAB_PAGES = new Set(['start', 'blank']);
const VALID_SIDEBAR_MODES = new Set(['expanded', 'compact']);
const VALID_NEW_TAB_DENSITIES = new Set(['comfortable', 'compact']);
const VALID_TAB_CLOSE_MODES = new Set(['always', 'hover']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
      : DEFAULT_STATE.settings.downloadPath
  };
}

function normalizeTabs(tabs) {
  if (!Array.isArray(tabs)) return [];

  return tabs
    .filter((tab) => tab && typeof tab.url === 'string')
    .map((tab) => ({
      url: tab.url,
      title: typeof tab.title === 'string' ? tab.title : 'New Tab'
    }));
}

function normalizeBookmarks(bookmarks) {
  if (!Array.isArray(bookmarks)) return [];

  const seen = new Set();
  return bookmarks
    .filter((bookmark) => bookmark && typeof bookmark.url === 'string')
    .map((bookmark) => ({
      url: bookmark.url,
      title: typeof bookmark.title === 'string' && bookmark.title.trim()
        ? bookmark.title.trim()
        : bookmark.url
    }))
    .filter((bookmark) => {
      if (seen.has(bookmark.url)) return false;
      seen.add(bookmark.url);
      return true;
    });
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
      visitedAt: typeof entry.visitedAt === 'string' && entry.visitedAt.trim()
        ? entry.visitedAt
        : new Date().toISOString()
    }))
    .filter((entry) => {
      if (seen.has(entry.url)) return false;
      seen.add(entry.url);
      return true;
    })
    .slice(0, MAX_HISTORY_ENTRIES);
}

function normalizeState(state = {}) {
  return {
    settings: normalizeSettings(state.settings),
    session: {
      tabs: normalizeTabs(state.session && state.session.tabs)
    },
    bookmarks: normalizeBookmarks(state.bookmarks),
    history: normalizeHistory(state.history)
  };
}

function createStorage(userDataDir, filename = 'nyra-state.json') {
  const filePath = path.join(userDataDir, filename);
  let state = loadState();

  function loadState() {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return normalizeState(JSON.parse(raw));
    } catch {
      return clone(DEFAULT_STATE);
    }
  }

  function writeState(nextState) {
    state = normalizeState(nextState);
    fs.mkdirSync(userDataDir, { recursive: true });

    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
    fs.renameSync(tempPath, filePath);
    return clone(state);
  }

  function getState() {
    return clone(state);
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

  function getBookmarks() {
    return clone(state.bookmarks);
  }

  function addBookmark(bookmark) {
    const [normalizedBookmark] = normalizeBookmarks([bookmark]);
    if (!normalizedBookmark) return getBookmarks();

    return writeState({
      ...state,
      bookmarks: normalizeBookmarks([
        ...state.bookmarks.filter((item) => item.url !== normalizedBookmark.url),
        normalizedBookmark
      ])
    }).bookmarks;
  }

  function removeBookmark(url) {
    if (typeof url !== 'string') return getBookmarks();

    return writeState({
      ...state,
      bookmarks: state.bookmarks.filter((bookmark) => bookmark.url !== url)
    }).bookmarks;
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
    getState,
    resetState,
    getSettings,
    updateSettings,
    getSession,
    saveSession,
    getBookmarks,
    addBookmark,
    removeBookmark,
    getHistory,
    addHistoryEntry,
    removeHistoryEntry,
    clearHistory
  };
}

module.exports = {
  DEFAULT_STATE,
  createStorage,
  normalizeState
};
