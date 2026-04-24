const { app, BrowserWindow, ipcMain, shell, session } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const { createStorage } = require('./src/storage');

const APP_SRC_DIR = path.resolve(__dirname, 'src');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:']);
let storage;

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
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(channel, payload);
  });
}

function installIpcHandlers() {
  ipcMain.handle('nyra:get-settings', () => storage.getSettings());
  ipcMain.handle('nyra:update-settings', (_event, settings) => {
    const nextSettings = storage.updateSettings(settings);
    broadcast('nyra:settings-changed', nextSettings);
    return nextSettings;
  });

  ipcMain.handle('nyra:load-session', () => storage.getSession());
  ipcMain.handle('nyra:save-session', (_event, tabs) => storage.saveSession({ tabs }));
  ipcMain.handle('nyra:reset-state', () => {
    const nextState = storage.resetState();
    broadcast('nyra:settings-changed', nextState.settings);
    broadcast('nyra:state-reset', nextState);
    return nextState;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: PRELOAD_PATH,
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true
    },
    title: 'Nyra',
    autoHideMenuBar: true
  });

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
  installSecurityHandlers();
  installIpcHandlers();
  createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
