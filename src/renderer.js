window.addEventListener("DOMContentLoaded", async () => {
  // Virtual routes for nyra:// URLs. Internal pages are the only local files
  // allowed inside webviews by the main-process navigation guard.
  const virtualRoutes = {
    "nyra://newtab": "./newtab.html",
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
  const bookmarkBtn = document.getElementById("bookmark");
  const historyBtn = document.getElementById("history");
  const settingsBtn = document.getElementById("settings");
  const tabsContainer = document.getElementById("tabs");
  const newTabBtn = document.getElementById("new-tab");
  const webviewsContainer = document.getElementById("webviews-container");

  let tabs = [];
  let activeTabId = null;
  let settings = DEFAULT_SETTINGS;
  let bookmarks = [];
  let sessionSaveTimer = null;

  if (window.nyra) {
    settings = {
      ...DEFAULT_SETTINGS,
      ...(await window.nyra.getSettings()),
    };
    bookmarks = await window.nyra.getBookmarks();

    window.nyra.onSettingsChanged((nextSettings) => {
      settings = {
        ...DEFAULT_SETTINGS,
        ...nextSettings,
      };
    });

    window.nyra.onStateReset((state) => {
      settings = {
        ...DEFAULT_SETTINGS,
        ...(state && state.settings),
      };
      bookmarks = (state && state.bookmarks) || [];
      updateBookmarkButton();
    });

    window.nyra.onBookmarksChanged((nextBookmarks) => {
      bookmarks = Array.isArray(nextBookmarks) ? nextBookmarks : [];
      updateBookmarkButton();
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

  function isRestorableUrl(url) {
    if (url === "nyra://newtab" || url === "nyra://history" || url === "nyra://settings") {
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
        });
        if (normalizedUrl) navigateTab(tab, normalizedUrl);
      }

      urlInput.blur();
    }
  });

  // Create and initialize a new tab
  function createTab(url = "nyra://newtab", options = {}) {
    const id = crypto.randomUUID();
    const tab = {
      id,
      title: url === "nyra://history" ? "History" : url === "nyra://settings" ? "Settings" : "New Tab",
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
    switchToTab(id);
    navigateTab(tab, url);

    if (options.save !== false) scheduleSessionSave();
  }

  // Switch to a tab by ID
  function switchToTab(id) {
    tabs.forEach((tab) => {
      tab.webview.style.display = tab.id === id ? "flex" : "none";
    });
    activeTabId = id;

    const activeTab = tabs.find((t) => t.id === id);
    if (activeTab) {
      urlInput.value = resolveVirtualUrl(activeTab.webview.src);
      document.title = activeTab.title;
    }

    updateBookmarkButton();
    updateReloadStopButton();
    updateTabsUI();
  }

  // Update the tab UI bar
  function updateTabsUI() {
    tabsContainer.innerHTML = "";

    tabs.forEach((tab) => {
      const tabBtn = document.createElement("div");
      tabBtn.className = "tab" + (tab.id === activeTabId ? " active" : "");

      const fullTitle = tab.title || "New Tab";
      let label = fullTitle;
      if (label.length > 20) label = label.slice(0, 20) + "...";

      tabBtn.textContent = label;
      tabBtn.title = fullTitle;
      tabBtn.onclick = () => switchToTab(tab.id);

      // Create close button
      const closeBtn = document.createElement("button");
      closeBtn.className = "close-btn";
      closeBtn.textContent = "×";
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      };

      tabBtn.appendChild(closeBtn);
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
    const tab = getActiveTab();
    if (tab) {
      navigateTab(tab, "nyra://newtab");
    } else {
      createTab();
    }
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

  // Handle Dev Tools (toggle with docked mode)
  window.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i"))
    ) {
      e.preventDefault();
      const tab = tabs.find((t) => t.id === activeTabId);
      if (tab && tab.webview) {
        if (tab.webview.isDevToolsOpened?.()) {
          tab.webview.closeDevTools();
        } else {
          tab.webview.openDevTools();
        }
      }
    }
  });
});
