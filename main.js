const { app, BrowserView, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, safeStorage, shell, session, webContents } = require('electron');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { fileURLToPath } = require('url');
const { autoUpdater } = require('electron-updater');
const packageInfo = require('./package.json');
const { createPasswordStore } = require('./src/password-store');
const { createStorage, domainForUrl } = require('./src/storage');

const APP_SRC_DIR = path.resolve(__dirname, 'src');
const LOGO_PATH = path.join(APP_SRC_DIR, 'assets', 'NyraLogo.ico');
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const INTERNAL_PROTOCOLS = new Set(['about:', 'chrome:', 'chrome-extension:', 'devtools:']);
const EXTERNAL_PROTOCOLS = new Set(['mailto:', 'tel:']);
const SHORTCUT_ACTIONS = new Map([
  ['Ctrl+L', 'focus-address-bar'],
  ['Ctrl+T', 'new-tab'],
  ['Ctrl+W', 'close-tab'],
  ['Ctrl+R', 'reload-tab'],
  ['Ctrl+Shift+T', 'reopen-closed-tab'],
  ['Ctrl+=', 'zoom-in'],
  ['Ctrl++', 'zoom-in'],
  ['Ctrl+Shift+=', 'zoom-in'],
  ['Ctrl+Shift++', 'zoom-in'],
  ['Ctrl+-', 'zoom-out'],
  ['Ctrl+0', 'zoom-reset'],
  ['Ctrl+K', 'command-palette'],
  ['Ctrl+Shift+P', 'command-palette'],
  ['Alt+Left', 'back'],
  ['Alt+Right', 'forward'],
  ['Ctrl+Shift+I', 'toggle-devtools'],
  ['F12', 'toggle-devtools']
]);
const TRUSTED_EXTERNAL_URLS = new Set([
  packageInfo.homepage,
  'https://github.com/zeyzers/nyra/releases',
  packageInfo.repository && packageInfo.repository.url
    ? packageInfo.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')
    : undefined,
  packageInfo.bugs && packageInfo.bugs.url
].filter(Boolean));
const BLOCKED_REQUEST_DOMAINS = new Set([
  'doubleclick.net',
  'googlesyndication.com',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.net',
  'scorecardresearch.com'
]);
const SAFE_MODE = process.env.NYRA_SAFE_MODE === '1' || process.argv.includes('--safe-mode');
let storage;
let passwordStore;
let pendingPermissionPrompts = new Map();
let startupLogPath = path.join(process.env.TEMP || process.env.TMP || __dirname, 'nyra-startup.log');
const devtoolsDocks = new Map();
const loadedExtensions = new Map();
let autoUpdaterInitialized = false;
let updateState = {
  status: 'idle',
  currentVersion: packageInfo.version,
  latestVersion: '',
  releaseUrl: 'https://github.com/zeyzers/nyra/releases',
  message: '',
  error: '',
  percent: 0,
  transferred: 0,
  total: 0,
  downloaded: false,
  canInstall: false,
  packaged: false,
  manualOnly: true
};
const LAUNCH_COMMANDS = new Map([
  ['--nyra-new-tab', 'new-tab'],
  ['--nyra-private-tab', 'private-tab'],
  ['--nyra-history', 'history']
]);
let pendingLaunchCommand = null;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.zeyzer.nyra');
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.exit(0);
}

function startupLog(message, error) {
  const detail = error
    ? ` ${error.stack || error.message || String(error)}`
    : '';
  const line = `[${new Date().toISOString()}] ${message}${detail}`;

  console.log(line);
  if (!startupLogPath) return;

  try {
    fs.appendFileSync(startupLogPath, `${line}\n`);
  } catch {
    // Startup logging must never become another startup blocker.
  }
}

startupLog(`main loaded pid=${process.pid}${SAFE_MODE ? ' safe-mode' : ''}`);
setTimeout(() => {
  if (!started) startupLog(`startup watchdog appReady=${app.isReady()}`);
}, 10000);

function safeSettings(settings) {
  return SAFE_MODE
    ? {
      ...settings,
      restoreSession: false,
      startupBehavior: 'newtab',
      theme: 'dark'
    }
    : settings;
}

function chromeLikeUserAgent() {
  const chromeVersion = process.versions.chrome || '142.0.0.0';
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
}

function readStartupHardwareAcceleration() {
  if (SAFE_MODE) return true;

  try {
    const statePath = path.join(app.getPath('userData'), 'nyra-state.json');
    if (!fs.existsSync(statePath)) return true;

    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return parsed &&
      parsed.settings &&
      typeof parsed.settings.hardwareAcceleration === 'boolean'
      ? parsed.settings.hardwareAcceleration
      : true;
  } catch (error) {
    startupLog('hardware acceleration startup setting fallback', error);
    return true;
  }
}

app.userAgentFallback = chromeLikeUserAgent();
const hardwareAccelerationEnabledAtStartup = readStartupHardwareAcceleration();
if (!hardwareAccelerationEnabledAtStartup) {
  app.disableHardwareAcceleration();
}

process.on('uncaughtException', (error) => {
  startupLog('uncaughtException', error);
});

process.on('unhandledRejection', (error) => {
  startupLog('unhandledRejection', error);
});

pendingLaunchCommand = launchCommandFromArgs(process.argv);

app.on('second-instance', (_event, argv) => {
  dispatchLaunchCommand(launchCommandFromArgs(argv) || 'new-tab');
});

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
    if (INTERNAL_PROTOCOLS.has(parsed.protocol)) return true;

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

function isYoutubeUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'youtu.be' ||
      hostname === 'youtube-nocookie.com' ||
      hostname.endsWith('.youtube-nocookie.com');
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

