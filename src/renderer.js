window.addEventListener("DOMContentLoaded", () => {
  // Virtual routes for nyra:// URLs
  // These are the URLs that will be resolved to local files
  const virtualRoutes = {
    "nyra://newtab": "./newtab.html",
    // Add more virtual routes here
    // "nyra://example": "./example.html",
  };

  const urlInput = document.getElementById("url");
  const backBtn = document.getElementById("back");
  const forwardBtn = document.getElementById("forward");
  const tabsContainer = document.getElementById("tabs");
  const newTabBtn = document.getElementById("new-tab");
  const webviewsContainer = document.getElementById("webviews-container");

  let tabs = [];
  let activeTabId = null;

  // Resolve virtual URL to real URL
  const resolveVirtualUrl = (realUrl) => {
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

  // Heuristic to determine if input is a likely search
  const isLikelySearch = (text) => {
    const isLocal = /^localhost(:\d+)?$/.test(text);
    const isIP = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(text);
    const hasProtocol =
      text.startsWith("http://") || text.startsWith("https://");
    const looksLikeDomain = text.includes(".");
    return !hasProtocol && !isLocal && !isIP && !looksLikeDomain;
  };

  // Check if the URL is a likely search query
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;

      let url = urlInput.value.trim();
      if (url.startsWith("nyra://") && virtualRoutes[url]) {
        tab.webview.src = virtualRoutes[url];
      } else if (isLikelySearch(url)) {
        tab.webview.src =
          "https://duckduckgo.com/?q=" + encodeURIComponent(url);
      } else if (!url.startsWith("http")) {
        tab.webview.src = "http://" + url;
      } else {
        tab.webview.src = url;
      }

      urlInput.blur();
    }
  });

  // Create and initialize a new tab
  function createTab(url = "nyra://newtab") {
    const id = crypto.randomUUID();
    const tab = {
      id,
      title: "New Tab",
      url,
      webview: document.createElement("webview"),
    };

    tab.webview.src = virtualRoutes[url] || url;
    tab.webview.style.display = "none";

    tab.webview.setAttribute("allowpopups", "");

    // Update tab title and document title
    tab.webview.addEventListener("page-title-updated", (e) => {
      tab.title = e.title;
      updateTabsUI();
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
    });

    tab.webview.addEventListener("did-navigate-in-page", (e) => {
      if (tab.id === activeTabId) {
        urlInput.value = resolveVirtualUrl(e.url);
      }
    });

    tab.webview.addEventListener("did-fail-load", (e) => {
      if (tab.id === activeTabId) {
        urlInput.value = resolveVirtualUrl(tab.webview.src);
      }
    });

    webviewsContainer.appendChild(tab.webview);
    tabs.push(tab);
    switchToTab(id);
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

    updateTabsUI();
  }

  // Update the tab UI bar
  function updateTabsUI() {
    tabsContainer.innerHTML = "";

    tabs.forEach((tab) => {
      const tabBtn = document.createElement("div");
      tabBtn.className = "tab" + (tab.id === activeTabId ? " active" : "");

      // Troncamento se troppo lungo, ma mantieni tooltip completo
      const fullTitle = tab.title || "New Tab";
      let label = fullTitle;
      if (label.length > 20) {
        label = label.slice(0, 20) + "...";
      }

      tabBtn.textContent = label;
      tabBtn.title = fullTitle; // Tooltip

      tabBtn.onclick = () => switchToTab(tab.id);
      tabsContainer.appendChild(tabBtn);
    });
  }

  // Back and forward button functionality
  backBtn.addEventListener("click", () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab && tab.webview.canGoBack()) tab.webview.goBack();
  });

  forwardBtn.addEventListener("click", () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab && tab.webview.canGoForward()) tab.webview.goForward();
  });

  // Add new tab on + click
  newTabBtn.onclick = () => createTab();

  // Create the first tab on launch
  createTab();
});
