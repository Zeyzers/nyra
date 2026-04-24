(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NyraUrl = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SEARCH_URL = "https://duckduckgo.com/?q=";
  const WEB_SCHEME_RE = /^https?:\/\//i;
  const EXTERNAL_SCHEME_RE = /^(mailto|tel):/i;
  const SAFE_INPUT_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
  const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
  const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

  function searchUrl(query) {
    return SEARCH_URL + encodeURIComponent(query);
  }

  function hasWhitespace(value) {
    return /\s/.test(value);
  }

  function isValidIPv4(hostname) {
    if (!IPV4_RE.test(hostname)) return false;
    return hostname.split(".").every((part) => Number(part) <= 255);
  }

  function isValidDomain(hostname) {
    const labels = hostname.split(".");
    if (labels.length < 2 || labels.some((label) => label.length === 0)) {
      return false;
    }

    const tld = labels[labels.length - 1];
    return (
      /^[a-z]{2,}$/i.test(tld) &&
      labels.every((label) => DOMAIN_LABEL_RE.test(label))
    );
  }

  function isValidAddressHost(hostname) {
    return (
      hostname === "localhost" ||
      isValidIPv4(hostname) ||
      isValidDomain(hostname)
    );
  }

  function normalizeUrlInput(input, options = {}) {
    const httpsFirst = options.httpsFirst !== false;
    const value = String(input || "").trim();
    if (!value) return "";

    if (hasWhitespace(value)) {
      return searchUrl(value);
    }

    if (WEB_SCHEME_RE.test(value) || EXTERNAL_SCHEME_RE.test(value)) {
      try {
        const url = new URL(value);
        if (SAFE_INPUT_PROTOCOLS.has(url.protocol)) {
          return url.href;
        }
        return searchUrl(value);
      } catch {
        return searchUrl(value);
      }
    }

    try {
      const protocol = httpsFirst ? "https" : "http";
      const url = new URL(`${protocol}://${value}`);
      if (isValidAddressHost(url.hostname)) {
        return url.href;
      }
    } catch {
      // Fall through to search for malformed domain-like input.
    }

    return searchUrl(value);
  }

  return {
    normalizeUrlInput,
    searchUrl,
  };
});