function openDevToolsDock(ownerWindow, targetContents, senderContents) {
  if (!ownerWindow || ownerWindow.isDestroyed() || !targetContents || targetContents.isDestroyed()) {
    return false;
  }

  const targetId = targetContents.id;
  const currentDock = devtoolsDocks.get(ownerWindow.id);
  if (currentDock && currentDock.targetId !== targetId) closeDevToolsDock(ownerWindow);

  const existingDock = devtoolsDocks.get(ownerWindow.id);
  if (existingDock && existingDock.targetId === targetId) {
    updateDevToolsDockBounds(ownerWindow);
    return true;
  }

  const devtoolsView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  ownerWindow.addBrowserView(devtoolsView);
  devtoolsView.setBounds(devtoolsBoundsForWindow(ownerWindow));
  devtoolsView.setAutoResize({ width: false, height: true, horizontal: true, vertical: true });

  const dock = { view: devtoolsView, target: targetContents, targetId };
  devtoolsDocks.set(ownerWindow.id, dock);

  targetContents.removeAllListeners('devtools-closed');
  targetContents.on('devtools-closed', () => {
    if (senderContents && !senderContents.isDestroyed()) {
      senderContents.send('nyra:devtools-state', { webContentsId: targetId, open: false });
    }
    const latestDock = devtoolsDocks.get(ownerWindow.id);
    if (latestDock && latestDock.targetId === targetId && latestDock.view) {
      ownerWindow.removeBrowserView(latestDock.view);
      if (!latestDock.view.webContents.isDestroyed()) latestDock.view.webContents.close();
      devtoolsDocks.delete(ownerWindow.id);
    }
  });
  targetContents.setDevToolsWebContents(devtoolsView.webContents);
  targetContents.openDevTools();
  if (senderContents && !senderContents.isDestroyed()) {
    senderContents.send('nyra:devtools-state', { webContentsId: targetId, open: true });
  }
  return true;
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
  const selectedText = String(params.selectionText || '').trim();

  if (linkUrl) {
    addMenuItem(items, {
      label: 'Open Link in New Tab',
      click: () => broadcast('nyra:open-url-new-tab', linkUrl)
    });
    addMenuItem(items, {
      label: 'Save Link As...',
      click: () => contents.downloadURL(linkUrl)
    });
    addMenuItem(items, {
      label: 'Copy Link Address',
      click: () => clipboard.writeText(linkUrl)
    });
    addMenuItem(items, { type: 'separator' });
  }

  if (imageUrl) {
    addMenuItem(items, {
      label: 'Open Image in New Tab',
      click: () => broadcast('nyra:open-url-new-tab', imageUrl)
    });
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
    addMenuItem(items, {
      label: 'Search Selection',
      enabled: hasSelection,
      click: () => {
        const url = `https://duckduckgo.com/?q=${encodeURIComponent(selectedText)}`;
        broadcast('nyra:open-url-new-tab', url);
      }
    });
    addMenuItem(items, { type: 'separator' });
    addMenuItem(items, { label: 'Select All', click: () => contents.selectAll() });
  }

  if (!isEditable) {
    addMenuItem(items, { type: 'separator' });
    addMenuItem(items, {
      label: 'Inspect Element',
      click: () => {
        const ownerWindow = getContextMenuWindow(contents);
        if (!ownerWindow) return;

        openDevToolsDock(ownerWindow, contents, ownerWindow.webContents);
        contents.inspectElement(params.x || 0, params.y || 0);
      }
    });
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

function permissionName(permission) {
  const names = {
    media: 'camera',
    camera: 'camera',
    microphone: 'microphone',
    geolocation: 'geolocation',
    notifications: 'notifications'
  };
  return names[permission] || permission;
}

function isManagedSitePermission(permission) {
  return ['camera', 'microphone', 'geolocation', 'notifications'].includes(permissionName(permission));
}

function getPermissionWindow(contents) {
  return (
    BrowserWindow.fromWebContents(contents) ||
    (contents.hostWebContents && BrowserWindow.fromWebContents(contents.hostWebContents)) ||
    BrowserWindow.getFocusedWindow()
  );
}

function handleGuestHtmlFullscreen(contents, fullscreen) {
  const ownerWindow = (
    BrowserWindow.fromWebContents(contents) ||
    (contents.hostWebContents && BrowserWindow.fromWebContents(contents.hostWebContents))
  );

  if (!ownerWindow || ownerWindow.isDestroyed()) return;

  ownerWindow.setFullScreen(Boolean(fullscreen));
  ownerWindow.webContents.send('nyra:webview-fullscreen-changed', {
    webContentsId: contents.id,
    fullscreen: Boolean(fullscreen)
  });
}

function getOwnerShellContents(contents) {
  return contents.hostWebContents || contents.getOwnerBrowserWindow()?.webContents || null;
}

function installSecurityHandlers() {
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    if (permission === 'fullscreen') return true;
    if (!isManagedSitePermission(permission)) return true;

    const normalizedPermission = permissionName(permission);
    const domain = domainForUrl(requestingOrigin);
    const saved = domain ? storage.getPermission(domain, normalizedPermission) : null;
    if (saved) return saved.value === 'allow';
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details = {}) => {
    const normalizedPermission = permissionName(permission);
    const requestingUrl = details.requestingUrl || contents.getURL();
    const domain = domainForUrl(requestingUrl);

    if (normalizedPermission === 'fullscreen') {
      callback(true);
      return;
    }

    if (!domain || !isManagedSitePermission(normalizedPermission)) {
      callback(false);
      return;
    }

    const saved = storage.getPermission(domain, normalizedPermission);
    if (saved) {
      callback(saved.value === 'allow');
      return;
    }

    const ownerWindow = getPermissionWindow(contents);
    if (!ownerWindow || ownerWindow.isDestroyed()) {
      callback(false);
      return;
    }

    const id = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingPermissionPrompts.set(id, { callback, domain, permission: normalizedPermission });
    ownerWindow.webContents.send('nyra:permission-prompt', {
      id,
      domain,
      permission: normalizedPermission,
      url: requestingUrl
    });
  });

  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
    contents.on('enter-html-full-screen', () => handleGuestHtmlFullscreen(contents, true));
    contents.on('leave-html-full-screen', () => handleGuestHtmlFullscreen(contents, false));
  });
}

function isBlockedRequest(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return Array.from(BLOCKED_REQUEST_DOMAINS).some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function isYoutubeCompatibilityRequest(details = {}) {
  const urls = [
    details.url,
    details.referrer,
    details.initiator
  ].filter(Boolean);

  return urls.some((value) => {
    try {
      const hostname = new URL(value).hostname.replace(/^www\./, '');
      return hostname === 'youtube.com' ||
        hostname.endsWith('.youtube.com') ||
        hostname === 'youtu.be' ||
        hostname === 'youtube-nocookie.com' ||
        hostname.endsWith('.youtube-nocookie.com') ||
        hostname === 'googlevideo.com' ||
        hostname.endsWith('.googlevideo.com') ||
        hostname === 'ytimg.com' ||
        hostname.endsWith('.ytimg.com');
    } catch {
      return false;
    }
  });
}

function installAdBlocker() {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    callback({ cancel: !isYoutubeCompatibilityRequest(details) && isBlockedRequest(details.url) });
  });
}

