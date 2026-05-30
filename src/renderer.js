window.addEventListener("DOMContentLoaded", async () => {
  // Virtual routes for nyra:// URLs. Internal pages are the only local files
  // allowed inside webviews by the main-process navigation guard.
  const virtualRoutes = {
    "nyra://newtab": "./newtab.html",
    "nyra://blank": "./blank.html",
    "nyra://bookmarks": "./bookmarks.html",
    "nyra://history": "./history.html",
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
  const bookmarkBtn = document.getElementById("bookmark");
  const downloadBtn = document.getElementById("download");
  const historyBtn = document.getElementById("history");
  const settingsBtn = document.getElementById("settings");
  const sideHomeBtn = document.getElementById("side-home");
  const sideHistoryBtn = document.getElementById("side-history");
  const sideBookmarksBtn = document.getElementById("side-bookmarks");
  const sideDownloadsBtn = document.getElementById("side-downloads");
  const sideSettingsBtn = document.getElementById("side-settings");
  const tabsContainer = document.getElementById("tabs");
  const newTabBtn = document.getElementById("new-tab");
  const webviewsContainer = document.getElementById("webviews-container");
  const downloadsMenu = document.getElementById("downloads-menu");
  const downloadsList = document.getElementById("downloads-list");
  const clearDownloadsBtn = document.getElementById("clear-downloads");
  const openDownloadsFolderBtn = document.getElementById("open-downloads-folder");

  let tabs = [];
  let activeTabId = null;
  let settings = DEFAULT_SETTINGS;
  let bookmarks = [];
  let downloads = [];
  let sessionSaveTimer = null;
  let draggedTabId = null;

  function applyZoomToWebviews() {
    tabs.forEach((tab) => {
      if (tab.webview && typeof tab.webview.setZoomFactor === "function") {
        try {
          tab.webview.setZoomFactor(settings.defaultZoom || 1);
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

    if (previousTheme && previousTheme !== settings.theme) {
      reloadRemoteWebviewsForTheme();
    }
  }

  if (window.nyra) {
    applySettings(await window.nyra.getSettings());
    bookmarks = await window.nyra.getBookmarks();
    downloads = await window.nyra.getDownloads();

    window.nyra.onSettingsChanged((nextSettings) => {
      applySettings(nextSettings);
      updateTabsUI();
    });

    window.nyra.onStateReset((state) => {
      applySettings((state && state.settings) || DEFAULT_SETTINGS);
      bookmarks = (state && state.bookmarks) || [];
      updateBookmarkButton();
    });

    window.nyra.onBookmarksChanged((nextBookmarks) => {
      bookmarks = Array.isArray(nextBookmarks) ? nextBookmarks : [];
      updateBookmarkButton();
    });

    window.nyra.onDownloadsChanged((nextDownloads) => {
      downloads = Array.isArray(nextDownloads) ? nextDownloads : [];
      renderDownloadsMenu();
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
      url === "nyra://history" ||
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
      .map((tab) => ({
        url: displayUrlForSession(tab.webview.src),
        title: tab.title || "New Tab",
      }))
      .filter((tab) => isRestorableUrl(tab.url));

    if (sessionTabs.length > 1 && sessionTabs.every((tab) => tab.url === "nyra://newtab")) {
      return [sessionTabs[0]];
    }

    return sessionTabs;
  }

  function scheduleSessionSave() {
    if (!window.nyra) return;

    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(() => {
      window.nyra.saveSession(getSessionTabs()).catch(() => {});
    }, 150);
  }

  function srcForUrl(url) {
    return virtualRoutes[url] ? routeToSrc(url) : url;
  }

  function navigateTab(tab, url) {
    if (!tab || !tab.webview) return;

    tab.webview.src = srcForUrl(url);
  }

  function errorPageSrc(failedUrl, errorCode, errorDescription) {
    const params = new URLSearchParams({
      url: failedUrl,
      code: String(errorCode),
      description: errorDescription || "Load failed",
    });

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

  function isBookmarkableUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
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
      progress.textContent = `${download.state || "downloading"} · ${download.percent || 0}% · ${formatBytes(download.receivedBytes)}${total}`;

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
      showBtn.disabled = !download.savePath;
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

  function toggleDownloadsMenu(forceOpen) {
    if (!downloadsMenu || !downloadBtn) return;

    const open = typeof forceOpen === "boolean" ? forceOpen : downloadsMenu.hidden;
    downloadsMenu.hidden = !open;
    downloadBtn.setAttribute("aria-expanded", String(open));
    if (open) renderDownloadsMenu();
  }

  function isHistoryUrl(url) {
    return isBookmarkableUrl(url);
  }

  function recordHistoryForTab(tab, navigatedUrl = tab.webview.src) {
    if (!window.nyra || !tab || isErrorPageSrc(tab.webview.src)) return;

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
    const isBookmarked = bookmarks.some((bookmark) => bookmark.url === url);
    bookmarkBtn.textContent = isBookmarked ? "★" : "☆";
    bookmarkBtn.classList.toggle("bookmarked", isBookmarked);
    bookmarkBtn.disabled = !isBookmarkableUrl(url);
    bookmarkBtn.title = isBookmarked ? "Remove bookmark" : "Bookmark this page";
  }

  function updateReloadStopButton() {
    if (!reloadStopBtn) return;

    const tab = getActiveTab();
    const isLoading = Boolean(tab && tab.loading);
    reloadStopBtn.textContent = isLoading ? "✕" : "↻";
    reloadStopBtn.title = isLoading ? "Stop loading" : "Reload";
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

  function openHomeTab() {
    const tab = getActiveTab();
    if (tab) {
      navigateTab(tab, defaultNewTabUrl());
    } else {
      createTab();
    }
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
    const tab = {
      id,
      title: url === "nyra://history"
        ? "History"
        : url === "nyra://settings"
          ? "Settings"
          : url === "nyra://bookmarks"
            ? "Bookmarks"
            : "New Tab",
      url,
      loading: false,
      webview: document.createElement("webview"),
    };

    tab.webview.style.display = "none";

    tab.webview.addEventListener("did-start-loading", () => {
      tab.loading = true;
      if (tab.id === activeTabId) updateReloadStopButton();
    });

    tab.webview.addEventListener("did-stop-loading", () => {
      tab.loading = false;
      if (tab.id === activeTabId) updateReloadStopButton();
    });

    tab.webview.addEventListener("dom-ready", () => {
      if (typeof tab.webview.setZoomFactor === "function") {
        tab.webview.setZoomFactor(settings.defaultZoom || 1);
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
      }
    });

    // Handle URL input on change
    tab.webview.addEventListener("did-navigate", (e) => {
      if (tab.id === activeTabId) {
        urlInput.value = resolveVirtualUrl(e.url);
      }
      updateBookmarkButton();
      recordHistoryForTab(tab, e.url);
      scheduleSessionSave();
    });

    tab.webview.addEventListener("did-navigate-in-page", (e) => {
      if (tab.id === activeTabId) {
        urlInput.value = resolveVirtualUrl(e.url);
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
      }

      if (e.isMainFrame !== false && e.errorCode !== -3 && !failedUrl.startsWith("file:")) {
        navigateTab(tab, errorPageSrc(failedUrl, e.errorCode, e.errorDescription));
      }

      updateBookmarkButton();
      if (tab.id === activeTabId) updateReloadStopButton();
      scheduleSessionSave();
    });

    webviewsContainer.appendChild(tab.webview);
    tabs.push(tab);
    navigateTab(tab, url);
    switchToTab(id);

    if (options.save !== false) scheduleSessionSave();
  }

  // Switch to a tab by ID
  function switchToTab(id) {
    tabs.forEach((tab) => {
      const isActive = tab.id === id;
      tab.webview.style.display = isActive ? "flex" : "none";
      tab.webview.classList.toggle("active", isActive);
    });
    activeTabId = id;

    const activeTab = tabs.find((t) => t.id === id);
    if (activeTab) {
      urlInput.value = resolveVirtualUrl(activeTab.webview.src);
      document.title = activeTab.title;
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
      tabBtn.draggable = true;
      tabBtn.dataset.tabId = tab.id;

      const fullTitle = tab.title || "New Tab";
      let label = fullTitle;
      if (label.length > 20) label = label.slice(0, 20) + "...";

      const tabIcon = document.createElement("span");
      tabIcon.className = "tab-icon";
      const tabUrl = displayUrlForSession(tab.webview.src);
      tabIcon.textContent = tabUrl === "nyra://history"
        ? "◷"
        : tabUrl === "nyra://settings"
          ? "⚙"
          : tabUrl === "nyra://bookmarks"
            ? "☆"
            : "◉";

      const tabLabel = document.createElement("span");
      tabLabel.className = "tab-label";
      tabLabel.textContent = label;

      tabBtn.title = fullTitle;
      tabBtn.onclick = () => switchToTab(tab.id);
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
      closeBtn.textContent = "×";
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      };

      tabBtn.append(tabIcon, tabLabel, closeBtn);
      tabsContainer.appendChild(tabBtn);
    });
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
    } else {
      tab.webview.reload();
    }
  });

  homeBtn.addEventListener("click", () => {
    openHomeTab();
  });

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
  if (sideDownloadsBtn) {
    sideDownloadsBtn.onclick = (event) => {
      event.stopPropagation();
      toggleDownloadsMenu(true);
    };
  }
  sideHistoryBtn.onclick = () => openHistoryTab();
  sideSettingsBtn.onclick = () => openSettingsTab();

  document.addEventListener("click", (event) => {
    if (!downloadsMenu || downloadsMenu.hidden) return;
    if (downloadsMenu.contains(event.target) || downloadBtn.contains(event.target)) return;
    toggleDownloadsMenu(false);
  });

  // Close tab on x click
  function closeTab(id) {
    const index = tabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    const tab = tabs[index];
    tab.webview.remove();
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

  async function restoreInitialTabs() {
    let restoredTabs = [];

    if (window.nyra && settings.restoreSession) {
      const session = await window.nyra.loadSession();
      restoredTabs = Array.isArray(session.tabs)
        ? session.tabs.filter((tab) => tab && isRestorableUrl(tab.url))
        : [];
    }

    if (restoredTabs.length > 1 && restoredTabs.every((tab) => tab.url === "nyra://newtab")) {
      restoredTabs = [restoredTabs[0]];
    }

    if (restoredTabs.length === 0) {
      createTab();
      return;
    }

    restoredTabs.forEach((tab) => createTab(tab.url, { save: false }));
    scheduleSessionSave();
  }

  await restoreInitialTabs();

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

    if (action === "reload-tab") {
      if (tab && tab.webview) tab.webview.reload();
      return true;
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
      if (tab && tab.webview) {
        if (tab.webview.isDevToolsOpened?.()) {
          tab.webview.closeDevTools();
        } else {
          tab.webview.openDevTools();
        }
      }
      return true;
    }

    return false;
  }

  function shortcutActionForEvent(e) {
    const key = e.key.toLowerCase();
    const primary = e.ctrlKey || e.metaKey;

    if (primary && key === "l") return "focus-address-bar";
    if (primary && key === "t") return "new-tab";
    if (primary && key === "w") return "close-tab";
    if (primary && key === "r") return "reload-tab";
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

  if (window.nyra && window.nyra.onOpenUrlNewTab) {
    window.nyra.onOpenUrlNewTab((url) => {
      if (isBookmarkableUrl(url)) createTab(url);
    });
  }

  // Handle browser shortcuts and DevTools.
  window.addEventListener("keydown", (e) => {
    const action = shortcutActionForEvent(e);
    if (action && performShortcut(action)) {
      e.preventDefault();
    }
  });
});
