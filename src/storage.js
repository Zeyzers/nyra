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

function normalizeState(state = {}) {
  return {
    settings: normalizeSettings(state.settings),
    session: {
      tabs: normalizeTabs(state.session && state.session.tabs)
    },
    bookmarks: Array.isArray(state.bookmarks) ? state.bookmarks : [],
    history: Array.isArray(state.history) ? state.history : []
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

  return {
    filePath,
    getState,
    resetState,
    getSettings,
    updateSettings,
    getSession,
    saveSession
  };
}

module.exports = {
  DEFAULT_STATE,
  createStorage,
  normalizeState
};