function cookieOrigin(cookie) {
  const domain = String(cookie.domain || '').replace(/^\./, '');
  if (!domain) return '';

  return `${cookie.secure ? 'https' : 'http'}://${domain}`;
}

async function getSiteDataSummary() {
  const cookies = await session.defaultSession.cookies.get({});
  const domains = new Map();

  cookies.forEach((cookie) => {
    const domain = String(cookie.domain || '').replace(/^\./, '').replace(/^www\./, '');
    if (!domain) return;

    const existing = domains.get(domain) || { domain, cookies: 0 };
    existing.cookies += 1;
    domains.set(domain, existing);
  });

  return Array.from(domains.values()).sort((a, b) => a.domain.localeCompare(b.domain));
}

async function getSiteSummary(url) {
  const domain = domainForUrl(url);
  const origin = (() => {
    try {
      const parsed = new URL(url);
      return WEB_PROTOCOLS.has(parsed.protocol) ? parsed.origin : '';
    } catch {
      return '';
    }
  })();
  if (!domain || !origin) {
    return {
      domain: '',
      cookies: 0,
      savedLogins: 0
    };
  }

  const cookies = await session.defaultSession.cookies.get({});
  const cookieCount = cookies.filter((cookie) => {
    const cookieDomain = String(cookie.domain || '').replace(/^\./, '').replace(/^www\./, '');
    return cookieDomain === domain || cookieDomain.endsWith(`.${domain}`);
  }).length;
  const loginInfo = passwordStore
    ? passwordStore.findLoginsForUrl(url)
    : { logins: [] };

  return {
    domain,
    origin,
    cookies: cookieCount,
    savedLogins: Array.isArray(loginInfo.logins) ? loginInfo.logins.length : 0
  };
}

async function clearSiteDataForDomain(domain) {
  const normalizedDomain = String(domain || '').replace(/^\./, '').replace(/^www\./, '');
  if (!normalizedDomain) return getSiteDataSummary();

  const cookies = await session.defaultSession.cookies.get({});
  await Promise.all(cookies
    .filter((cookie) => {
      const cookieDomain = String(cookie.domain || '').replace(/^\./, '').replace(/^www\./, '');
      return cookieDomain === normalizedDomain || cookieDomain.endsWith(`.${normalizedDomain}`);
    })
    .map((cookie) => {
      const origin = cookieOrigin(cookie);
      return origin ? session.defaultSession.cookies.remove(origin, cookie.name) : Promise.resolve();
    }));

  await session.defaultSession.clearStorageData({
    origin: `https://${normalizedDomain}`,
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage']
  }).catch(() => {});

  return getSiteDataSummary();
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function readStartupLogTail(maxLines = 80) {
  try {
    if (!startupLogPath || !fs.existsSync(startupLogPath)) return [];
    const lines = fs.readFileSync(startupLogPath, 'utf8').trim().split(/\r?\n/);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function diagnosticCachePaths() {
  const userData = app.getPath('userData');
  return ['Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'GrShaderCache', 'ShaderCache']
    .map((name) => path.join(userData, name));
}

function getDiagnostics() {
  const settings = storage.getSettings();
  const state = storage.getState();
  const gpuStatus = typeof app.getGPUFeatureStatus === 'function'
    ? app.getGPUFeatureStatus()
    : {};

  return {
    app: {
      name: 'Nyra',
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      safeMode: SAFE_MODE
    },
    runtime: {
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      node: process.versions.node
    },
    paths: {
      userData: app.getPath('userData'),
      downloads: app.getPath('downloads'),
      stateFile: storage.filePath,
      startupLog: startupLogPath,
      cachePaths: diagnosticCachePaths()
    },
    settings: {
      theme: settings.theme,
      hardwareAcceleration: settings.hardwareAcceleration,
      hardwareAccelerationEnabledAtStartup
    },
    counts: {
      bookmarks: state.bookmarks.length,
      history: state.history.length,
      downloads: state.downloads.length,
      extensions: state.extensions.length,
      permissions: state.permissions.length
    },
    gpuStatus,
    startupLogTail: readStartupLogTail()
  };
}

async function repairBrowserCache() {
  const userData = app.getPath('userData');
  const result = {
    ok: true,
    clearedHttpCache: false,
    removed: [],
    failed: []
  };

  try {
    await session.defaultSession.clearCache();
    result.clearedHttpCache = true;
  } catch (error) {
    result.ok = false;
    result.failed.push({
      path: 'session.defaultSession.clearCache',
      error: error && error.message ? error.message : String(error)
    });
  }

  diagnosticCachePaths().forEach((cachePath) => {
    try {
      if (!isPathInside(userData, cachePath) || !fs.existsSync(cachePath)) return;
      fs.rmSync(cachePath, { recursive: true, force: true });
      result.removed.push(cachePath);
    } catch (error) {
      result.ok = false;
      result.failed.push({
        path: cachePath,
        error: error && error.message ? error.message : String(error)
      });
    }
  });

  return result;
}

function isTrustedExternalUrl(url) {
  if (TRUSTED_EXTERNAL_URLS.has(url)) return true;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      (parsed.pathname === '/zeyzers/nyra' || parsed.pathname.startsWith('/zeyzers/nyra/'));
  } catch {
    return false;
  }
}

function compareVersions(left, right) {
  const leftParts = String(left || '').replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || '').replace(/^v/i, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `Nyra/${app.getVersion()}`
      },
      timeout: 8000
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub returned ${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Update check timed out'));
    });
    request.on('error', reject);
  });
}

