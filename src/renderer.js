window.addEventListener("DOMContentLoaded", async () => {
  window.NyraIcons?.mount(document);

  function startupLog(message) {
    if (window.nyra && window.nyra.startupLog) {
      window.nyra.startupLog(message);
    }
  }

  startupLog("DOMContentLoaded");
  const startupIntro = document.getElementById("startup-intro");
  let startupIntroHidden = false;

  function hideStartupIntro() {
    if (startupIntroHidden || !startupIntro) return;

    startupIntroHidden = true;
    startupIntro.classList.add("hidden");
    window.setTimeout(() => {
      startupIntro.remove();
    }, 320);
  }

  function setWebviewFullscreen(webContentsId, fullscreen) {
    let fullscreenTab = null;
    tabs.forEach((tab) => {
      const matches = typeof tab.webview.getWebContentsId === "function" &&
        tab.webview.getWebContentsId() === Number(webContentsId);
      tab.webview.classList.toggle("html-fullscreen", Boolean(fullscreen && matches));
      if (matches) fullscreenTab = tab;
    });

    document.body.classList.toggle("webview-fullscreen", Boolean(fullscreen && fullscreenTab));
    if (fullscreen && fullscreenTab && fullscreenTab.id !== activeTabId) {
      switchToTab(fullscreenTab.id);
    }
  }

  function setDevToolsDockOpen(open) {
    if (!webviewsContainer) return;

    webviewsContainer.classList.toggle("devtools-open", Boolean(open));
  }

  async function toggleActiveDevTools() {
    const tab = getActiveTab();
    if (
      !tab ||
      !tab.webview ||
      !window.nyra ||
      !window.nyra.toggleDevTools ||
      typeof tab.webview.getWebContentsId !== "function"
    ) {
      return;
    }

    setDevToolsDockOpen(true);
    devtoolsTargetId = tab.webview.getWebContentsId();
    const result = await window.nyra.toggleDevTools(devtoolsTargetId).catch(() => ({ ok: false }));

    if (!result || result.ok === false || result.opened === false) {
      setDevToolsDockOpen(false);
      devtoolsTargetId = null;
    }
  }

  // Virtual routes for nyra:// URLs. Internal pages are the only local files
  // allowed inside webviews by the main-process navigation guard.
  const virtualRoutes = {
    "nyra://newtab": "./newtab.html",
    "nyra://blank": "./blank.html",
    "nyra://bookmarks": "./bookmarks.html",
    "nyra://diagnostics": "./diagnostics.html",
    "nyra://downloads": "./downloads.html",
    "nyra://extensions": "./extensions.html",
    "nyra://history": "./history.html",
    "nyra://site-data": "./site-data.html",
    "nyra://settings": "./settings.html",
  };

  const DEFAULT_SETTINGS = {
    httpsFirst: true,
    searchEngine: "duckduckgo",
    restoreSession: true,
  };

  const urlInput = document.getElementById("url");
  const backBtn = document.getElementById("back");
  const forwardBtn = document.getElementById("forward");
  const reloadStopBtn = document.getElementById("reload-stop");
  const homeBtn = document.getElementById("home");
  const toggleSidebarBtn = document.getElementById("toggle-sidebar");
  const siteInfoButton = document.getElementById("site-info-button");
  const bookmarkBtn = document.getElementById("bookmark");
  const downloadBtn = document.getElementById("download");
  const historyBtn = document.getElementById("history");
  const settingsBtn = document.getElementById("settings");
  const sideHomeBtn = document.getElementById("side-home");
  const sideHistoryBtn = document.getElementById("side-history");
  const sideBookmarksBtn = document.getElementById("side-bookmarks");
  const sideDownloadsBtn = document.getElementById("side-downloads");
  const sideExtensionsBtn = document.getElementById("side-extensions");
  const sideSettingsBtn = document.getElementById("side-settings");
  const sidePrivateBtn = document.getElementById("side-private");
  const tabsContainer = document.getElementById("tabs");
  const newTabBtn = document.getElementById("new-tab");
  const bookmarksBar = document.getElementById("bookmarks-bar");
  const webviewsContainer = document.getElementById("webviews-container");
  const downloadsMenu = document.getElementById("downloads-menu");
  const downloadsList = document.getElementById("downloads-list");
  const clearDownloadsBtn = document.getElementById("clear-downloads");
  const openDownloadsFolderBtn = document.getElementById("open-downloads-folder");
  const siteInfoMenu = document.getElementById("site-info-menu");
  const tabContextMenu = document.getElementById("tab-context-menu");
  const permissionDialog = document.getElementById("permission-dialog");
  const permissionTitle = document.getElementById("permission-title");
  const permissionMessage = document.getElementById("permission-message");
  const permissionAllow = document.getElementById("permission-allow");
  const permissionDeny = document.getElementById("permission-deny");
  const passwordPrompt = document.getElementById("password-prompt");
  const passwordPromptTitle = document.getElementById("password-prompt-title");
  const passwordPromptMessage = document.getElementById("password-prompt-message");
  const passwordPromptAccounts = document.getElementById("password-prompt-accounts");
  const passwordPromptConfirm = document.getElementById("password-prompt-confirm");
  const passwordPromptDismiss = document.getElementById("password-prompt-dismiss");
  const passwordPromptNever = document.getElementById("password-prompt-never");
  const commandPalette = document.getElementById("command-palette");
  const commandSearch = document.getElementById("command-search");
  const commandList = document.getElementById("command-list");

  let tabs = [];
  let activeTabId = null;
  let settings = DEFAULT_SETTINGS;
  let bookmarks = [];
  let downloads = [];
  let permissions = [];
  let closedTabs = [];
  let pendingPermissionPrompt = null;
  let pendingPasswordPrompt = null;
  let sessionSaveTimer = null;
  let draggedTabId = null;
  let safeMode = false;
  let startupRestorePending = true;
  let devtoolsTargetId = null;
  let commandPaletteIndex = 0;
  let visibleCommands = [];
  let hasUnseenCompletedDownloads = false;
  let previousDownloadStates = new Map();

  async function safeNyraCall(label, fallback, callback) {
    try {
      return await callback();
    } catch (error) {
      console.error(`Nyra renderer startup call failed: ${label}`, error);
      return fallback;
    }
  }

  function applyZoomToWebviews() {
    tabs.forEach((tab) => {
      if (tab.webview && typeof tab.webview.setZoomFactor === "function") {
        try {
          tab.zoomFactor = settings.defaultZoom || 1;
          tab.webview.setZoomFactor(tab.zoomFactor);
        } catch {
          // A webview cannot be zoomed until it is attached and dom-ready.
        }
      }
    });
  }

  function applySettings(nextSettings) {
    const previousTheme = settings.theme;
    settings = window.NyraSettings
      ? window.NyraSettings.normalizeSettings(nextSettings)
      : { ...DEFAULT_SETTINGS, ...nextSettings };

    if (window.NyraSettings) {
      window.NyraSettings.applyAppearance(settings);
    }

    if (toggleSidebarBtn) {
      toggleSidebarBtn.title = settings.sidebarMode === "compact" ? "Expand sidebar" : "Collapse sidebar";
    }

    applyZoomToWebviews();
    renderBookmarksBar();

    if (previousTheme && previousTheme !== settings.theme) {
      reloadRemoteWebviewsForTheme();
    }
  }

  if (window.nyra) {
    safeMode = await safeNyraCall("isSafeMode", false, () => window.nyra.isSafeMode());
    applySettings(await safeNyraCall("getSettings", DEFAULT_SETTINGS, () => window.nyra.getSettings()));
    bookmarks = await safeNyraCall("getBookmarks", [], () => window.nyra.getBookmarks());
    downloads = safeMode
      ? []
      : await safeNyraCall("getDownloads", [], () => window.nyra.getDownloads());
    previousDownloadStates = new Map(downloads.map((download) => [download.id, download.state]));
    permissions = safeMode
      ? []
      : await safeNyraCall("getPermissions", [], () => window.nyra.getPermissions());
    renderBookmarksBar();

    window.nyra.onSettingsChanged((nextSettings) => {
      applySettings(nextSettings);
      updateTabsUI();
    });

    window.nyra.onStateReset((state) => {
      applySettings((state && state.settings) || DEFAULT_SETTINGS);
      bookmarks = (state && state.bookmarks) || [];
      updateBookmarkButton();
      renderBookmarksBar();
    });

    window.nyra.onBookmarksChanged((nextBookmarks) => {
      bookmarks = Array.isArray(nextBookmarks) ? nextBookmarks : [];
      updateBookmarkButton();
      renderBookmarksBar();
    });

    window.nyra.onDownloadsChanged((nextDownloads) => {
      updateDownloadIndicator(Array.isArray(nextDownloads) ? nextDownloads : []);
      renderDownloadsMenu();
    });

    window.nyra.onPermissionsChanged((nextPermissions) => {
      permissions = Array.isArray(nextPermissions) ? nextPermissions : [];
      renderSiteInfoMenu();
    });

    window.nyra.onPermissionPrompt((prompt) => {
      showPermissionPrompt(prompt);
    });
  }

  function routeToSrc(route) {
    return new URL(virtualRoutes[route], window.location.href).toString();
  }

  // Resolve virtual URL to real URL
  const resolveVirtualUrl = (realUrl) => {
    try {
      const parsed = new URL(realUrl);
      const errorPath = new URL("./error.html", window.location.href).pathname;
      if (parsed.pathname === errorPath && parsed.searchParams.has("url")) {
        return parsed.searchParams.get("url");
      }
    } catch {
      // Fall through to normal virtual route resolution.
    }

    for (const [virtual, real] of Object.entries(virtualRoutes)) {
      const fullPath = new URL(real, window.location.href).toString();
      if (realUrl === fullPath) {
        // Special case: don't show anything for newtab
        if (virtual === "nyra://newtab") return "";
        return virtual;
      }
    }
    return realUrl;
  };

  function displayUrlForSession(realUrl) {
    const displayUrl = resolveVirtualUrl(realUrl);
    return displayUrl || "nyra://newtab";
  }

  function defaultNewTabUrl() {
    return settings.newTabPage === "blank" ? "nyra://blank" : "nyra://newtab";
  }

  function isRestorableUrl(url) {
    if (
      url === "nyra://newtab" ||
      url === "nyra://blank" ||
      url === "nyra://bookmarks" ||
      url === "nyra://diagnostics" ||
      url === "nyra://downloads" ||
      url === "nyra://extensions" ||
      url === "nyra://history" ||
      url === "nyra://site-data" ||
      url === "nyra://settings"
    ) {
      return true;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function getSessionTabs() {
    const sessionTabs = tabs
      .filter((tab) => !tab.private)
      .map((tab) => ({
        url: displayUrlForSession(tab.webview.src),
        title: tab.title || "New Tab",
        pinned: Boolean(tab.pinned),
        muted: Boolean(tab.muted),
        favicon: tab.favicon || "",
      }))
      .filter((tab) => isRestorableUrl(tab.url));

    if (sessionTabs.length > 1 && sessionTabs.every((tab) => tab.url === "nyra://newtab")) {
      return [sessionTabs[0]];
    }

    return sessionTabs;
  }

  function currentPageSnapshot(tab = getActiveTab()) {
    if (!tab || tab.private) return null;
    return {
      url: displayUrlForSession(tab.webview.src),
      title: tab.title || "New Tab",
      pinned: Boolean(tab.pinned),
      muted: Boolean(tab.muted),
      favicon: tab.favicon || "",
    };
  }

  function scheduleSessionSave() {
    if (!window.nyra || startupRestorePending) return;

    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(() => {
      window.nyra.saveSession(getSessionTabs()).catch(() => {});
    }, 150);
  }

  function saveSessionNow() {
    if (!window.nyra || startupRestorePending) return;

    clearTimeout(sessionSaveTimer);
    const sessionTabs = getSessionTabs();
    if (typeof window.nyra.saveSessionSync === "function") {
      try {
        window.nyra.saveSessionSync(sessionTabs);
        return;
      } catch {
        // Fall back to async save below.
      }
    }
    window.nyra.saveSession(sessionTabs).catch(() => {});
  }

  function srcForUrl(url) {
    return virtualRoutes[url] ? routeToSrc(url) : url;
  }

  function chromeLikeUserAgent() {
    return navigator.userAgent
      .replace(/\sElectron\/[^\s]+/g, "")
      .replace(/\sNyra\/[^\s]+/g, "");
  }

  function navigateTab(tab, url) {
    if (!tab || !tab.webview) return;

    clearTabCrash(tab);
    tab.webview.src = srcForUrl(url);
  }

  function errorPageSrc(failedUrl, errorCode, errorDescription) {
    const params = new URLSearchParams({
      url: failedUrl,
      code: String(errorCode),
      description: errorDescription || "Load failed",
    });
    if (window.NyraUrl?.isPdfUrl?.(failedUrl)) {
      params.set("type", "pdf");
    }

    return new URL(`./error.html?${params.toString()}`, window.location.href).toString();
  }

  function isErrorPageSrc(realUrl) {
    try {
      const parsed = new URL(realUrl);
      const errorPath = new URL("./error.html", window.location.href).pathname;
      return parsed.protocol === "file:" && parsed.pathname === errorPath;
    } catch {
      return false;
    }
  }

  function getActiveTab() {
    return tabs.find((tab) => tab.id === activeTabId);
  }

  function getActiveDisplayUrl() {
    const tab = getActiveTab();
    return tab ? displayUrlForSession(tab.webview.src) : "";
  }

  function updateCurrentPageStorage() {
    const tab = getActiveTab();
    if (!tab || tab.private) return;

    try {
      localStorage.setItem("nyra-current-page", JSON.stringify({
        url: getActiveDisplayUrl(),
        title: tab.title || getActiveDisplayUrl(),
        favicon: tab.favicon || "",
      }));
    } catch {
      // Local helper state should never block navigation.
    }
  }

  function isBookmarkableUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function domainForUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  function originForDisplayUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : "";
    } catch {
      return "";
    }
  }

  function faviconForUrl(url) {
    try {
      return `${new URL(url).origin}/favicon.ico`;
    } catch {
      return "";
    }
  }

  function setIcon(element, name) {
    if (!element) return;
    if (window.NyraIcons) {
      element.innerHTML = window.NyraIcons.svg(name);
    } else {
      element.textContent = "";
    }
  }

  function iconNameForTab(tab, tabUrl) {
    if (tab.loading) return "reload";
    if (tabUrl === "nyra://history") return "history";
    if (tabUrl === "nyra://settings") return "gear";
    if (tabUrl === "nyra://bookmarks") return "bookmark";
    if (tabUrl === "nyra://diagnostics") return "info";
    if (tabUrl === "nyra://downloads") return "download";
    if (tabUrl === "nyra://extensions") return "extensions";
    if (tabUrl === "nyra://site-data") return "shield";
    if (tab.private) return "moon";
    return "globe";
  }

  function renderBookmarksBar() {
    if (!bookmarksBar) return;

    const visibleBookmarks = bookmarks
      .filter((bookmark) => bookmark && isBookmarkableUrl(bookmark.url))
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
      .slice(0, 14);

    bookmarksBar.hidden = visibleBookmarks.length === 0;
    bookmarksBar.innerHTML = "";

    visibleBookmarks.forEach((bookmark) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bookmark-bar-item";
      button.title = `${bookmark.title || bookmark.url}\n${bookmark.url}`;
      button.addEventListener("click", () => {
        const tab = getActiveTab();
        if (tab) navigateTab(tab, bookmark.url);
        else createTab(bookmark.url);
      });

      const icon = document.createElement("img");
      icon.alt = "";
      icon.src = bookmark.favicon || faviconForUrl(bookmark.url);
      icon.addEventListener("error", () => {
        icon.remove();
        button.dataset.fallback = (bookmark.title || domainForUrl(bookmark.url) || "?").slice(0, 1).toUpperCase();
      }, { once: true });

      const label = document.createElement("span");
      label.textContent = bookmark.title || domainForUrl(bookmark.url) || bookmark.url;
      button.append(icon, label);
      bookmarksBar.appendChild(button);
    });
  }

  function clearTabCrash(tab) {
    if (!tab) return;

    tab.crashed = false;
    tab.crashDetails = null;
    if (tab.crashView) {
      tab.crashView.hidden = true;
      tab.crashView.classList.remove("active");
    }
    if (tab.webview) {
      tab.webview.classList.remove("crashed");
    }
  }

  function showTabCrash(tab, details = {}) {
    if (!tab || !tab.crashView) return;

    tab.crashed = true;
    tab.loading = false;
    tab.crashDetails = {
      reason: details.reason || details.name || "Tab process stopped",
      exitCode: details.exitCode,
    };
    tab.crashUrl = displayUrlForSession(tab.webview?.src || tab.url || defaultNewTabUrl());

    const reason = tab.crashDetails.exitCode === undefined
      ? tab.crashDetails.reason
      : `${tab.crashDetails.reason} (${tab.crashDetails.exitCode})`;
    tab.crashView.querySelector(".tab-crash-reason").textContent = reason;
    tab.crashView.querySelector(".tab-crash-url").textContent = tab.crashUrl;
    tab.crashView.hidden = tab.id !== activeTabId;
    tab.crashView.classList.toggle("active", tab.id === activeTabId);
    tab.webview?.classList.add("crashed");

    if (tab.id === activeTabId) updateReloadStopButton();
    updateTabsUI();
    scheduleSessionSave();
  }

  function reloadCrashedTab(tab) {
    if (!tab) return;

    const targetUrl = tab.crashUrl || displayUrlForSession(tab.webview?.src || tab.url || defaultNewTabUrl());
    clearTabCrash(tab);
    try {
      tab.webview.reload();
    } catch {
      navigateTab(tab, targetUrl);
    }
  }

  function createCrashView(tab) {
    const view = document.createElement("div");
    view.className = "tab-crash-screen";
    view.hidden = true;
    view.innerHTML = `
      <div class="tab-crash-card">
        <strong>This tab crashed</strong>
        <p>Nyra kept the browser shell alive. Reload the tab to try again.</p>
        <code class="tab-crash-url"></code>
        <small class="tab-crash-reason"></small>
        <div class="tab-crash-actions">
          <button class="tab-crash-reload" type="button">Reload tab</button>
          <button class="tab-crash-close" type="button">Close tab</button>
        </div>
      </div>
    `;
    view.querySelector(".tab-crash-reload").addEventListener("click", () => reloadCrashedTab(tab));
    view.querySelector(".tab-crash-close").addEventListener("click", () => closeTab(tab.id));
    return view;
  }

  function reloadRemoteWebviewsForTheme() {
    tabs.forEach((tab) => {
      const url = displayUrlForSession(tab.webview.src);
      if (!isBookmarkableUrl(url)) return;

      try {
        tab.webview.reload();
      } catch {
        // Keep theme sync best-effort for remote pages.
      }
    });
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  function clampZoom(value) {
    return Math.min(3, Math.max(0.3, Math.round(value * 20) / 20));
  }

  function setActiveZoom(nextZoom) {
    const tab = getActiveTab();
    if (!tab || !tab.webview || typeof tab.webview.setZoomFactor !== "function") return false;

    tab.zoomFactor = clampZoom(nextZoom);
    try {
      tab.webview.setZoomFactor(tab.zoomFactor);
    } catch {
      return false;
    }
    return true;
  }

  function renderDownloadsMenu() {
    if (!downloadsList) return;

    if (!downloads.length) {
      downloadsList.innerHTML = `<p class="downloads-empty">No downloads yet</p>`;
      return;
    }

    downloadsList.innerHTML = "";
    downloads.forEach((download) => {
      const row = document.createElement("div");
      row.className = "download-item";

      const meta = document.createElement("div");
      meta.className = "download-meta";

      const name = document.createElement("strong");
      name.textContent = download.filename || "Download";

      const progress = document.createElement("small");
      const total = download.totalBytes ? ` / ${formatBytes(download.totalBytes)}` : "";
      const date = download.completedAt || download.startedAt || "";
      const dateLabel = date ? ` · ${new Date(date).toLocaleDateString()}` : "";
      progress.textContent = `${download.state || "downloading"} · ${download.percent || 0}% · ${formatBytes(download.receivedBytes)}${total}${dateLabel}`;

      const bar = document.createElement("span");
      bar.className = "download-progress";
      bar.style.setProperty("--progress", `${Math.min(100, Math.max(0, download.percent || 0))}%`);

      meta.append(name, progress, bar);

      const actions = document.createElement("div");
      actions.className = "download-actions";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.textContent = "Open";
      openBtn.disabled = download.state !== "completed";
      openBtn.onclick = () => window.nyra.openDownloadFile(download.id).catch(() => {});

      const showBtn = document.createElement("button");
      showBtn.type = "button";
      showBtn.textContent = "Folder";
      showBtn.disabled = !download.savePath || download.state === "missing";
      showBtn.onclick = () => window.nyra.showDownloadInFolder(download.id).catch(() => {});

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.onclick = async () => {
        downloads = await window.nyra.removeDownload(download.id);
        renderDownloadsMenu();
      };

      actions.append(openBtn, showBtn, removeBtn);
      row.append(meta, actions);
      downloadsList.appendChild(row);
    });
  }

  function updateDownloadIndicator(nextDownloads = downloads) {
    const incomingDownloads = Array.isArray(nextDownloads) ? nextDownloads : [];
    const nextStates = new Map(incomingDownloads.map((download) => [download.id, download.state]));
    const activeDownloads = incomingDownloads.filter((download) => (
      download.state === "downloading" ||
      download.state === "interrupted"
    ));
    const completedNow = incomingDownloads.some((download) => {
      const previousState = previousDownloadStates.get(download.id);
      return download.state === "completed" && previousState && previousState !== "completed";
    });

    downloads = incomingDownloads;
    previousDownloadStates = nextStates;
    if (completedNow && !(downloadsMenu && downloadsMenu.hidden === false)) {
      hasUnseenCompletedDownloads = true;
    }

    if (!downloadBtn) return;

    const averageProgress = activeDownloads.length
      ? activeDownloads.reduce((sum, download) => sum + Math.min(100, Math.max(0, Number(download.percent || 0))), 0) / activeDownloads.length
      : 0;

    downloadBtn.classList.toggle("downloading", activeDownloads.length > 0);
    downloadBtn.classList.toggle("download-complete", hasUnseenCompletedDownloads && activeDownloads.length === 0);
    downloadBtn.style.setProperty("--download-progress", `${Math.round(averageProgress)}%`);
    downloadBtn.title = activeDownloads.length
      ? `Downloading ${activeDownloads.length} item${activeDownloads.length === 1 ? "" : "s"}`
      : hasUnseenCompletedDownloads
        ? "Downloads completed"
        : "Downloads";
  }

  function toggleDownloadsMenu(forceOpen) {
    if (!downloadsMenu || !downloadBtn) return;

    const open = typeof forceOpen === "boolean" ? forceOpen : downloadsMenu.hidden;
    downloadsMenu.hidden = !open;
    downloadBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      hasUnseenCompletedDownloads = false;
      updateDownloadIndicator(downloads);
      renderDownloadsMenu();
    }
  }

  function permissionSummaryForDomain(domain) {
    const relevant = permissions.filter((item) => item.domain === domain);
    if (!domain) return "Local Nyra page";
    if (!relevant.length) return "Ask when needed";
    return relevant.map((item) => `${item.permission}: ${item.value}`).join(", ");
  }

  async function renderSiteInfoMenu() {
    if (!siteInfoMenu || siteInfoMenu.hidden) return;

    const url = getActiveDisplayUrl();
    const domain = domainForUrl(url);
    const siteSummary = window.nyra && window.nyra.getSiteSummary
      ? await window.nyra.getSiteSummary(url).catch(() => ({ cookies: 0, savedLogins: 0 }))
      : { cookies: 0, savedLogins: 0 };
    if (!siteInfoMenu || siteInfoMenu.hidden) return;
    let protocol = "internal";
    let secure = "Nyra internal page";
    try {
      const parsed = new URL(url);
      protocol = parsed.protocol.replace(":", "");
      secure = parsed.protocol === "https:" ? "Secure HTTPS" : parsed.protocol === "http:" ? "Not secure HTTP" : "Nyra internal page";
    } catch {
      // Keep defaults for internal or blank routes.
    }

    siteInfoMenu.innerHTML = `
      <div class="site-info-header">
        <strong>${domain || "Nyra"}</strong>
        <span>${secure}</span>
      </div>
      <dl>
        <dt>URL</dt><dd>${url || "nyra://newtab"}</dd>
        <dt>Protocol</dt><dd>${protocol}</dd>
        <dt>Permissions</dt><dd>${permissionSummaryForDomain(domain)}</dd>
        <dt>Saved logins</dt><dd>${siteSummary.savedLogins || 0}</dd>
        <dt>Cookies</dt><dd>${siteSummary.cookies || 0}</dd>
        <dt>External links</dt><dd>mailto: and tel: only</dd>
        <dt>Isolation</dt><dd>Remote pages run in isolated webviews</dd>
      </dl>
      <div class="site-info-actions">
        <button id="clear-site-permissions" type="button" ${domain ? "" : "disabled"}>Clear site permissions</button>
        <button id="clear-site-data" type="button" ${domain ? "" : "disabled"}>Clear site data</button>
        <button id="open-site-data" type="button">Manage site data</button>
        <button id="open-site-settings" type="button">Open site settings</button>
      </div>
    `;

    document.getElementById("clear-site-permissions")?.addEventListener("click", async () => {
      permissions = await window.nyra.removePermission(domain);
      renderSiteInfoMenu();
    });
    document.getElementById("clear-site-data")?.addEventListener("click", async () => {
      if (window.nyra && window.nyra.clearSiteData) {
        await window.nyra.clearSiteData(domain);
        renderSiteInfoMenu();
      }
    });
    document.getElementById("open-site-settings")?.addEventListener("click", () => {
      try {
        localStorage.setItem("nyra-settings-section", "privacy");
        if (domain) localStorage.setItem("nyra-settings-domain", domain);
      } catch {
        // Best-effort local page routing hint.
      }
      openSettingsTab();
      toggleSiteInfoMenu(false);
    });
    document.getElementById("open-site-data")?.addEventListener("click", () => {
      openSiteDataTab();
      toggleSiteInfoMenu(false);
    });
  }

  function toggleSiteInfoMenu(forceOpen) {
    if (!siteInfoMenu) return;
    const open = typeof forceOpen === "boolean" ? forceOpen : siteInfoMenu.hidden;
    siteInfoMenu.hidden = !open;
    if (open) renderSiteInfoMenu();
  }

  function showPermissionPrompt(prompt) {
    if (!permissionDialog || !prompt) return;
    pendingPermissionPrompt = prompt;
    permissionTitle.textContent = "Permission request";
    permissionMessage.textContent = `${prompt.domain} wants to use ${prompt.permission}.`;
    permissionDialog.showModal();
  }

  async function resolvePermissionPrompt(value) {
    if (!pendingPermissionPrompt) return;
    const prompt = pendingPermissionPrompt;
    pendingPermissionPrompt = null;
    permissionDialog.close();
    permissions = await window.nyra.resolvePermissionPrompt(prompt.id, value);
  }

  function hidePasswordPrompt() {
    if (passwordPrompt) passwordPrompt.hidden = true;
    if (passwordPromptAccounts) {
      passwordPromptAccounts.hidden = true;
      passwordPromptAccounts.innerHTML = "";
    }
    if (passwordPromptNever) passwordPromptNever.hidden = true;
    pendingPasswordPrompt = null;
  }

  function showPasswordPrompt({ tab, type, domain, message, confirmLabel, accounts = [], onConfirm, onDismiss, onNever }) {
    if (!passwordPrompt || !passwordPromptTitle || !passwordPromptMessage || !passwordPromptConfirm) return;
    if (!tab || tab.private || tab.id !== activeTabId) return;

    pendingPasswordPrompt = { tabId: tab.id, type, onConfirm, onDismiss, onNever };
    passwordPromptTitle.textContent = type === "fill" ? "Saved login available" : "Password manager";
    passwordPromptMessage.textContent = message || domain || "Nyra can help with this login.";
    passwordPromptConfirm.textContent = confirmLabel;
    passwordPromptConfirm.hidden = accounts.length > 1;
    if (passwordPromptNever) passwordPromptNever.hidden = typeof onNever !== "function";
    if (passwordPromptAccounts) {
      passwordPromptAccounts.innerHTML = "";
      passwordPromptAccounts.hidden = accounts.length <= 1;
      accounts.forEach((account) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Fill as ${account.username}`;
        button.addEventListener("click", async () => {
          hidePasswordPrompt();
          if (typeof account.onSelect === "function") await account.onSelect();
        });
        passwordPromptAccounts.appendChild(button);
      });
    }
    passwordPrompt.hidden = false;
  }

  async function resolvePasswordPrompt(confirm) {
    const prompt = pendingPasswordPrompt;
    hidePasswordPrompt();
    if (!prompt) return;

    if (confirm && typeof prompt.onConfirm === "function") {
      await prompt.onConfirm();
      return;
    }

    if (!confirm && typeof prompt.onDismiss === "function") {
      prompt.onDismiss();
    }
  }

  async function neverPasswordPrompt() {
    const prompt = pendingPasswordPrompt;
    hidePasswordPrompt();
    if (prompt && typeof prompt.onNever === "function") {
      await prompt.onNever();
    }
  }

  function handlePasswordForms(tab, payload) {
    if (!tab || tab.private || !window.nyra || !window.nyra.getLoginsForUrl || !payload?.url) return;

    window.nyra.getLoginsForUrl(payload.url)
      .then((result) => {
        if (!result || !Array.isArray(result.logins) || !result.logins.length || tab.private) return;
        const [firstLogin] = result.logins;
        const origin = firstLogin.origin || new URL(payload.url).origin;
        tab.passwordPromptOrigin = origin;
        if (tab.passwordPromptDismissedOrigins.has(origin)) return;
        const fillLogin = async (login) => {
          const secret = await window.nyra.getLoginSecret(login.id).catch(() => ({ ok: false }));
          if (!secret || !secret.ok || !secret.credential || tab.private) return;

          tab.webview.send("nyra-fill-login", {
            username: secret.credential.username,
            password: secret.credential.password,
          });
        };
        showPasswordPrompt({
          tab,
          type: "fill",
          domain: firstLogin.domain || domainForUrl(payload.url),
          message: result.logins.length === 1
            ? `Fill saved login for ${firstLogin.domain || domainForUrl(payload.url)}?`
            : `Choose a saved login for ${firstLogin.domain || domainForUrl(payload.url)}.`,
          confirmLabel: result.logins.length === 1 ? `Fill as ${firstLogin.username}` : "Fill login",
          accounts: result.logins.length > 1
            ? result.logins.map((login) => ({
              username: login.username,
              onSelect: () => fillLogin(login),
            }))
            : [],
          onConfirm: () => fillLogin(firstLogin),
          onDismiss: () => {
            tab.passwordPromptDismissedOrigins.add(origin);
          },
        });
      })
      .catch(() => {});
  }

  async function handlePasswordSubmit(tab, payload) {
    if (!tab || tab.private || !window.nyra || !window.nyra.saveLogin || !payload?.url) return;
    if (!payload.username || !payload.password || !isBookmarkableUrl(payload.url)) return;

    const domain = domainForUrl(payload.url) || payload.url;
    const classification = window.nyra.classifyLogin
      ? await window.nyra.classifyLogin(payload).catch(() => ({ action: "ignore" }))
      : { action: "ignore" };
    if (!classification || ["ignore", "unchanged", "unavailable", "never"].includes(classification.action)) return;

    showPasswordPrompt({
      tab,
      type: "save",
      domain,
      message: classification.action === "update"
        ? `Update saved login for ${domain}?`
        : `Save new login for ${domain}?`,
      confirmLabel: classification.action === "update" ? "Update" : "Save",
      onConfirm: () => window.nyra.saveLogin({
        url: payload.url,
        username: payload.username,
        password: payload.password,
      }).catch(() => {}),
      onNever: () => window.nyra.neverSaveLogin(payload.url).catch(() => {}),
    });
  }

  function isHistoryUrl(url) {
    return isBookmarkableUrl(url);
  }

  function recordHistoryForTab(tab, navigatedUrl = tab.webview.src) {
    if (!window.nyra || !tab || tab.private || isErrorPageSrc(tab.webview.src)) return;

    const url = resolveVirtualUrl(navigatedUrl);
    if (!isHistoryUrl(url)) return;

    window.nyra.addHistoryEntry({
      url,
      title: tab.title || url,
      visitedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  function updateBookmarkButton() {
    if (!bookmarkBtn) return;

    const url = getActiveDisplayUrl();
    const tab = getActiveTab();
    const isBookmarked = bookmarks.some((bookmark) => bookmark.url === url);
    setIcon(bookmarkBtn, isBookmarked ? "bookmark-filled" : "bookmark");
    bookmarkBtn.classList.toggle("bookmarked", isBookmarked);
    bookmarkBtn.disabled = Boolean(tab && tab.private) || !isBookmarkableUrl(url);
    bookmarkBtn.title = isBookmarked ? "Remove bookmark" : "Bookmark this page";
  }

  function updateReloadStopButton() {
    if (!reloadStopBtn) return;

    const tab = getActiveTab();
    const isLoading = Boolean(tab && tab.loading);
    setIcon(reloadStopBtn, isLoading ? "stop" : "reload");
    reloadStopBtn.title = tab && tab.crashed ? "Reload crashed tab" : isLoading ? "Stop loading" : "Reload";
    reloadStopBtn.disabled = !tab;
  }

  function openSettingsTab() {
    const existingSettingsTab = tabs.find(
      (tab) => displayUrlForSession(tab.webview.src) === "nyra://settings"
    );

    if (existingSettingsTab) {
      switchToTab(existingSettingsTab.id);
      return;
    }

    createTab("nyra://settings");
  }

  function openHistoryTab() {
    const existingHistoryTab = tabs.find(
      (tab) => displayUrlForSession(tab.webview.src) === "nyra://history"
    );

    if (existingHistoryTab) {
      switchToTab(existingHistoryTab.id);
      return;
    }

    createTab("nyra://history");
  }

  function openBookmarksTab() {
    const existingBookmarksTab = tabs.find(
      (tab) => displayUrlForSession(tab.webview.src) === "nyra://bookmarks"
    );

    if (existingBookmarksTab) {
      switchToTab(existingBookmarksTab.id);
      return;
    }

    createTab("nyra://bookmarks");
  }

  function openDownloadsTab() {
    const existingDownloadsTab = tabs.find(
      (tab) => displayUrlForSession(tab.webview.src) === "nyra://downloads"
    );

    if (existingDownloadsTab) {
      switchToTab(existingDownloadsTab.id);
      return;
    }

    createTab("nyra://downloads");
  }

  function openExtensionsTab() {
    const existingExtensionsTab = tabs.find(
      (tab) => displayUrlForSession(tab.webview.src) === "nyra://extensions"
    );

    if (existingExtensionsTab) {
      switchToTab(existingExtensionsTab.id);
      return;
    }

    createTab("nyra://extensions");
  }

  function openDiagnosticsTab() {
    const existingDiagnosticsTab = tabs.find(
      (tab) => displayUrlForSession(tab.webview.src) === "nyra://diagnostics"
    );

    if (existingDiagnosticsTab) {
      switchToTab(existingDiagnosticsTab.id);
      return;
    }

    createTab("nyra://diagnostics");
  }

  function openSiteDataTab() {
    const existingSiteDataTab = tabs.find(
      (tab) => displayUrlForSession(tab.webview.src) === "nyra://site-data"
    );

    if (existingSiteDataTab) {
      switchToTab(existingSiteDataTab.id);
      return;
    }

    createTab("nyra://site-data");
  }

  function commandDefinitions() {
    return [
      { id: "new-tab", title: "New tab", hint: "Open a fresh tab", shortcut: "Ctrl+T", icon: "plus", run: () => createTab() },
      { id: "private-tab", title: "Private tab", hint: "Open a private tab", icon: "moon", run: () => openPrivateTab() },
      { id: "focus-address", title: "Focus address bar", hint: "Search or enter address", shortcut: "Ctrl+L", icon: "search", run: () => performShortcut("focus-address-bar") },
      { id: "bookmarks", title: "Open bookmarks", hint: "Manage saved bookmarks", icon: "bookmark", run: () => openBookmarksTab() },
      { id: "history", title: "Open history", hint: "Browse visited pages", icon: "history", run: () => openHistoryTab() },
      { id: "extensions", title: "Open extensions", hint: "Manage unpacked extensions", icon: "extensions", run: () => openExtensionsTab() },
      { id: "downloads", title: "Open downloads", hint: "Review downloaded files", icon: "download", run: () => openDownloadsTab() },
      { id: "site-data", title: "Open site data", hint: "Cookies and local storage manager", icon: "shield", run: () => openSiteDataTab() },
      { id: "diagnostics", title: "Open diagnostics", hint: "Startup, GPU and cache recovery", icon: "info", run: () => openDiagnosticsTab() },
      { id: "settings", title: "Open settings", hint: "Nyra preferences", icon: "gear", run: () => openSettingsTab() },
      { id: "toggle-sidebar", title: "Toggle sidebar", hint: "Expanded or compact sidebar", icon: "layout", run: () => toggleSidebarBtn.click() },
      { id: "reload", title: "Reload active tab", hint: "Reload the current page", shortcut: "Ctrl+R", icon: "reload", run: () => performShortcut("reload-tab") },
      { id: "reopen-tab", title: "Reopen closed tab", hint: "Restore the last closed tab", shortcut: "Ctrl+Shift+T", icon: "history", run: () => reopenClosedTab() },
      { id: "devtools", title: "Toggle DevTools", hint: "Inspect the active webview", shortcut: "F12", icon: "code", run: () => toggleActiveDevTools() },
    ];
  }

  function closeCommandPalette() {
    if (!commandPalette) return;
    commandPalette.hidden = true;
  }

  function runCommand(command) {
    if (!command || typeof command.run !== "function") return;
    closeCommandPalette();
    command.run();
  }

  function renderCommandPalette() {
    if (!commandList || !commandSearch) return;

    const query = commandSearch.value.trim().toLowerCase();
    visibleCommands = commandDefinitions().filter((command) => {
      const haystack = `${command.title} ${command.hint} ${command.shortcut || ""}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    commandPaletteIndex = Math.min(commandPaletteIndex, Math.max(0, visibleCommands.length - 1));

    if (!visibleCommands.length) {
      commandList.innerHTML = `<div class="downloads-empty">No commands found</div>`;
      return;
    }

    commandList.innerHTML = "";
    visibleCommands.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `command-item${index === commandPaletteIndex ? " active" : ""}`;
      button.innerHTML = `
        <span data-icon="${command.icon}"></span>
        <span><strong>${command.title}</strong><br><small>${command.hint}</small></span>
        ${command.shortcut ? `<kbd>${command.shortcut}</kbd>` : "<span></span>"}
      `;
      button.addEventListener("click", () => runCommand(command));
      commandList.appendChild(button);
    });
    window.NyraIcons?.mount(commandList);
  }

  function openCommandPalette() {
    if (!commandPalette || !commandSearch) return;

    commandPalette.hidden = false;
    commandSearch.value = "";
    commandPaletteIndex = 0;
    renderCommandPalette();
    requestAnimationFrame(() => commandSearch.focus());
  }

  function openHomeTab() {
    const tab = getActiveTab();
    if (tab) {
      navigateTab(tab, defaultNewTabUrl());
    } else {
      createTab();
    }
  }

  function openPrivateTab() {
    createTab(defaultNewTabUrl(), { private: true });
  }

  function moveTab(dragId, targetId) {
    if (!dragId || !targetId || dragId === targetId) return;

    const fromIndex = tabs.findIndex((tab) => tab.id === dragId);
    const toIndex = tabs.findIndex((tab) => tab.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [tab] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, tab);
    updateTabsUI();
    scheduleSessionSave();
  }

  function updateSideNav() {
    const url = getActiveDisplayUrl();
    const items = [
      [sideHomeBtn, url === "nyra://newtab" || url === "nyra://blank"],
      [sideBookmarksBtn, url === "nyra://bookmarks"],
      [sideDownloadsBtn, url === "nyra://downloads"],
      [sideExtensionsBtn, url === "nyra://extensions"],
      [sideHistoryBtn, url === "nyra://history"],
      [sideSettingsBtn, url === "nyra://settings"],
    ];

    items.forEach(([button, isActive]) => {
      if (button) button.classList.toggle("active", isActive);
    });
  }

  // Check if the URL is a likely search query
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;

      const url = urlInput.value.trim();
      if (url.startsWith("nyra://") && virtualRoutes[url]) {
        navigateTab(tab, url);
      } else {
        const normalizedUrl = window.NyraUrl.normalizeUrlInput(url, {
          httpsFirst: settings.httpsFirst,
          searchEngine: settings.searchEngine,
        });
        if (normalizedUrl) navigateTab(tab, normalizedUrl);
      }

      urlInput.blur();
    }
  });

  // Create and initialize a new tab
  function createTab(url = defaultNewTabUrl(), options = {}) {
    const id = crypto.randomUUID();
    const metadata = options.tab || {};
    const tab = {
      id,
      title: metadata.title || (url === "nyra://history"
        ? "History"
        : url === "nyra://settings"
          ? "Settings"
          : url === "nyra://bookmarks"
            ? "Bookmarks"
            : url === "nyra://diagnostics"
              ? "Diagnostics"
              : url === "nyra://downloads"
                ? "Downloads"
                : url === "nyra://extensions"
                  ? "Extensions"
                  : url === "nyra://site-data"
                    ? "Site Data"
                    : "New Tab"),
      url,
      loading: false,
      pinned: Boolean(metadata.pinned),
      muted: Boolean(metadata.muted),
      favicon: metadata.favicon || "",
      private: Boolean(options.private),
      zoomFactor: Number(metadata.zoomFactor) || settings.defaultZoom || 1,
      passwordPromptDismissedOrigins: new Set(),
      passwordPromptOrigin: "",
      webview: document.createElement("webview"),
      crashView: null,
    };
    tab.crashView = createCrashView(tab);

    tab.webview.setAttribute("allowfullscreen", "true");
    if (tab.private) {
      tab.webview.setAttribute("partition", `nyra-private-${id}`);
    }
    tab.webview.style.display = "none";
    if (tab.muted && typeof tab.webview.setAudioMuted === "function") {
      tab.webview.setAudioMuted(true);
    }

    tab.webview.addEventListener("did-start-loading", () => {
      clearTabCrash(tab);
      tab.loading = true;
      if (tab.id === activeTabId) updateReloadStopButton();
      updateTabsUI();
    });

    tab.webview.addEventListener("did-stop-loading", () => {
      tab.loading = false;
      if (tab.id === activeTabId) updateReloadStopButton();
      updateTabsUI();
    });

    tab.webview.addEventListener("dom-ready", () => {
      if (typeof tab.webview.setZoomFactor === "function") {
        tab.webview.setZoomFactor(tab.zoomFactor || settings.defaultZoom || 1);
      }
    });

    // Update tab title and document title
    tab.webview.addEventListener("page-title-updated", (e) => {
      tab.title = e.title;
      updateTabsUI();
      updateBookmarkButton();
      recordHistoryForTab(tab);
      scheduleSessionSave();
      if (tab.id === activeTabId) {
        let newTitle = e.title;
        if (newTitle.length > 40) {
          newTitle = newTitle.slice(0, 40) + "...";
        }
        document.title = newTitle;
        updateCurrentPageStorage();
      }
    });

    tab.webview.addEventListener("page-favicon-updated", (e) => {
      const [favicon] = e.favicons || [];
      if (favicon) {
        tab.favicon = favicon;
        updateTabsUI();
        if (tab.id === activeTabId) updateCurrentPageStorage();
        scheduleSessionSave();
      }
    });

    // Handle URL input on change
    tab.webview.addEventListener("did-navigate", (e) => {
      const nextOrigin = originForDisplayUrl(resolveVirtualUrl(e.url));
      if (nextOrigin && nextOrigin !== tab.passwordPromptOrigin) {
        tab.passwordPromptDismissedOrigins.clear();
        tab.passwordPromptOrigin = nextOrigin;
      }
      if (tab.id === activeTabId) {
        urlInput.value = resolveVirtualUrl(e.url);
        updateCurrentPageStorage();
        updateSideNav();
      }
      updateBookmarkButton();
      recordHistoryForTab(tab, e.url);
      scheduleSessionSave();
    });

    tab.webview.addEventListener("did-navigate-in-page", (e) => {
      if (tab.id === activeTabId) {
        urlInput.value = resolveVirtualUrl(e.url);
        updateCurrentPageStorage();
        updateSideNav();
      }
      updateBookmarkButton();
      recordHistoryForTab(tab, e.url);
      scheduleSessionSave();
    });

    tab.webview.addEventListener("did-fail-load", (e) => {
      tab.loading = false;
      const failedUrl = e.validatedURL || tab.webview.src;
      if (tab.id === activeTabId) {
        urlInput.value = resolveVirtualUrl(failedUrl);
        updateCurrentPageStorage();
      }

      if (e.isMainFrame !== false && e.errorCode !== -3 && !failedUrl.startsWith("file:")) {
        navigateTab(tab, errorPageSrc(failedUrl, e.errorCode, e.errorDescription));
      }

      updateBookmarkButton();
      if (tab.id === activeTabId) updateReloadStopButton();
      scheduleSessionSave();
    });

    tab.webview.addEventListener("enter-html-full-screen", () => {
      setWebviewFullscreen(tab.webview.getWebContentsId?.(), true);
    });

    tab.webview.addEventListener("leave-html-full-screen", () => {
      setWebviewFullscreen(tab.webview.getWebContentsId?.(), false);
    });

    tab.webview.addEventListener("render-process-gone", (event) => {
      showTabCrash(tab, event);
    });

    tab.webview.addEventListener("plugin-crashed", (event) => {
      showTabCrash(tab, {
        reason: `Plugin crashed${event.name ? `: ${event.name}` : ""}`,
        exitCode: event.version,
      });
    });

    tab.webview.addEventListener("ipc-message", (event) => {
      const [payload] = event.args || [];
      if (event.channel === "nyra-password-forms") {
        handlePasswordForms(tab, payload);
      }
      if (event.channel === "nyra-password-submit") {
        handlePasswordSubmit(tab, payload);
      }
    });

    webviewsContainer.appendChild(tab.webview);
    webviewsContainer.appendChild(tab.crashView);
    tabs.push(tab);
    navigateTab(tab, url);
    switchToTab(id);

    if (options.save !== false) scheduleSessionSave();
  }

  // Switch to a tab by ID
  function switchToTab(id) {
    tabs.forEach((tab) => {
      const isActive = tab.id === id;
      tab.webview.style.display = isActive && !tab.crashed ? "flex" : "none";
      tab.webview.classList.toggle("active", isActive);
      if (tab.crashView) {
        tab.crashView.hidden = !(isActive && tab.crashed);
        tab.crashView.classList.toggle("active", Boolean(isActive && tab.crashed));
      }
    });
    activeTabId = id;

    const activeTab = tabs.find((t) => t.id === id);
    if (activeTab) {
      urlInput.value = resolveVirtualUrl(activeTab.webview.src);
      document.title = activeTab.title;
      updateCurrentPageStorage();
    }

    if (pendingPasswordPrompt && pendingPasswordPrompt.tabId !== id) {
      hidePasswordPrompt();
    }

    updateBookmarkButton();
    updateReloadStopButton();
    updateSideNav();
    updateTabsUI();
  }

  // Update the tab UI bar
  function updateTabsUI() {
    tabsContainer.innerHTML = "";

    tabs.forEach((tab) => {
      const tabBtn = document.createElement("div");
      tabBtn.className = "tab" + (tab.id === activeTabId ? " active" : "");
      tabBtn.classList.toggle("pinned", Boolean(tab.pinned));
      tabBtn.classList.toggle("loading", Boolean(tab.loading));
      tabBtn.classList.toggle("muted", Boolean(tab.muted));
      tabBtn.classList.toggle("private", Boolean(tab.private));
      tabBtn.draggable = true;
      tabBtn.dataset.tabId = tab.id;

      const fullTitle = tab.title || "New Tab";
      let label = fullTitle;
      if (label.length > 20) label = label.slice(0, 20) + "...";

      const tabIcon = document.createElement("span");
      tabIcon.className = "tab-icon";
      const tabUrl = displayUrlForSession(tab.webview.src);
      if (tab.favicon) {
        const favicon = document.createElement("img");
        favicon.src = tab.favicon;
        favicon.alt = "";
        tabIcon.appendChild(favicon);
      } else {
        setIcon(tabIcon, iconNameForTab(tab, tabUrl));
      }

      const tabLabel = document.createElement("span");
      tabLabel.className = "tab-label";
      tabLabel.textContent = label;

      tabBtn.title = fullTitle;
      tabBtn.onclick = () => switchToTab(tab.id);
      tabBtn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        showTabContextMenu(tab.id, event.clientX, event.clientY);
      });
      tabBtn.addEventListener("dragstart", (event) => {
        draggedTabId = tab.id;
        tabBtn.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", tab.id);
      });
      tabBtn.addEventListener("dragend", () => {
        draggedTabId = null;
        tabBtn.classList.remove("dragging");
        document.querySelectorAll(".tab.drag-over").forEach((item) => item.classList.remove("drag-over"));
      });
      tabBtn.addEventListener("dragover", (event) => {
        if (!draggedTabId || draggedTabId === tab.id) return;
        event.preventDefault();
        tabBtn.classList.add("drag-over");
      });
      tabBtn.addEventListener("dragleave", () => {
        tabBtn.classList.remove("drag-over");
      });
      tabBtn.addEventListener("drop", (event) => {
        event.preventDefault();
        tabBtn.classList.remove("drag-over");
        moveTab(draggedTabId || event.dataTransfer.getData("text/plain"), tab.id);
      });

      // Create close button
      const closeBtn = document.createElement("button");
      closeBtn.className = "close-btn";
      closeBtn.title = "Close tab";
      setIcon(closeBtn, "close");
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      };

      tabBtn.append(tabIcon, tabLabel, closeBtn);
      tabsContainer.appendChild(tabBtn);
    });
  }

  function setTabPinned(id, pinned) {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return;
    tab.pinned = Boolean(pinned);
    tabs.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
    updateTabsUI();
    scheduleSessionSave();
  }

  function duplicateTab(id) {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return;
    createTab(displayUrlForSession(tab.webview.src), {
      tab: {
        title: tab.title,
        muted: tab.muted,
        favicon: tab.favicon,
      },
    });
  }

  function setTabMuted(id, muted) {
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return;
    tab.muted = Boolean(muted);
    if (typeof tab.webview.setAudioMuted === "function") {
      tab.webview.setAudioMuted(tab.muted);
    }
    updateTabsUI();
    scheduleSessionSave();
  }

  function reopenClosedTab() {
    const tab = closedTabs.shift();
    if (!tab) return false;
    createTab(tab.url, { tab });
    return true;
  }

  function showTabContextMenu(id, x, y) {
    if (!tabContextMenu) return;
    const tab = tabs.find((item) => item.id === id);
    if (!tab) return;

    tabContextMenu.innerHTML = "";
    const actions = [
      [tab.pinned ? "Unpin tab" : "Pin tab", () => setTabPinned(id, !tab.pinned)],
      ["Duplicate tab", () => duplicateTab(id)],
      [tab.muted ? "Unmute tab" : "Mute tab", () => setTabMuted(id, !tab.muted)],
      ["Close tab", () => closeTab(id)],
      ["Reopen closed tab", () => reopenClosedTab(), closedTabs.length === 0],
    ];

    actions.forEach(([label, handler, disabled]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = Boolean(disabled);
      button.addEventListener("click", () => {
        tabContextMenu.hidden = true;
        handler();
      });
      tabContextMenu.appendChild(button);
    });

    tabContextMenu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
    tabContextMenu.style.top = `${Math.min(y, window.innerHeight - 190)}px`;
    tabContextMenu.hidden = false;
  }

  // Back and forward button functionality
  backBtn.addEventListener("click", () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab && tab.webview.canGoBack()) tab.webview.goBack();
  });

  forwardBtn.addEventListener("click", () => {
    const tab = getActiveTab();
    if (tab && tab.webview.canGoForward()) tab.webview.goForward();
  });

  reloadStopBtn.addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;

    if (tab.loading) {
      tab.webview.stop();
    } else if (tab.crashed) {
      reloadCrashedTab(tab);
    } else {
      tab.webview.reload();
    }
  });

  homeBtn.addEventListener("click", () => {
    openHomeTab();
  });

  siteInfoButton.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSiteInfoMenu();
  });

  permissionAllow.addEventListener("click", () => resolvePermissionPrompt("allow"));
  permissionDeny.addEventListener("click", () => resolvePermissionPrompt("deny"));
  passwordPromptConfirm?.addEventListener("click", () => resolvePasswordPrompt(true));
  passwordPromptDismiss?.addEventListener("click", () => resolvePasswordPrompt(false));
  passwordPromptNever?.addEventListener("click", () => neverPasswordPrompt());

  toggleSidebarBtn.addEventListener("click", async () => {
    if (!window.nyra) return;

    const sidebarMode = settings.sidebarMode === "compact" ? "expanded" : "compact";
    const nextSettings = await window.nyra.updateSettings({
      sidebarMode,
      showSidebar: sidebarMode === "expanded",
    });
    applySettings(nextSettings);
  });

  bookmarkBtn.addEventListener("click", async () => {
    if (!window.nyra) return;

    const tab = getActiveTab();
    const url = getActiveDisplayUrl();
    if (!tab || !isBookmarkableUrl(url)) return;

    if (bookmarks.some((bookmark) => bookmark.url === url)) {
      bookmarks = await window.nyra.removeBookmark(url);
    } else {
      bookmarks = await window.nyra.addBookmark({
        url,
        title: tab.title || url,
      });
    }

    updateBookmarkButton();
  });

  // Add new tab on + click
  newTabBtn.onclick = () => createTab();
  historyBtn.onclick = () => openHistoryTab();
  settingsBtn.onclick = () => openSettingsTab();
  if (downloadBtn) {
    downloadBtn.disabled = false;
    downloadBtn.onclick = (event) => {
      event.stopPropagation();
      toggleDownloadsMenu();
    };
  }
  if (clearDownloadsBtn) {
    clearDownloadsBtn.onclick = async () => {
      downloads = await window.nyra.clearDownloads();
      renderDownloadsMenu();
    };
  }
  if (openDownloadsFolderBtn) {
    openDownloadsFolderBtn.onclick = () => {
      if (window.nyra) window.nyra.openDownloadsFolder().catch(() => {});
    };
  }
  sideHomeBtn.onclick = () => openHomeTab();
  sideBookmarksBtn.onclick = () => openBookmarksTab();
  if (sideExtensionsBtn) {
    sideExtensionsBtn.onclick = () => openExtensionsTab();
  }
  if (sideDownloadsBtn) {
    sideDownloadsBtn.onclick = () => openDownloadsTab();
  }
  sideHistoryBtn.onclick = () => openHistoryTab();
  sideSettingsBtn.onclick = () => openSettingsTab();
  if (sidePrivateBtn) {
    sidePrivateBtn.onclick = () => openPrivateTab();
  }

  document.addEventListener("click", (event) => {
    if (!downloadsMenu || downloadsMenu.hidden) return;
    if (downloadsMenu.contains(event.target) || downloadBtn.contains(event.target)) return;
    toggleDownloadsMenu(false);
  });

  document.addEventListener("click", (event) => {
    if (siteInfoMenu && !siteInfoMenu.hidden && !siteInfoMenu.contains(event.target) && event.target !== siteInfoButton) {
      toggleSiteInfoMenu(false);
    }
    if (tabContextMenu && !tabContextMenu.hidden && !tabContextMenu.contains(event.target)) {
      tabContextMenu.hidden = true;
    }
  });

  commandPalette?.addEventListener("click", (event) => {
    if (event.target === commandPalette) closeCommandPalette();
  });

  commandSearch?.addEventListener("input", () => {
    commandPaletteIndex = 0;
    renderCommandPalette();
  });

  commandSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCommandPalette();
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowDown") {
      commandPaletteIndex = Math.min(commandPaletteIndex + 1, Math.max(0, visibleCommands.length - 1));
      renderCommandPalette();
      event.preventDefault();
      return;
    }

    if (event.key === "ArrowUp") {
      commandPaletteIndex = Math.max(0, commandPaletteIndex - 1);
      renderCommandPalette();
      event.preventDefault();
      return;
    }

    if (event.key === "Enter") {
      runCommand(visibleCommands[commandPaletteIndex]);
      event.preventDefault();
    }
  });

  // Close tab on x click
  function closeTab(id) {
    const index = tabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    const tab = tabs[index];
    if (pendingPasswordPrompt && pendingPasswordPrompt.tabId === id) {
      hidePasswordPrompt();
    }
    const snapshot = currentPageSnapshot(tab);
    if (snapshot) {
      closedTabs = [snapshot, ...closedTabs].slice(0, 20);
    }
    tab.webview.remove();
    tab.crashView?.remove();
    tabs.splice(index, 1);

    // If it was the last tab, create a new one
    if (tabs.length === 0) {
      activeTabId = null;
      createTab();
      return;
    }

    // If the closed tab was active, switch to the next one
    if (activeTabId === id) {
      const fallback = tabs[index - 1] || tabs[index] || tabs[0];
      switchToTab(fallback.id);
    }

    updateTabsUI();
    scheduleSessionSave();
  }

  async function restoreInitialTabs({ replaceStartupTab = false } = {}) {
    let restoredTabs = [];

    if (window.nyra && settings.restoreSession && !safeMode) {
      const session = await safeNyraCall("loadSession", { tabs: [] }, () => window.nyra.loadSession());
      restoredTabs = Array.isArray(session.tabs)
        ? session.tabs.filter((tab) => tab && isRestorableUrl(tab.url))
        : [];
    }

    if (restoredTabs.length > 1 && restoredTabs.every((tab) => tab.url === "nyra://newtab")) {
      restoredTabs = [restoredTabs[0]];
    }

    if (restoredTabs.length === 0) {
      if (!replaceStartupTab) createTab();
      startupRestorePending = false;
      scheduleSessionSave();
      return;
    }

    if (replaceStartupTab && tabs.length === 1 && displayUrlForSession(tabs[0].webview.src) === defaultNewTabUrl()) {
      const [startupTab] = tabs;
      tabs = [];
      if (startupTab.webview && startupTab.webview.parentNode) {
        startupTab.webview.parentNode.removeChild(startupTab.webview);
      }
    }

    restoredTabs.forEach((tab) => createTab(tab.url, { save: false, tab }));
    startupRestorePending = false;
    scheduleSessionSave();
  }

  createTab(defaultNewTabUrl(), { save: false });
  startupLog("initial local tab created");
  window.setTimeout(hideStartupIntro, 1200);
  if (window.nyra && window.nyra.rendererReady) {
    window.nyra.rendererReady();
  }
  window.setTimeout(() => {
    startupLog("deferred restore start");
    restoreInitialTabs({ replaceStartupTab: true })
      .then(() => startupLog("deferred restore complete"))
      .catch((error) => {
        startupRestorePending = false;
        console.error("Nyra deferred restore failed", error);
      });
  }, 750);

  function performShortcut(action) {
    const tab = getActiveTab();

    if (action === "focus-address-bar") {
      urlInput.focus();
      urlInput.select();
      return true;
    }

    if (action === "new-tab") {
      createTab();
      return true;
    }

    if (action === "close-tab") {
      if (tab) closeTab(tab.id);
      return true;
    }

    if (action === "reopen-closed-tab") {
      return reopenClosedTab();
    }

    if (action === "reload-tab") {
      if (tab && tab.crashed) reloadCrashedTab(tab);
      else if (tab && tab.webview) tab.webview.reload();
      return true;
    }

    if (action === "zoom-in") {
      return setActiveZoom((tab?.zoomFactor || settings.defaultZoom || 1) + 0.1);
    }

    if (action === "zoom-out") {
      return setActiveZoom((tab?.zoomFactor || settings.defaultZoom || 1) - 0.1);
    }

    if (action === "zoom-reset") {
      return setActiveZoom(settings.defaultZoom || 1);
    }

    if (action === "back") {
      if (tab && tab.webview.canGoBack()) tab.webview.goBack();
      return true;
    }

    if (action === "forward") {
      if (tab && tab.webview.canGoForward()) tab.webview.goForward();
      return true;
    }

    if (action === "toggle-devtools") {
      toggleActiveDevTools();
      return true;
    }

    if (action === "command-palette") {
      openCommandPalette();
      return true;
    }

    return false;
  }

  function shortcutActionForEvent(e) {
    const key = e.key.toLowerCase();
    const primary = e.ctrlKey || e.metaKey;

    if (primary && key === "l") return "focus-address-bar";
    if (primary && e.shiftKey && key === "t") return "reopen-closed-tab";
    if (primary && key === "t") return "new-tab";
    if (primary && key === "w") return "close-tab";
    if (primary && key === "r") return "reload-tab";
    if (primary && (key === "+" || key === "=")) return "zoom-in";
    if (primary && key === "-") return "zoom-out";
    if (primary && key === "0") return "zoom-reset";
    if ((primary && key === "k") || (primary && e.shiftKey && key === "p")) return "command-palette";
    if (e.altKey && key === "arrowleft") return "back";
    if (e.altKey && key === "arrowright") return "forward";
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && key === "i")) return "toggle-devtools";
    return "";
  }

  if (window.nyra && window.nyra.onShortcut) {
    window.nyra.onShortcut((action) => {
      performShortcut(action);
    });
  }

  if (window.nyra && window.nyra.onCommand) {
    window.nyra.onCommand((command) => {
      if (command === "new-tab") createTab();
      if (command === "private-tab") openPrivateTab();
      if (command === "history") openHistoryTab();
    });
  }

  if (window.nyra && window.nyra.onOpenUrlNewTab) {
    window.nyra.onOpenUrlNewTab((url) => {
      if (isBookmarkableUrl(url) || url.startsWith("devtools://") || url.startsWith("chrome://")) createTab(url);
    });
  }

  if (window.nyra && window.nyra.onWebviewFullscreenChanged) {
    window.nyra.onWebviewFullscreenChanged((payload) => {
      if (!payload) return;
      setWebviewFullscreen(payload.webContentsId, payload.fullscreen);
    });
  }

  if (window.nyra && window.nyra.onDevToolsState) {
    window.nyra.onDevToolsState((payload) => {
      if (!payload || payload.webContentsId !== devtoolsTargetId) return;
      setDevToolsDockOpen(Boolean(payload.open));
      if (!payload.open) devtoolsTargetId = null;
    });
  }

  window.addEventListener("beforeunload", saveSessionNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveSessionNow();
  });

  // Handle browser shortcuts and DevTools.
  window.addEventListener("keydown", (e) => {
    const action = shortcutActionForEvent(e);
    if (action && performShortcut(action)) {
      e.preventDefault();
    }
  });
});
