const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nyra', {
  getSettings: () => ipcRenderer.invoke('nyra:get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('nyra:update-settings', settings),
  loadSession: () => ipcRenderer.invoke('nyra:load-session'),
  saveSession: (tabs) => ipcRenderer.invoke('nyra:save-session', tabs),
  getBookmarks: () => ipcRenderer.invoke('nyra:get-bookmarks'),
  addBookmark: (bookmark) => ipcRenderer.invoke('nyra:add-bookmark', bookmark),
  removeBookmark: (url) => ipcRenderer.invoke('nyra:remove-bookmark', url),
  getHistory: () => ipcRenderer.invoke('nyra:get-history'),
  addHistoryEntry: (entry) => ipcRenderer.invoke('nyra:add-history-entry', entry),
  removeHistoryEntry: (url) => ipcRenderer.invoke('nyra:remove-history-entry', url),
  clearHistory: () => ipcRenderer.invoke('nyra:clear-history'),
  resetState: () => ipcRenderer.invoke('nyra:reset-state'),
  onSettingsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('nyra:settings-changed', listener);
    return () => ipcRenderer.removeListener('nyra:settings-changed', listener);
  },
  onStateReset: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, state) => callback(state);
    ipcRenderer.on('nyra:state-reset', listener);
    return () => ipcRenderer.removeListener('nyra:state-reset', listener);
  },
  onBookmarksChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, bookmarks) => callback(bookmarks);
    ipcRenderer.on('nyra:bookmarks-changed', listener);
    return () => ipcRenderer.removeListener('nyra:bookmarks-changed', listener);
  },
  onHistoryChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, history) => callback(history);
    ipcRenderer.on('nyra:history-changed', listener);
    return () => ipcRenderer.removeListener('nyra:history-changed', listener);
  }
});
