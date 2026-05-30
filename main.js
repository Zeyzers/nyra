const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, shell, session, webContents } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const packageInfo = require('./package.json');
const { createStorage } = require('./src/storage');

const APP_SRC_DIR = path.resolve(__dirname, 'src');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:']);
const SHORTCUT_ACTIONS = new Map([
  ['Ctrl+L', 'focus-address-bar'],
  ['Ctrl+T', 'new-tab'],
  ['Ctrl+W', 'close-tab'],
  ['Ctrl+R', 'reload-tab'],
  ['Alt+Left', 'back'],
  ['Alt+Right', 'forward'],
  ['Ctrl+Shift+I', 'toggle-devtools'],
  ['F12', 'toggle-devtools']
]);
const TRUSTED_EXTERNAL_URLS = new Set([
  packageInfo.homepage,
  packageInfo.repository && packageInfo.repository.url
    ? packageInfo.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
    : undefined,
  packageInfo.bugs && packageInfo.bugs.url
].filter(Boolean));
let storage;
let downloads = [];
let nextDownloadId = 1;


function isAllowedLocalFile(url) {
  try {
    const filePath = path.resolve(fileURLToPath(url));
    return filePath === APP_SRC_DIR || filePath.startsWith(APP_SRC_DIR + path.sep);
  } catch {
    return false;
  }
}

function isAllowedWebNavigation(url) {
  try {
    const parsed = new URL(url);

    // Browser exception: Nyra's own new-tab page is a local file loaded in a
    // webview. Keep file access limited to the app's src directory.
    if (parsed.protocol === 'file:') return isAllowedLocalFile(url);

    return WEB_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeWebUrl(url) {
  try {
    const parsed = new URL(url);
    return WEB_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

function openAllowedExternalProtocol(url) {
  try {
    const parsed = new URL(url);
    if (!EXTERNAL_PROTOCOLS.has(parsed.protocol)) return false;

    shell.openExternal(url).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function hardenWebContents(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (openAllowedExternalProtocol(url)) return { action: 'deny' };

    // Web popups are intentionally blocked for now. Tabs/windows should only
    // be created by Nyra UI code so sites cannot spawn uncontrolled surfaces.
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (isAllowedWebNavigation(url)) return;

    event.preventDefault();
    openAllowedExternalProtocol(url);
  });

  contents.on('before-input-event', (event, input) => {
    if (contents.getType && contents.getType() === 'window') return;

    const action = getShortcutAction(input);
    if (!action) return;

    event.preventDefault();
    broadcast('nyra:shortcut', action);
  });

  contents.on('context-menu', (_event, params) => {
    showContextMenu(contents, params);
  });
}

function addMenuItem(items, item) {
  if (item) items.push(item);
}

function showContextMenu(contents, params) {
  const items = [];
  const isEditable = params.isEditable || params.inputFieldType !== 'none';
  const hasSelection = Boolean(params.selectionText && params.selectionText.trim());
  const linkUrl = params.linkURL || params.linkUrl || '';
  const imageUrl = params.srcURL || '';

  if (linkUrl) {
    addMenuItem(items, {
      label: 'Open Link in New Tab',
      click: () => broadcast('nyra:open-url-new-tab', linkUrl)
    });
    addMenuItem(items, {
      label: 'Copy Link Address',
      click: () => clipboard.writeText(linkUrl)
    });
    addMenuItem(items, { type: 'separator' });
  }

  if (imageUrl) {
    addMenuItem(items, {
      label: 'Copy Image Address',
      click: () => clipboard.writeText(imageUrl)
    });
    addMenuItem(items, {
      label: 'Save Image',
      click: () => contents.downloadURL(imageUrl)
    });
    addMenuItem(items, { type: 'separator' });
  }

  addMenuItem(items, {
    label: 'Back',
    enabled: typeof contents.canGoBack === 'function' && contents.canGoBack(),
    click: () => contents.goBack()
  });
  addMenuItem(items, {
    label: 'Forward',
    enabled: typeof contents.canGoForward === 'function' && contents.canGoForward(),
    click: () => contents.goForward()
  });
  addMenuItem(items, {
    label: 'Reload',
    click: () => contents.reload()
  });
  addMenuItem(items, { type: 'separator' });

  if (isEditable) {
    addMenuItem(items, { label: 'Cut', click: () => contents.cut() });
    addMenuItem(items, { label: 'Copy', click: () => contents.copy() });
    addMenuItem(items, { label: 'Paste', click: () => contents.paste() });
    addMenuItem(items, { type: 'separator' });
    addMenuItem(items, { label: 'Select All', click: () => contents.selectAll() });
  } else {
    addMenuItem(items, { label: 'Copy', enabled: hasSelection, click: () => contents.copy() });
    addMenuItem(items, { type: 'separator' });
    addMenuItem(items, { label: 'Select All', click: () => contents.selectAll() });
  }

  const ownerWindow = getContextMenuWindow(contents);
  if (!ownerWindow) return;

  Menu.buildFromTemplate(items).popup({ window: ownerWindow });
}

function getContextMenuWindow(contents) {
  return (
    BrowserWindow.fromWebContents(contents) ||
    (contents.hostWebContents && BrowserWindow.fromWebContents(contents.hostWebContents)) ||
    BrowserWindow.getFocusedWindow()
  );
}

function getShortcutAction(input) {
  const key = String(input.key || '');
  const keyAliases = {
    ArrowLeft: 'Left',
    ArrowRight: 'Right'
  };
  const normalizedKey = keyAliases[key] || (key.length === 1 ? key.toUpperCase() : key);
  const parts = [];

  if (input.control) parts.push('Ctrl');
  if (input.shift) parts.push('Shift');
  if (input.alt) parts.push('Alt');
  parts.push(normalizedKey);

  return SHORTCUT_ACTIONS.get(parts.join('+'));
}

function installSecurityHandlers() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    // Privacy-first default: deny all site permissions until Nyra exposes
    // explicit user-facing controls for each permission type.
    callback(false);
  });

  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });
}

