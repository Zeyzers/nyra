const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = Object.freeze({
  settings: {
    httpsFirst: true,
    searchEngine: 'duckduckgo',
    restoreSession: true
  },
  session: {
    tabs: []
  },
  bookmarks: [],
  history: []
});

const MAX_HISTORY_ENTRIES = 100;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeSettings(settings = {}) {
  return {
    ...clone(DEFAULT_STATE.settings),
    httpsFirst: typeof settings.httpsFirst === 'boolean'
      ? settings.httpsFirst
      : DEFAULT_STATE.settings.httpsFirst,
    searchEngine: settings.searchEngine === 'duckduckgo'
      ? settings.searchEngine
      : DEFAULT_STATE.settings.searchEngine,
    restoreSession: typeof settings.restoreSession === 'boolean'
      ? settings.restoreSession
      : DEFAULT_STATE.settings.restoreSession
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
    return writeState({
      ...state,
      settings: normalizeSettings({
        ...state.settings,
        ...(partialSettings || {})
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
