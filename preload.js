const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nyra', {
  getSettings: () => ipcRenderer.invoke('nyra:get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('nyra:update-settings', settings),
  loadSession: () => ipcRenderer.invoke('nyra:load-session'),
  saveSession: (tabs) => ipcRenderer.invoke('nyra:save-session', tabs),
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
  }
});
