(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NyraSettings = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ACCENTS = {
    pink: { name: "Nyra Pink", color: "#ff4f86", soft: "rgba(255, 79, 134, 0.18)" },
    blue: { name: "Blue", color: "#4f8cff", soft: "rgba(79, 140, 255, 0.18)" },
    purple: { name: "Purple", color: "#9b6cff", soft: "rgba(155, 108, 255, 0.18)" },
    green: { name: "Green", color: "#35c78a", soft: "rgba(53, 199, 138, 0.18)" },
    orange: { name: "Orange", color: "#ff9b45", soft: "rgba(255, 155, 69, 0.18)" },
  };

  const SEARCH_ENGINES = {
    duckduckgo: {
      name: "DuckDuckGo",
      searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    },
    google: {
      name: "Google",
      searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    },
    bing: {
      name: "Bing",
      searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    },
  };

  const DEFAULT_SETTINGS = {
    httpsFirst: true,
    searchEngine: "duckduckgo",
    restoreSession: true,
    startupBehavior: "newtab",
    newTabPage: "start",
    theme: "dark",
    accentColor: "pink",
    showSidebar: true,
    sidebarMode: "expanded",
    compactLayout: false,
    newTabDensity: "comfortable",
    compactTabs: false,
    tabCloseButtonMode: "always",
    defaultZoom: 1,
    askDownloadLocation: false,
    downloadPath: "",
  };

  function normalizeSettings(settings = {}) {
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  }

  function searchUrl(query, searchEngine = DEFAULT_SETTINGS.searchEngine) {
    const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES[DEFAULT_SETTINGS.searchEngine];
    return engine.searchUrl(query);
  }

  function applyAppearance(settings = {}, target = document.body) {
    if (!target) return;

    const nextSettings = normalizeSettings(settings);
    const accent = ACCENTS[nextSettings.accentColor] || ACCENTS[DEFAULT_SETTINGS.accentColor];

    target.dataset.theme = nextSettings.theme;
    if (target.ownerDocument && target.ownerDocument.documentElement) {
      target.ownerDocument.documentElement.dataset.theme = nextSettings.theme;
    }
    target.classList.toggle("sidebar-compact", nextSettings.sidebarMode === "compact" || !nextSettings.showSidebar);
    target.classList.toggle("compact-layout", Boolean(nextSettings.compactLayout));
    target.classList.toggle("newtab-density-compact", nextSettings.newTabDensity === "compact");
    target.classList.toggle("compact-tabs", Boolean(nextSettings.compactTabs));
    target.classList.toggle("tab-close-hover", nextSettings.tabCloseButtonMode === "hover");
    target.style.setProperty("--accent", accent.color);
    target.style.setProperty("--accent-soft", accent.soft);
  }

  return {
    ACCENTS,
    SEARCH_ENGINES,
    DEFAULT_SETTINGS,
    applyAppearance,
    normalizeSettings,
    searchUrl,
  };
});