function broadcast(channel, payload) {
  webContents.getAllWebContents().forEach((contents) => {
    if (contents.isDestroyed()) return;

    const url = contents.getURL();
    const isShellWindow = contents.getType && contents.getType() === 'window';
    if (!isShellWindow && !isAllowedLocalFile(url)) return;

    contents.send(channel, payload);
  });
}

function applyNativeTheme(settings) {
  const theme = settings.theme || 'dark';
  nativeTheme.themeSource = theme;
  updateWindowTheme(theme);
}

function resolveThemeMode(theme) {
  if (theme === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  return theme === 'light' ? 'light' : 'dark';
}

function getWindowThemeColors(theme) {
  return resolveThemeMode(theme) === 'light'
    ? { background: '#eef2f7', overlay: '#f8fafc', symbols: '#101827' }
    : { background: '#0b0f14', overlay: '#0d1218', symbols: '#f3f5f7' };
}

function updateWindowTheme(theme) {
  const colors = getWindowThemeColors(theme);

  BrowserWindow.getAllWindows().forEach((win) => {
    if (win.isDestroyed()) return;
    win.setBackgroundColor(colors.background);

    if (process.platform === 'win32' && typeof win.setTitleBarOverlay === 'function') {
      win.setTitleBarOverlay({
        color: colors.overlay,
        symbolColor: colors.symbols,
        height: 48
      });
    }
  });
}

function installIpcHandlers() {
  ipcMain.handle('nyra:get-settings', () => storage.getSettings());
  ipcMain.handle('nyra:update-settings', (_event, settings) => {
    const nextSettings = storage.updateSettings(settings);
    applyNativeTheme(nextSettings);
    broadcast('nyra:settings-changed', nextSettings);
    return nextSettings;
  });

  ipcMain.handle('nyra:load-session', () => storage.getSession());
  ipcMain.handle('nyra:save-session', (_event, tabs) => storage.saveSession({ tabs }));
  ipcMain.handle('nyra:get-bookmarks', () => storage.getBookmarks());
  ipcMain.handle('nyra:add-bookmark', (_event, bookmark) => {
    if (!bookmark || !isSafeWebUrl(bookmark.url)) {
      return storage.getBookmarks();
    }

    const bookmarks = storage.addBookmark(bookmark);
    broadcast('nyra:bookmarks-changed', bookmarks);
    return bookmarks;
  });
  ipcMain.handle('nyra:remove-bookmark', (_event, url) => {
    const bookmarks = storage.removeBookmark(url);
    broadcast('nyra:bookmarks-changed', bookmarks);
    return bookmarks;
  });
  ipcMain.handle('nyra:get-history', () => storage.getHistory());
  ipcMain.handle('nyra:add-history-entry', (_event, entry) => {
    if (!entry || !isSafeWebUrl(entry.url)) {
      return storage.getHistory();
    }

    const history = storage.addHistoryEntry(entry);
    broadcast('nyra:history-changed', history);
    return history;
  });
  ipcMain.handle('nyra:remove-history-entry', (_event, url) => {
    const history = storage.removeHistoryEntry(url);
    broadcast('nyra:history-changed', history);
    return history;
  });
  ipcMain.handle('nyra:clear-history', () => {
    const history = storage.clearHistory();
    broadcast('nyra:history-changed', history);
    return history;
  });
  ipcMain.handle('nyra:reset-state', () => {
    const nextState = storage.resetState();
    applyNativeTheme(nextState.settings);
    broadcast('nyra:settings-changed', nextState.settings);
    broadcast('nyra:bookmarks-changed', nextState.bookmarks);
    broadcast('nyra:history-changed', nextState.history);
    broadcast('nyra:state-reset', nextState);
    return nextState;
  });
  ipcMain.handle('nyra:get-app-info', () => ({
    name: 'Nyra',
    version: app.getVersion(),
    description: packageInfo.description,
    license: packageInfo.license || 'Not specified',
    repository: packageInfo.repository && packageInfo.repository.url
      ? packageInfo.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
      : '',
    homepage: packageInfo.homepage || '',
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node
  }));
  ipcMain.handle('nyra:get-downloads-info', () => ({
    folder: storage.getSettings().downloadPath || app.getPath('downloads'),
    defaultFolder: app.getPath('downloads')
  }));
  ipcMain.handle('nyra:get-downloads', () => downloads);
  ipcMain.handle('nyra:open-download-file', async (_event, id) => {
    const download = downloads.find((item) => item.id === id);
    if (!download || !download.savePath) return { ok: false };

    const errorMessage = await shell.openPath(download.savePath);
    return { ok: !errorMessage, error: errorMessage };
  });
  ipcMain.handle('nyra:show-download-in-folder', (_event, id) => {
    const download = downloads.find((item) => item.id === id);
    if (!download || !download.savePath) return { ok: false };

    shell.showItemInFolder(download.savePath);
    return { ok: true };
  });
  ipcMain.handle('nyra:remove-download', (_event, id) => {
    downloads = downloads.filter((item) => item.id !== id);
    broadcast('nyra:downloads-changed', downloads);
    return downloads;
  });
  ipcMain.handle('nyra:clear-downloads', () => {
    downloads = [];
    broadcast('nyra:downloads-changed', downloads);
    return downloads;
  });
  ipcMain.handle('nyra:choose-download-folder', async () => {
    const result = await dialog.showOpenDialog({
      defaultPath: storage.getSettings().downloadPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || !result.filePaths[0]) {
      return storage.getSettings();
    }

    const nextSettings = storage.updateSettings({ downloadPath: result.filePaths[0] });
    applyNativeTheme(nextSettings);
    broadcast('nyra:settings-changed', nextSettings);
    return nextSettings;
  });
  ipcMain.handle('nyra:open-downloads-folder', async () => {
    const errorMessage = await shell.openPath(storage.getSettings().downloadPath || app.getPath('downloads'));
    return { ok: !errorMessage, error: errorMessage };
  });
  ipcMain.handle('nyra:open-trusted-external-url', async (_event, url) => {
    if (!TRUSTED_EXTERNAL_URLS.has(url)) return { ok: false };

    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle('nyra:open-default-apps-settings', async () => {
    if (process.platform !== 'win32') return { ok: false };

    await shell.openExternal('ms-settings:defaultapps');
    return { ok: true };
  });
}

function installDownloadHandlers() {
  session.defaultSession.on('will-download', (_event, item) => {
    const settings = storage.getSettings();
    const downloadFolder = settings.downloadPath || app.getPath('downloads');
    const download = {
      id: nextDownloadId++,
      filename: item.getFilename(),
      state: 'downloading',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      percent: 0,
      savePath: '',
      url: item.getURL()
    };

    if (!settings.askDownloadLocation) {
      item.setSavePath(path.join(downloadFolder, item.getFilename()));
    } else {
      item.setSaveDialogOptions({
        defaultPath: path.join(downloadFolder, item.getFilename())
      });
    }

    downloads = [download, ...downloads].slice(0, 50);
    broadcast('nyra:downloads-changed', downloads);

    item.on('updated', (_event, state) => {
      download.state = state === 'interrupted' ? 'failed' : 'downloading';
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.percent = download.totalBytes > 0
        ? Math.round((download.receivedBytes / download.totalBytes) * 100)
        : 0;
      download.savePath = item.getSavePath();
      broadcast('nyra:downloads-changed', downloads);
    });

    item.once('done', (_event, state) => {
      download.state = state;
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.percent = state === 'completed'
        ? 100
        : download.totalBytes > 0
          ? Math.round((download.receivedBytes / download.totalBytes) * 100)
          : download.percent;
      download.savePath = item.getSavePath();
      broadcast('nyra:downloads-changed', downloads);
    });
  });
}

function windowOptionsForCurrentTheme() {
  const currentSettings = storage ? storage.getSettings() : { theme: 'dark' };
  const colors = getWindowThemeColors(currentSettings.theme);
  const windowOptions = {
    width: 1200,
    height: 800,
    backgroundColor: colors.background,
    darkTheme: resolveThemeMode(currentSettings.theme) === 'dark',
    webPreferences: {
      preload: PRELOAD_PATH,
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    },
    title: 'Nyra',
    autoHideMenuBar: true
  };

  if (process.platform === 'win32') {
    windowOptions.titleBarStyle = 'hidden';
    windowOptions.titleBarOverlay = {
      color: colors.overlay,
      symbolColor: colors.symbols,
      height: 48
    };
  }

  return windowOptions;
}

function createWindow() {
  const win = new BrowserWindow(windowOptionsForCurrentTheme());

  win.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;

    if (params && params.src && isAllowedLocalFile(params.src)) {
      webPreferences.preload = PRELOAD_PATH;
    } else {
      delete webPreferences.preload;
    }
  });

  win.loadFile('src/index.html');
}

app.whenReady().then(() => {
  storage = createStorage(app.getPath('userData'));
  applyNativeTheme(storage.getSettings());
  nativeTheme.on('updated', () => {
    if (storage.getSettings().theme === 'system') updateWindowTheme('system');
  });
  installSecurityHandlers();
  installIpcHandlers();
  installDownloadHandlers();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
