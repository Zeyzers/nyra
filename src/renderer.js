window.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("url");
  const viewer = document.getElementById("viewer");
  const backBtn = document.getElementById("back");
  const forwardBtn = document.getElementById("forward");

  // Update window title
  viewer.addEventListener("page-title-updated", (e) => {
    document.title = e.title + " - Nyra";
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

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      let url = urlInput.value.trim();
      if (isLikelySearch(url)) {
        url = "https://duckduckgo.com/?q=" + encodeURIComponent(url);
      } else if (!url.startsWith("http")) {
        url = "http://" + url;
      }
      viewer.src = url;
      urlInput.blur();
    }
  });

  viewer.addEventListener("did-navigate-in-page", (e) => {
    urlInput.value = e.url;
  });

  viewer.addEventListener("did-navigate", (e) => {
    urlInput.value = e.url;
  });

  viewer.addEventListener("did-fail-load", (e) => {
    urlInput.value = viewer.src;
  });

  backBtn.addEventListener("click", () => {
    if (viewer.canGoBack()) viewer.goBack();
  });

  forwardBtn.addEventListener("click", () => {
    if (viewer.canGoForward()) viewer.goForward();
  });

  urlInput.focus();
});
