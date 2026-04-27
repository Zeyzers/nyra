(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.NyraError = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isIPv4(hostname) {
    return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
      && hostname.split(".").every((part) => Number(part) <= 255);
  }

  function isPrivateIPv4(hostname) {
    if (!isIPv4(hostname)) return false;

    const parts = hostname.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254)
    );
  }

  function canRetryWithHttp(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && (
        url.hostname === "localhost" ||
        isIPv4(url.hostname) ||
        isPrivateIPv4(url.hostname)
      );
    } catch {
      return false;
    }
  }

  function getHttpRetryUrl(value) {
    if (!canRetryWithHttp(value)) return "";

    const url = new URL(value);
    url.protocol = "http:";
    return url.href;
  }

  return {
    canRetryWithHttp,
    getHttpRetryUrl,
    isPrivateIPv4,
  };
});
