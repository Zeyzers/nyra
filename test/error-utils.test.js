const assert = require("node:assert/strict");
const { canRetryWithHttp, getHttpRetryUrl, isPrivateIPv4 } = require("../src/error-utils");

assert.equal(isPrivateIPv4("127.0.0.1"), true);
assert.equal(isPrivateIPv4("10.0.0.5"), true);
assert.equal(isPrivateIPv4("172.16.1.5"), true);
assert.equal(isPrivateIPv4("192.168.1.20"), true);
assert.equal(isPrivateIPv4("8.8.8.8"), false);

assert.equal(canRetryWithHttp("https://localhost:3000/test"), true);
assert.equal(getHttpRetryUrl("https://localhost:3000/test"), "http://localhost:3000/test");
assert.equal(canRetryWithHttp("https://192.168.1.20/app"), true);
assert.equal(getHttpRetryUrl("https://192.168.1.20/app"), "http://192.168.1.20/app");
assert.equal(canRetryWithHttp("https://8.8.8.8/dns"), true);
assert.equal(getHttpRetryUrl("https://8.8.8.8/dns"), "http://8.8.8.8/dns");
assert.equal(canRetryWithHttp("https://example.com"), false);
assert.equal(canRetryWithHttp("http://localhost:3000/test"), false);
assert.equal(getHttpRetryUrl("https://example.com"), "");

console.log("error-utils: retry checks passed");
