window.addEventListener("DOMContentLoaded", () => {
  // Virtual routes for nyra:// URLs
  // These are the URLs that will be resolved to local files
  const virtualRoutes = {
    "nyra://newtab": "./newtab.html",
    // Add more virtual routes here
    // "nyra://example": "./example.html",
  };
  const urlInput = document.getElementById("url");
  const viewer = document.getElementById("viewer");
  const backBtn = document.getElementById("back");
  const forwardBtn = document.getElementById("forward");

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

  // Update window title
  viewer.addEventListener("page-title-updated", (e) => {
    if (!e.title.startsWith("nyra")) {
      document.title = e.title + " - Nyra";
    } else {
      document.title = "Nyra";
    }
  });

  // URL logic
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
      let url = urlInput.value.trim();
      if (url.startsWith("nyra://") && virtualRoutes[url]) {
        viewer.src = virtualRoutes[url];
        return;
      } else if (isLikelySearch(url)) {
        url = "https://duckduckgo.com/?q=" + encodeURIComponent(url);
      } else if (!url.startsWith("http")) {
        url = "http://" + url;
      }
      viewer.src = url;
      urlInput.blur();
    }
  });

  viewer.addEventListener("did-navigate", (e) => {
    urlInput.value = resolveVirtualUrl(e.url);
  });

  viewer.addEventListener("did-navigate-in-page", (e) => {
    urlInput.value = resolveVirtualUrl(e.url);
  });

  viewer.addEventListener("did-fail-load", (e) => {
    urlInput.value = resolveVirtualUrl(viewer.src);
  });

  backBtn.addEventListener("click", () => {
    if (viewer.canGoBack()) viewer.goBack();
  });

  forwardBtn.addEventListener("click", () => {
    if (viewer.canGoForward()) viewer.goForward();
  });

  urlInput.focus();
});