async function checkForUpdates() {
  const currentVersion = app.getVersion();

  if (app.isPackaged && !SAFE_MODE) {
    setupAutoUpdater();
    updateState = {
      ...updateState,
      status: 'checking',
      currentVersion,
      error: '',
      message: 'Checking for updates...',
      packaged: true,
      manualOnly: false
    };
    broadcastUpdateState();

    try {
      await autoUpdater.checkForUpdates();
      return updateState;
    } catch (error) {
      updateState = {
        ...updateState,
        status: 'error',
        error: error && error.message ? error.message : String(error),
        message: 'Update check failed.',
        packaged: true,
        manualOnly: false
      };
      broadcastUpdateState();
      return updateState;
    }
  }

  try {
    const release = await fetchJson('https://api.github.com/repos/zeyzers/nyra/releases/latest');
    const latestVersion = String(release.tag_name || release.name || '').replace(/^v/i, '');
    const releaseUrl = release.html_url || 'https://github.com/zeyzers/nyra/releases';
    updateState = {
      ...updateState,
      status: compareVersions(latestVersion, currentVersion) > 0 ? 'available' : 'not-available',
      currentVersion,
      latestVersion,
      releaseUrl,
      message: app.isPackaged
        ? 'A release is available.'
        : 'Development builds can check releases but cannot install updates automatically.',
      publishedAt: release.published_at || '',
      isNewer: compareVersions(latestVersion, currentVersion) > 0,
      ok: true,
      packaged: app.isPackaged,
      manualOnly: !app.isPackaged || SAFE_MODE,
      canInstall: false,
      downloaded: false,
      error: ''
    };
    return updateState;
  } catch (error) {
    updateState = {
      ...updateState,
      status: 'error',
      currentVersion,
      latestVersion: '',
      releaseUrl: 'https://github.com/zeyzers/nyra/releases',
      isNewer: false,
      ok: false,
      packaged: app.isPackaged,
      manualOnly: !app.isPackaged || SAFE_MODE,
      canInstall: false,
      downloaded: false,
      message: 'Update check failed.',
      error: error && error.message ? error.message : String(error)
    };
    return updateState;
  }
}

function publicUpdateState() {
  return {
    ...updateState,
    currentVersion: app.isReady() ? app.getVersion() : packageInfo.version,
    packaged: app.isPackaged,
    manualOnly: !app.isPackaged || SAFE_MODE
  };
}

function broadcastUpdateState() {
  broadcast('nyra:update-state', publicUpdateState());
}

