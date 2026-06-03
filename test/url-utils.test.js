const assert = require("node:assert/strict");
const { isPdfResponse, isPdfUrl, normalizeUrlInput } = require("../src/url-utils");

const cases = [
  ["https://example.com/path?q=1", "https://example.com/path?q=1"],
  ["http://example.com", "http://example.com/"],
  ["example.com", "https://example.com/"],
  ["example.com", "http://example.com/", { httpsFirst: false }],
  ["example.com/docs", "https://example.com/docs"],
  ["example.com/docs", "http://example.com/docs", { httpsFirst: false }],
  ["localhost", "https://localhost/"],
  ["localhost", "http://localhost/", { httpsFirst: false }],
  ["localhost:3000/test", "https://localhost:3000/test"],
  ["localhost:3000/test", "http://localhost:3000/test", { httpsFirst: false }],
  ["127.0.0.1", "https://127.0.0.1/"],
  ["192.168.1.20:8080/path", "https://192.168.1.20:8080/path"],
  ["nyra browser privacy", "https://duckduckgo.com/?q=nyra%20browser%20privacy"],
  ["nyra browser privacy", "https://www.google.com/search?q=nyra%20browser%20privacy", { searchEngine: "google" }],
  ["nyra browser privacy", "https://www.bing.com/search?q=nyra%20browser%20privacy", { searchEngine: "bing" }],
  ["example..com", "https://duckduckgo.com/?q=example..com"],
  ["exa_mple.com", "https://duckduckgo.com/?q=exa_mple.com"],
  ["not-a-domain", "https://duckduckgo.com/?q=not-a-domain"],
  ["javascript:alert(1)", "https://duckduckgo.com/?q=javascript%3Aalert(1)"],
];

for (const [input, expected, options] of cases) {
  assert.equal(normalizeUrlInput(input, options), expected, input);
}

assert.equal(isPdfUrl("https://example.com/file.pdf"), true);
assert.equal(isPdfUrl("https://example.com/file.pdf?download=1"), true);
assert.equal(isPdfUrl("https://example.com/file.PDF#page=2"), true);
assert.equal(isPdfUrl("https://example.com/file.txt"), false);
assert.equal(isPdfResponse({ "content-type": "application/pdf" }), true);
assert.equal(isPdfResponse({ "Content-Type": ["text/html", "application/pdf; charset=binary"] }), true);
assert.equal(isPdfResponse({ "content-type": "text/html" }), false);

console.log(`url-utils: ${cases.length} cases and PDF helpers passed`);
