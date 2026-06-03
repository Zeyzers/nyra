const { contextBridge, ipcRenderer } = require('electron');

const isTrustedLocalPage = window.location.protocol === 'file:';

function installPasswordBridge() {
  function isVisibleInput(input) {
    if (!input || input.disabled || input.readOnly) return false;

    const rect = input.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function usernameInputFor(passwordInput, form) {
    const candidates = Array.from((form || document).querySelectorAll('input'))
      .filter((input) => {
        const type = String(input.type || 'text').toLowerCase();
        return ['email', 'text', 'tel'].includes(type) && isVisibleInput(input);
      });
    const beforePassword = candidates.filter((input) => {
      try {
        return input.compareDocumentPosition(passwordInput) & Node.DOCUMENT_POSITION_FOLLOWING;
      } catch {
        return false;
      }
    });

    return beforePassword.pop() || candidates[0] || null;
  }

  function passwordInputs(root = document) {
    return Array.from(root.querySelectorAll('input[type="password"]')).filter(isVisibleInput);
  }

  function loginFieldForTarget(target) {
    if (!(target instanceof HTMLInputElement) || !isVisibleInput(target)) return null;

    const type = String(target.type || 'text').toLowerCase();
    const form = target.form || document;
    const passwordInput = type === 'password'
      ? target
      : passwordInputs(form)[0];
    if (!passwordInput) return null;

    const usernameInput = usernameInputFor(passwordInput, form);
    if (target !== passwordInput && target !== usernameInput) return null;

    return { passwordInput, usernameInput };
  }

  function notifyLoginFieldActivated(event) {
    if (!loginFieldForTarget(event.target)) return;

    ipcRenderer.sendToHost('nyra-password-forms', {
      url: window.location.href,
      reason: 'field-activated'
    });
  }

  function fillCredentials(credentials) {
    if (!credentials || !credentials.username || !credentials.password) return;

    const passwordInput = passwordInputs()[0];
    if (!passwordInput) return;

    const form = passwordInput.form || document;
    const usernameInput = usernameInputFor(passwordInput, form);
    if (usernameInput && !usernameInput.value) {
      usernameInput.value = credentials.username;
      usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (!passwordInput.value) {
      passwordInput.value = credentials.password;
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function submitCredentials(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const passwordInput = passwordInputs(form)[0];
    if (!passwordInput || !passwordInput.value) return;

    const usernameInput = usernameInputFor(passwordInput, form);
    const username = usernameInput ? usernameInput.value.trim() : '';
    if (!username) return;

    ipcRenderer.sendToHost('nyra-password-submit', {
      url: window.location.href,
      username,
      password: passwordInput.value
    });
  }

  document.addEventListener('focusin', notifyLoginFieldActivated, true);
  document.addEventListener('pointerdown', notifyLoginFieldActivated, true);
  document.addEventListener('submit', submitCredentials, true);
  ipcRenderer.on('nyra-fill-login', (_event, credentials) => fillCredentials(credentials));
}

if (isTrustedLocalPage) {
  contextBridge.exposeInMainWorld('nyra', {
  rendererReady: () => ipcRenderer.send('nyra:renderer-ready'),
  startupLog: (message) => ipcRenderer.send('nyra:startup-log', message),
  isSafeMode: () => ipcRenderer.invoke('nyra:is-safe-mode'),
  getSettings: () => ipcRenderer.invoke('nyra:get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('nyra:update-settings', settings),
  loadSession: () => ipcRenderer.invoke('nyra:load-session'),
  saveSession: (tabs) => ipcRenderer.invoke('nyra:save-session', tabs),
  saveSessionSync: (tabs) => ipcRenderer.sendSync('nyra:save-session-sync', tabs),
  getBookmarksData: () => ipcRenderer.invoke('nyra:get-bookmarks-data'),
  getBookmarks: () => ipcRenderer.invoke('nyra:get-bookmarks'),
  addBookmark: (bookmark) => ipcRenderer.invoke('nyra:add-bookmark', bookmark),
  updateBookmark: (id, updates) => ipcRenderer.invoke('nyra:update-bookmark', id, updates),
  removeBookmark: (url) => ipcRenderer.invoke('nyra:remove-bookmark', url),
  reorderBookmarks: (bookmarkIds) => ipcRenderer.invoke('nyra:reorder-bookmarks', bookmarkIds),
  createBookmarkFolder: (folder) => ipcRenderer.invoke('nyra:create-bookmark-folder', folder),
  updateBookmarkFolder: (id, updates) => ipcRenderer.invoke('nyra:update-bookmark-folder', id, updates),
  removeBookmarkFolder: (id) => ipcRenderer.invoke('nyra:remove-bookmark-folder', id),
  importBookmarksHtml: () => ipcRenderer.invoke('nyra:import-bookmarks-html'),
  exportBookmarksHtml: () => ipcRenderer.invoke('nyra:export-bookmarks-html'),
  getHistory: () => ipcRenderer.invoke('nyra:get-history'),
  addHistoryEntry: (entry) => ipcRenderer.invoke('nyra:add-history-entry', entry),
  removeHistoryEntry: (url) => ipcRenderer.invoke('nyra:remove-history-entry', url),
  clearHistory: () => ipcRenderer.invoke('nyra:clear-history'),
  resetState: () => ipcRenderer.invoke('nyra:reset-state'),
  getAppInfo: () => ipcRenderer.invoke('nyra:get-app-info'),
  getDownloadsInfo: () => ipcRenderer.invoke('nyra:get-downloads-info'),
  getDownloads: () => ipcRenderer.invoke('nyra:get-downloads'),
  downloadUrl: (url) => ipcRenderer.invoke('nyra:download-url', url),
  retryDownload: (id) => ipcRenderer.invoke('nyra:retry-download', id),
  openDownloadFile: (id) => ipcRenderer.invoke('nyra:open-download-file', id),
  showDownloadInFolder: (id) => ipcRenderer.invoke('nyra:show-download-in-folder', id),
  removeDownload: (id) => ipcRenderer.invoke('nyra:remove-download', id),
  clearDownloads: () => ipcRenderer.invoke('nyra:clear-downloads'),
  chooseDownloadFolder: () => ipcRenderer.invoke('nyra:choose-download-folder'),
  openDownloadsFolder: () => ipcRenderer.invoke('nyra:open-downloads-folder'),
  getExtensions: () => ipcRenderer.invoke('nyra:get-extensions'),
  addExtension: () => ipcRenderer.invoke('nyra:add-extension'),
  setExtensionEnabled: (id, enabled) => ipcRenderer.invoke('nyra:set-extension-enabled', id, enabled),
  removeExtension: (id) => ipcRenderer.invoke('nyra:remove-extension', id),
  reloadExtension: (id) => ipcRenderer.invoke('nyra:reload-extension', id),
  openExtensionFolder: (id) => ipcRenderer.invoke('nyra:open-extension-folder', id),
  toggleDevTools: (webContentsId) => ipcRenderer.invoke('nyra:toggle-devtools', webContentsId),
  getPermissions: () => ipcRenderer.invoke('nyra:get-permissions'),
  setPermission: (permission) => ipcRenderer.invoke('nyra:set-permission', permission),
  removePermission: (domain, permission) => ipcRenderer.invoke('nyra:remove-permission', domain, permission),
  clearPermissions: () => ipcRenderer.invoke('nyra:clear-permissions'),
  getSiteData: () => ipcRenderer.invoke('nyra:get-site-data'),
  getSiteSummary: (url) => ipcRenderer.invoke('nyra:get-site-summary', url),
  clearSiteData: (domain) => ipcRenderer.invoke('nyra:clear-site-data', domain),
  clearAllSiteData: () => ipcRenderer.invoke('nyra:clear-all-site-data'),
  getDiagnostics: () => ipcRenderer.invoke('nyra:get-diagnostics'),
  repairBrowserCache: () => ipcRenderer.invoke('nyra:repair-browser-cache'),
  openStartupLog: () => ipcRenderer.invoke('nyra:open-startup-log'),
  openUserDataFolder: () => ipcRenderer.invoke('nyra:open-user-data-folder'),
  openCacheFolder: () => ipcRenderer.invoke('nyra:open-cache-folder'),
  getSavedLogins: () => ipcRenderer.invoke('nyra:get-saved-logins'),
  getLoginsForUrl: (url) => ipcRenderer.invoke('nyra:get-logins-for-url', url),
  getLoginSecret: (id) => ipcRenderer.invoke('nyra:get-login-secret', id),
  classifyLogin: (credential) => ipcRenderer.invoke('nyra:classify-login', credential),
  saveLogin: (credential) => ipcRenderer.invoke('nyra:save-login', credential),
  deleteSavedLogin: (id) => ipcRenderer.invoke('nyra:delete-saved-login', id),
  clearSavedLogins: () => ipcRenderer.invoke('nyra:clear-saved-logins'),
  neverSaveLogin: (url) => ipcRenderer.invoke('nyra:never-save-login', url),
  resolvePermissionPrompt: (id, value) => ipcRenderer.invoke('nyra:resolve-permission-prompt', id, value),
  openTrustedExternalUrl: (url) => ipcRenderer.invoke('nyra:open-trusted-external-url', url),
  openExternalWebUrl: (url) => ipcRenderer.invoke('nyra:open-external-web-url', url),
  checkForUpdates: () => ipcRenderer.invoke('nyra:check-for-updates'),
  getUpdateState: () => ipcRenderer.invoke('nyra:get-update-state'),
  installDownloadedUpdate: () => ipcRenderer.invoke('nyra:install-downloaded-update'),
  openDefaultAppsSettings: () => ipcRenderer.invoke('nyra:open-default-apps-settings'),
  onUpdateState: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, state) => callback(state);
    ipcRenderer.on('nyra:update-state', listener);
    return () => ipcRenderer.removeListener('nyra:update-state', listener);
  },
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
  onBookmarksDataChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, data) => callback(data);
    ipcRenderer.on('nyra:bookmarks-data-changed', listener);
    return () => ipcRenderer.removeListener('nyra:bookmarks-data-changed', listener);
  },
  onHistoryChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, history) => callback(history);
    ipcRenderer.on('nyra:history-changed', listener);
    return () => ipcRenderer.removeListener('nyra:history-changed', listener);
  },
  onDownloadsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, downloads) => callback(downloads);
    ipcRenderer.on('nyra:downloads-changed', listener);
    return () => ipcRenderer.removeListener('nyra:downloads-changed', listener);
  },
  onExtensionsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, extensions) => callback(extensions);
    ipcRenderer.on('nyra:extensions-changed', listener);
    return () => ipcRenderer.removeListener('nyra:extensions-changed', listener);
  },
  onPermissionsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, permissions) => callback(permissions);
    ipcRenderer.on('nyra:permissions-changed', listener);
    return () => ipcRenderer.removeListener('nyra:permissions-changed', listener);
  },
  onPermissionPrompt: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, prompt) => callback(prompt);
    ipcRenderer.on('nyra:permission-prompt', listener);
    return () => ipcRenderer.removeListener('nyra:permission-prompt', listener);
  },
  onShortcut: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, action) => callback(action);
    ipcRenderer.on('nyra:shortcut', listener);
    return () => ipcRenderer.removeListener('nyra:shortcut', listener);
  },
  onCommand: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, command) => callback(command);
    ipcRenderer.on('nyra:command', listener);
    return () => ipcRenderer.removeListener('nyra:command', listener);
  },
  onOpenUrlNewTab: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, url) => callback(url);
    ipcRenderer.on('nyra:open-url-new-tab', listener);
    return () => ipcRenderer.removeListener('nyra:open-url-new-tab', listener);
  },
  onWebviewFullscreenChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('nyra:webview-fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('nyra:webview-fullscreen-changed', listener);
  },
  onDevToolsState: (callback) => {
    if (typeof callback !== 'function') return () => {};

    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('nyra:devtools-state', listener);
    return () => ipcRenderer.removeListener('nyra:devtools-state', listener);
  }
  });
} else {
  installPasswordBridge();
}