function setupAutoUpdater() {
  if (autoUpdaterInitialized) return;
  autoUpdaterInitialized = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    updateState = {
      ...updateState,
      status: 'checking',
      message: 'Checking for updates...',
      error: '',
      packaged: true,
      manualOnly: false
    };
    broadcastUpdateState();
  });

  autoUpdater.on('update-available', (info) => {
    updateState = {
      ...updateState,
      status: 'available',
      latestVersion: info && info.version ? info.version : updateState.latestVersion,
      releaseUrl: info && info.releaseNotes ? updateState.releaseUrl : updateState.releaseUrl,
      message: 'Update available. Starting download...',
      isNewer: true,
      error: '',
      packaged: true,
      manualOnly: false
    };
    broadcastUpdateState();
    autoUpdater.downloadUpdate().catch((error) => {
      updateState = {
        ...updateState,
        status: 'error',
        message: 'Update download failed.',
        error: error && error.message ? error.message : String(error)
      };
      broadcastUpdateState();
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    updateState = {
      ...updateState,
      status: 'not-available',
      latestVersion: info && info.version ? info.version : app.getVersion(),
      message: 'Nyra is up to date.',
      isNewer: false,
      error: '',
      packaged: true,
      manualOnly: false
    };
    broadcastUpdateState();
  });

  autoUpdater.on('download-progress', (progress) => {
    updateState = {
      ...updateState,
      status: 'downloading',
      message: 'Downloading update...',
      percent: Number(progress.percent || 0),
      transferred: Number(progress.transferred || 0),
      total: Number(progress.total || 0),
      error: ''
    };
    broadcastUpdateState();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateState = {
      ...updateState,
      status: 'downloaded',
      latestVersion: info && info.version ? info.version : updateState.latestVersion,
      message: 'Update downloaded. Restart Nyra to install.',
      downloaded: true,
      canInstall: true,
      percent: 100,
      error: ''
    };
    broadcastUpdateState();
  });

  autoUpdater.on('error', (error) => {
    updateState = {
      ...updateState,
      status: 'error',
      message: 'Update failed.',
      error: error && error.message ? error.message : String(error)
    };
    broadcastUpdateState();
  });
}

function installDownloadedUpdate() {
  if (!app.isPackaged || !updateState.canInstall) {
    return { ok: false, error: 'No downloaded update is ready to install.' };
  }

  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { ok: true };
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

function launchCommandFromArgs(args = []) {
  const match = args.find((arg) => LAUNCH_COMMANDS.has(arg));
  return match ? LAUNCH_COMMANDS.get(match) : null;
}

function dispatchLaunchCommand(command) {
  if (!command) return;

  const [win] = BrowserWindow.getAllWindows();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }

  broadcast('nyra:command', command);
}

function installWindowsUserTasks() {
  if (process.platform !== 'win32') return;

  app.setUserTasks([
    {
      program: process.execPath,
      arguments: '--nyra-new-tab',
      iconPath: LOGO_PATH,
      iconIndex: 0,
      title: 'New Tab',
      description: 'Open a new Nyra tab'
    },
    {
      program: process.execPath,
      arguments: '--nyra-private-tab',
      iconPath: LOGO_PATH,
      iconIndex: 0,
      title: 'Private Tab',
      description: 'Open a private Nyra tab'
    },
    {
      program: process.execPath,
      arguments: '--nyra-history',
      iconPath: LOGO_PATH,
      iconIndex: 0,
      title: 'History',
      description: 'Open Nyra history'
    }
  ]);
}

function extensionSummary() {
  return storage.getExtensions().map((extension) => ({
    ...extension,
    loaded: Boolean(extension.extensionId && loadedExtensions.has(extension.extensionId))
  }));
}

function readExtensionManifest(extensionPath) {
  const manifestPath = path.join(extensionPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found');
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object') throw new Error('Invalid manifest.json');
  if (manifest.manifest_version !== 2 && manifest.manifest_version !== 3) {
    throw new Error('Only Manifest V2/V3 unpacked extensions are supported');
  }

  const permissions = [
    ...(Array.isArray(manifest.permissions) ? manifest.permissions : []),
    ...(Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [])
  ]
    .filter((permission) => typeof permission === 'string' && permission.trim())
    .map((permission) => permission.trim());

  return {
    name: typeof manifest.name === 'string' && manifest.name.trim()
      ? manifest.name.trim()
      : 'Unpacked extension',
    version: typeof manifest.version === 'string' ? manifest.version : '',
    manifestVersion: manifest.manifest_version,
    permissions: Array.from(new Set(permissions)).sort()
  };
}

async function loadNyraExtension(extension) {
  if (!extension || !extension.enabled || !extension.path || SAFE_MODE) return extensionSummary();

  try {
    const manifest = readExtensionManifest(extension.path);
    const loaded = await session.defaultSession.loadExtension(extension.path, {
      allowFileAccess: false
    });
    loadedExtensions.set(loaded.id, loaded);

    storage.updateExtension(extension.id, {
      extensionId: loaded.id,
      name: loaded.name || extension.name,
      version: loaded.version || extension.version,
      manifestVersion: manifest.manifestVersion,
      permissions: manifest.permissions,
      lastError: ''
    });
  } catch (error) {
    storage.updateExtension(extension.id, {
      enabled: false,
      lastError: error && error.message ? error.message : String(error)
    });
  }

  return extensionSummary();
}

async function unloadNyraExtension(extension) {
  if (!extension) return extensionSummary();

  const extensionId = extension.extensionId;
  if (extensionId && loadedExtensions.has(extensionId)) {
    try {
      await session.defaultSession.removeExtension(extensionId);
    } catch (error) {
      startupLog(`extension unload failed: ${extension.name || extensionId}`, error);
    }
    loadedExtensions.delete(extensionId);
  }

  return extensionSummary();
}

async function loadConfiguredExtensions() {
  if (SAFE_MODE) return;

  const extensions = storage.getExtensions().filter((extension) => extension.enabled);
  for (const extension of extensions) {
    await loadNyraExtension(extension);
  }
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
  ipcMain.on('nyra:renderer-ready', () => {
    startupLog('renderer ready');
    if (pendingLaunchCommand) {
      dispatchLaunchCommand(pendingLaunchCommand);
      pendingLaunchCommand = null;
    }
  });
  ipcMain.on('nyra:startup-log', (_event, message) => {
    startupLog(`renderer: ${message}`);
  });
  ipcMain.handle('nyra:is-safe-mode', () => SAFE_MODE);
  ipcMain.handle('nyra:get-settings', () => safeSettings(storage.getSettings()));
  ipcMain.handle('nyra:update-settings', (_event, settings) => {
    const nextSettings = storage.updateSettings(settings);
    applyNativeTheme(nextSettings);
    broadcast('nyra:settings-changed', nextSettings);
    return nextSettings;
  });

  ipcMain.handle('nyra:load-session', () => (SAFE_MODE ? { tabs: [] } : storage.getSession()));
  ipcMain.handle('nyra:save-session', (_event, tabs) => storage.saveSession({ tabs }));
  ipcMain.on('nyra:save-session-sync', (event, tabs) => {
    storage.saveSession({ tabs });
    event.returnValue = true;
  });
  ipcMain.handle('nyra:get-bookmarks', () => storage.getBookmarks());
  ipcMain.handle('nyra:get-bookmarks-data', () => storage.getBookmarksData());
  ipcMain.handle('nyra:add-bookmark', (_event, bookmark) => {
    if (!bookmark || !isSafeWebUrl(bookmark.url)) {
      return storage.getBookmarks();
    }

    const bookmarks = storage.addBookmark(bookmark);
    broadcast('nyra:bookmarks-changed', bookmarks);
    broadcast('nyra:bookmarks-data-changed', storage.getBookmarksData());
    return bookmarks;
  });
  ipcMain.handle('nyra:update-bookmark', (_event, id, updates) => {
    const bookmarks = storage.updateBookmark(id, updates);
    broadcast('nyra:bookmarks-changed', bookmarks);
    broadcast('nyra:bookmarks-data-changed', storage.getBookmarksData());
    return bookmarks;
  });
  ipcMain.handle('nyra:remove-bookmark', (_event, url) => {
    const bookmarks = storage.removeBookmark(url);
    broadcast('nyra:bookmarks-changed', bookmarks);
    broadcast('nyra:bookmarks-data-changed', storage.getBookmarksData());
    return bookmarks;
  });
  ipcMain.handle('nyra:reorder-bookmarks', (_event, bookmarkIds) => {
    const bookmarks = storage.reorderBookmarks(bookmarkIds);
    broadcast('nyra:bookmarks-changed', bookmarks);
    broadcast('nyra:bookmarks-data-changed', storage.getBookmarksData());
    return bookmarks;
  });
  ipcMain.handle('nyra:create-bookmark-folder', (_event, folder) => {
    const data = storage.createBookmarkFolder(folder);
    broadcast('nyra:bookmarks-changed', data.bookmarks);
    broadcast('nyra:bookmarks-data-changed', data);
    return data;
  });
  ipcMain.handle('nyra:update-bookmark-folder', (_event, id, updates) => {
    const data = storage.updateBookmarkFolder(id, updates);
    broadcast('nyra:bookmarks-changed', data.bookmarks);
    broadcast('nyra:bookmarks-data-changed', data);
    return data;
  });
  ipcMain.handle('nyra:remove-bookmark-folder', (_event, id) => {
    const data = storage.removeBookmarkFolder(id);
    broadcast('nyra:bookmarks-changed', data.bookmarks);
    broadcast('nyra:bookmarks-data-changed', data);
    return data;
  });
  ipcMain.handle('nyra:import-bookmarks-html', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'Bookmarks HTML', extensions: ['html', 'htm'] }],
      properties: ['openFile']
    });
    if (result.canceled || !result.filePaths[0]) return storage.getBookmarksData();

    const html = fs.readFileSync(result.filePaths[0], 'utf8');
    const data = storage.importBookmarksHtml(html);
    broadcast('nyra:bookmarks-changed', data.bookmarks);
    broadcast('nyra:bookmarks-data-changed', data);
    return data;
  });
  ipcMain.handle('nyra:export-bookmarks-html', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: path.join(app.getPath('documents'), 'nyra-bookmarks.html'),
      filters: [{ name: 'Bookmarks HTML', extensions: ['html'] }]
    });
    if (result.canceled || !result.filePath) return { ok: false };

    fs.writeFileSync(result.filePath, storage.exportBookmarksHtml());
    return { ok: true, filePath: result.filePath };
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
    broadcast('nyra:bookmarks-data-changed', storage.getBookmarksData());
    broadcast('nyra:downloads-changed', nextState.downloads);
    broadcast('nyra:permissions-changed', nextState.permissions);
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
  ipcMain.handle('nyra:get-downloads', () => (SAFE_MODE ? [] : getDownloadsWithFileState()));
  ipcMain.handle('nyra:open-download-file', async (_event, id) => {
    const download = storage.getDownloads().find((item) => item.id === String(id));
    if (!download || !download.savePath) return { ok: false };

    const errorMessage = await shell.openPath(download.savePath);
    return { ok: !errorMessage, error: errorMessage };
  });
  ipcMain.handle('nyra:show-download-in-folder', (_event, id) => {
    const download = storage.getDownloads().find((item) => item.id === String(id));
    if (!download || !download.savePath) return { ok: false };

    shell.showItemInFolder(download.savePath);
    return { ok: true };
  });
  ipcMain.handle('nyra:remove-download', (_event, id) => {
    const downloads = storage.removeDownload(String(id));
    broadcast('nyra:downloads-changed', getDownloadsWithFileState());
    return downloads;
  });
  ipcMain.handle('nyra:clear-downloads', () => {
    const downloads = storage.clearDownloads();
    broadcast('nyra:downloads-changed', downloads);
    return downloads;
  });
  ipcMain.handle('nyra:get-extensions', () => extensionSummary());
  ipcMain.handle('nyra:add-extension', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose unpacked extension folder',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return extensionSummary();

    const extensionPath = result.filePaths[0];
    let manifest;
    try {
      manifest = readExtensionManifest(extensionPath);
    } catch (error) {
      return {
        error: error && error.message ? error.message : String(error),
        extensions: extensionSummary()
      };
    }

    const existing = storage.getExtensions().find((extension) => (
      extension.path.toLowerCase() === extensionPath.toLowerCase()
    ));
    const extensions = storage.upsertExtension({
      ...(existing || {}),
      path: extensionPath,
      enabled: true,
      name: manifest.name,
      version: manifest.version,
      manifestVersion: manifest.manifestVersion,
      permissions: manifest.permissions,
      lastError: ''
    });
    const extension = extensions.find((item) => item.path.toLowerCase() === extensionPath.toLowerCase());
    await loadNyraExtension(extension);
    const nextExtensions = extensionSummary();
    broadcast('nyra:extensions-changed', nextExtensions);
    return { extensions: nextExtensions };
  });
  ipcMain.handle('nyra:set-extension-enabled', async (_event, id, enabled) => {
    const [current] = storage.getExtensions().filter((extension) => extension.id === id || extension.extensionId === id);
    if (!current) return extensionSummary();

    const [updated] = storage.updateExtension(current.id, {
      enabled: Boolean(enabled),
      lastError: ''
    }).filter((extension) => extension.id === current.id);

    if (updated.enabled) {
      await loadNyraExtension(updated);
    } else {
      await unloadNyraExtension(updated);
    }

    const nextExtensions = extensionSummary();
    broadcast('nyra:extensions-changed', nextExtensions);
    return nextExtensions;
  });
  ipcMain.handle('nyra:remove-extension', async (_event, id) => {
    const [current] = storage.getExtensions().filter((extension) => extension.id === id || extension.extensionId === id);
    if (!current) return extensionSummary();

    await unloadNyraExtension(current);
    const extensions = storage.removeExtension(current.id);
    const nextExtensions = extensions.map((extension) => ({
      ...extension,
      loaded: Boolean(extension.extensionId && loadedExtensions.has(extension.extensionId))
    }));
    broadcast('nyra:extensions-changed', nextExtensions);
    return nextExtensions;
  });
  ipcMain.handle('nyra:reload-extension', async (_event, id) => {
    const [current] = storage.getExtensions().filter((extension) => extension.id === id || extension.extensionId === id);
    if (!current) return extensionSummary();

    await unloadNyraExtension(current);
    const [enabled] = storage.updateExtension(current.id, { enabled: true, lastError: '' })
      .filter((extension) => extension.id === current.id);
    await loadNyraExtension(enabled);
    const nextExtensions = extensionSummary();
    broadcast('nyra:extensions-changed', nextExtensions);
    return nextExtensions;
  });
  ipcMain.handle('nyra:open-extension-folder', async (_event, id) => {
    const [current] = storage.getExtensions().filter((extension) => extension.id === id || extension.extensionId === id);
    if (!current || !current.path) return { ok: false };

    const errorMessage = await shell.openPath(current.path);
    return { ok: !errorMessage, error: errorMessage };
  });
  ipcMain.handle('nyra:get-permissions', () => (SAFE_MODE ? [] : storage.getPermissions()));
  ipcMain.handle('nyra:set-permission', (_event, permission) => {
    const permissions = storage.setPermission(permission);
    broadcast('nyra:permissions-changed', permissions);
    return permissions;
  });
  ipcMain.handle('nyra:remove-permission', (_event, domain, permission) => {
    const permissions = storage.removePermission(domain, permission);
    broadcast('nyra:permissions-changed', permissions);
    return permissions;
  });
  ipcMain.handle('nyra:clear-permissions', () => {
    const permissions = storage.clearPermissions();
    broadcast('nyra:permissions-changed', permissions);
    return permissions;
  });
  ipcMain.handle('nyra:get-site-data', () => getSiteDataSummary());
  ipcMain.handle('nyra:get-site-summary', (_event, url) => getSiteSummary(url));
  ipcMain.handle('nyra:clear-site-data', (_event, domain) => clearSiteDataForDomain(domain));
  ipcMain.handle('nyra:clear-all-site-data', async () => {
    await session.defaultSession.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage']
    });
    return getSiteDataSummary();
  });
  ipcMain.handle('nyra:get-diagnostics', () => getDiagnostics());
  ipcMain.handle('nyra:repair-browser-cache', () => repairBrowserCache());
  ipcMain.handle('nyra:open-startup-log', async () => {
    if (!startupLogPath || !fs.existsSync(startupLogPath)) return { ok: false };

    const errorMessage = await shell.openPath(startupLogPath);
    return { ok: !errorMessage, error: errorMessage };
  });
  ipcMain.handle('nyra:open-user-data-folder', async () => {
    const errorMessage = await shell.openPath(app.getPath('userData'));
    return { ok: !errorMessage, error: errorMessage };
  });
  ipcMain.handle('nyra:open-cache-folder', async () => {
    const cachePath = path.join(app.getPath('userData'), 'Cache');
    const target = fs.existsSync(cachePath) ? cachePath : app.getPath('userData');
    const errorMessage = await shell.openPath(target);
    return { ok: !errorMessage, error: errorMessage };
  });
  ipcMain.handle('nyra:get-saved-logins', () => passwordStore.listLogins());
  ipcMain.handle('nyra:get-logins-for-url', (_event, url) => passwordStore.findLoginsForUrl(url));
  ipcMain.handle('nyra:get-login-secret', (_event, id) => passwordStore.getLoginSecret(id));
  ipcMain.handle('nyra:classify-login', (_event, credential) => passwordStore.classifyLogin(credential || {}));
  ipcMain.handle('nyra:save-login', (_event, credential) => passwordStore.saveLogin(credential || {}));
  ipcMain.handle('nyra:delete-saved-login', (_event, id) => passwordStore.deleteLogin(id));
  ipcMain.handle('nyra:clear-saved-logins', () => passwordStore.clearLogins());
  ipcMain.handle('nyra:never-save-login', (_event, url) => passwordStore.neverSaveForUrl(url));
  ipcMain.handle('nyra:resolve-permission-prompt', (_event, id, value) => {
    const prompt = pendingPermissionPrompts.get(id);
    if (!prompt) return storage.getPermissions();

    pendingPermissionPrompts.delete(id);
    const allowed = value === 'allow';
    const permissions = storage.setPermission({
      domain: prompt.domain,
      permission: prompt.permission,
      value: allowed ? 'allow' : 'deny'
    });
    prompt.callback(allowed);
    broadcast('nyra:permissions-changed', permissions);
    return permissions;
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
  ipcMain.handle('nyra:toggle-devtools', (event, webContentsId) => {
    const targetId = Number(webContentsId);
    if (!Number.isInteger(targetId)) return { ok: false };

    const targetContents = webContents.fromId(targetId);
    if (!targetContents || targetContents.isDestroyed()) return { ok: false };

    const ownerContents = getOwnerShellContents(targetContents);
    if (ownerContents && ownerContents.id !== event.sender.id) return { ok: false };

    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    if (!ownerWindow || ownerWindow.isDestroyed()) return { ok: false };

    const currentDock = devtoolsDocks.get(ownerWindow.id);
    if (currentDock && currentDock.targetId === targetId) {
      closeDevToolsDock(ownerWindow);
      return { ok: true, opened: false };
    }

    if (!openDevToolsDock(ownerWindow, targetContents, event.sender)) return { ok: false };

    return { ok: true, opened: true };
  });
  ipcMain.handle('nyra:open-trusted-external-url', async (_event, url) => {
    if (!isTrustedExternalUrl(url)) return { ok: false };

    await shell.openExternal(url);
    return { ok: true };
  });
  ipcMain.handle('nyra:check-for-updates', () => checkForUpdates());
  ipcMain.handle('nyra:get-update-state', () => publicUpdateState());
  ipcMain.handle('nyra:install-downloaded-update', () => installDownloadedUpdate());
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
    const startedAt = new Date().toISOString();
    const download = {
      id: `download-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      filename: item.getFilename(),
      state: 'downloading',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      percent: 0,
      savePath: '',
      url: item.getURL(),
      startedAt,
      completedAt: ''
    };

    if (!settings.askDownloadLocation) {
      item.setSavePath(path.join(downloadFolder, item.getFilename()));
    } else {
      item.setSaveDialogOptions({
        defaultPath: path.join(downloadFolder, item.getFilename())
      });
    }

    storage.upsertDownload(download);
    broadcast('nyra:downloads-changed', getDownloadsWithFileState());

    item.on('updated', (_event, state) => {
      download.state = state === 'interrupted' ? 'failed' : 'downloading';
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.percent = download.totalBytes > 0
        ? Math.round((download.receivedBytes / download.totalBytes) * 100)
        : 0;
      download.savePath = item.getSavePath();
      storage.upsertDownload(download);
      broadcast('nyra:downloads-changed', getDownloadsWithFileState());
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
      download.completedAt = new Date().toISOString();
      storage.upsertDownload(download);
      broadcast('nyra:downloads-changed', getDownloadsWithFileState());
    });
  });
}

function getDownloadsWithFileState() {
  return storage.getDownloads().map((download) => {
    if (download.state === 'completed' && download.savePath && !fs.existsSync(download.savePath)) {
      return { ...download, state: 'missing' };
    }
    return download;
  });
}

function devtoolsBoundsForWindow(win) {
  const [width, height] = win.getContentSize();
  const dockWidth = Math.min(560, Math.max(360, Math.round(width * 0.38)));
  const topOffset = 106;

  return {
    x: Math.max(0, width - dockWidth),
    y: topOffset,
    width: dockWidth,
    height: Math.max(240, height - topOffset)
  };
}

function updateDevToolsDockBounds(win) {
  if (!win || win.isDestroyed()) return;

  const dock = devtoolsDocks.get(win.id);
  if (!dock || !dock.view) return;

  dock.view.setBounds(devtoolsBoundsForWindow(win));
}

function closeDevToolsDock(win) {
  if (!win || win.isDestroyed()) return;

  const dock = devtoolsDocks.get(win.id);
  if (!dock) return;

  if (dock.target && !dock.target.isDestroyed() && dock.target.isDevToolsOpened()) {
    dock.target.closeDevTools();
  }
  if (dock.view) {
    win.removeBrowserView(dock.view);
    if (!dock.view.webContents.isDestroyed()) dock.view.webContents.close();
  }
  devtoolsDocks.delete(win.id);
  win.webContents.send('nyra:devtools-state', { webContentsId: dock.targetId, open: false });
}

function windowOptionsForCurrentTheme(useTitleBarOverlay = true) {
  const currentSettings = storage ? storage.getSettings() : { theme: 'dark' };
  const colors = getWindowThemeColors(currentSettings.theme);
  const windowOptions = {
    width: 1200,
    height: 800,
    show: false,
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
    icon: LOGO_PATH,
    fullscreenable: true,
    autoHideMenuBar: true
  };

  if (useTitleBarOverlay && process.platform === 'win32') {
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
  let win;
  try {
    win = new BrowserWindow(windowOptionsForCurrentTheme());
  } catch (error) {
    startupLog('BrowserWindow creation failed with theme titlebar options; retrying safe window options', error);
    win = new BrowserWindow(windowOptionsForCurrentTheme(false));
  }

  startupLog('window created');
  let shown = false;
  const showWindow = (reason) => {
    if (shown || win.isDestroyed()) return;

    shown = true;
    win.show();
    win.focus();
    startupLog(`window shown (${reason})`);
  };

  win.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.experimentalFeatures = true;
    webPreferences.plugins = true;

    if (params && isAllowedLocalFile(params.src)) {
      webPreferences.preload = PRELOAD_PATH;
    } else if (
      params &&
      isSafeWebUrl(params.src) &&
      !isYoutubeUrl(params.src) &&
      !String(params.partition || '').startsWith('nyra-private-')
    ) {
      webPreferences.preload = PRELOAD_PATH;
    } else {
      delete webPreferences.preload;
    }
  });

  win.webContents.on('did-start-loading', () => startupLog('index did-start-loading'));
  win.webContents.on('dom-ready', () => startupLog('index dom-ready'));
  win.webContents.on('did-frame-finish-load', (_event, isMainFrame, frameProcessId, frameRoutingId) => {
    if (isMainFrame) startupLog(`index did-frame-finish-load pid=${frameProcessId} route=${frameRoutingId}`);
  });
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    startupLog(`renderer console level=${level} ${sourceId || ''}:${line || 0} ${message}`);
  });
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    startupLog(`preload error in ${preloadPath}`, error);
  });
  win.once('ready-to-show', () => showWindow('ready-to-show'));
  win.webContents.once('did-finish-load', () => showWindow('did-finish-load'));
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    startupLog(`index load failed: ${errorCode} ${errorDescription} ${validatedURL || ''}`);
    showWindow('did-fail-load');
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    startupLog(`window render process gone: ${JSON.stringify(details)}`);
    showWindow('render-process-gone');
  });
  win.on('resize', () => updateDevToolsDockBounds(win));
  win.on('closed', () => closeDevToolsDock(win));

  setTimeout(() => showWindow('startup-timeout'), 3000);

  showWindow('created');
  startupLog(`before loadFile ${path.join(APP_SRC_DIR, 'index.html')}`);
  win.loadFile(path.join(APP_SRC_DIR, 'index.html'))
    .then(() => {
      startupLog('index loaded');
      showWindow('index-loaded');
    })
    .catch((error) => {
      startupLog('index load promise rejected', error);
      const safeMessage = String(error && error.message ? error.message : error)
        .replace(/[<>&"]/g, '');
      win.loadURL(`data:text/html;charset=utf-8,<body style="margin:0;background:%230b0f14;color:%23f3f5f7;font-family:sans-serif;padding:24px"><h1>Nyra failed to load</h1><p>${safeMessage}</p></body>`)
        .catch((fallbackError) => startupLog('fallback error page failed', fallbackError));
      showWindow('loadFile-fallback');
    });
}

function createRecoveryWindow(error) {
  const win = new BrowserWindow({
    width: 960,
    height: 640,
    show: true,
    backgroundColor: '#0b0f14',
    title: 'Nyra Recovery',
    icon: LOGO_PATH,
    autoHideMenuBar: true
  });
  const safeMessage = String(error && error.message ? error.message : error)
    .replace(/[<>&"]/g, '');
  win.loadURL(`data:text/html;charset=utf-8,<body style="margin:0;background:%230b0f14;color:%23f3f5f7;font-family:sans-serif;padding:24px"><h1>Nyra startup recovery</h1><p>The main window could not be initialized.</p><pre style="white-space:pre-wrap">${safeMessage}</pre></body>`)
    .catch((fallbackError) => startupLog('recovery window load failed', fallbackError));
}

app.on('render-process-gone', (_event, contents, details) => {
  startupLog(`render-process-gone url=${contents && contents.getURL ? contents.getURL() : ''} details=${JSON.stringify(details)}`);
});

app.on('child-process-gone', (_event, details) => {
  startupLog(`child-process-gone details=${JSON.stringify(details)}`);
});

app.on('will-finish-launching', () => {
  startupLog('will-finish-launching');
});

startupLog('registering app ready handler');
let started = false;

function startApp() {
  if (started) return;
  started = true;

  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  startupLogPath = path.join(app.getPath('userData'), 'nyra-startup.log');
  startupLog(`app ready${SAFE_MODE ? ' (safe mode)' : ''}`);

  storage = createStorage(app.getPath('userData'));
  passwordStore = createPasswordStore({
    userDataDir: app.getPath('userData'),
    safeStorage
  });
  session.defaultSession.setUserAgent(chromeLikeUserAgent());
  startupLog(`storage loaded: ${storage.filePath}`);
  const recoveryInfo = storage.getRecoveryInfo && storage.getRecoveryInfo();
  if (recoveryInfo) startupLog(`storage recovery: ${JSON.stringify(recoveryInfo)}`);
  if (!storage.getSettings().downloadPath) {
    storage.updateSettings({ downloadPath: app.getPath('downloads') });
  }

  applyNativeTheme(safeSettings(storage.getSettings()));
  nativeTheme.on('updated', () => {
    if (storage.getSettings().theme === 'system') updateWindowTheme('system');
  });
  installSecurityHandlers();
  installAdBlocker();
  installIpcHandlers();
  installDownloadHandlers();
  installWindowsUserTasks();
  if (app.isPackaged && !SAFE_MODE) setupAutoUpdater();
  createWindow();
  setTimeout(() => {
    loadConfiguredExtensions().catch((error) => startupLog('configured extensions load failed', error));
  }, 800);
}

app.once('ready', startApp);
process.nextTick(() => {
  if (app.isReady()) startApp();
});
app.whenReady().then(startApp).catch((error) => {
  startupLog('startup failed before main window', error);
  createRecoveryWindow(error);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
