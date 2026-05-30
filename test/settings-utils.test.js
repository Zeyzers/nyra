const assert = require("node:assert/strict");
const { ACCENTS, applyAppearance, normalizeSettings, searchUrl } = require("../src/settings-utils");

function createTarget() {
  const classes = new Set();

  return {
    dataset: {},
    classList: {
      toggle(name, active) {
        if (active) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
      contains(name) {
        return classes.has(name);
      },
    },
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value;
      },
    },
  };
}

{
  const settings = normalizeSettings({
    theme: "light",
    accentColor: "green",
    showSidebar: false,
    sidebarMode: "compact",
    compactLayout: true,
    newTabDensity: "compact",
    compactTabs: true,
    tabCloseButtonMode: "hover",
  });
  const target = createTarget();

  applyAppearance(settings, target);

  assert.equal(target.dataset.theme, "light");
  assert.equal(target.style.values["--accent"], ACCENTS.green.color);
  assert.equal(target.style.values["--accent-soft"], ACCENTS.green.soft);
  assert.equal(target.classList.contains("sidebar-compact"), true);
  assert.equal(target.classList.contains("compact-layout"), true);
  assert.equal(target.classList.contains("newtab-density-compact"), true);
  assert.equal(target.classList.contains("compact-tabs"), true);
  assert.equal(target.classList.contains("tab-close-hover"), true);
}

{
  assert.equal(searchUrl("nyra browser", "google"), "https://www.google.com/search?q=nyra%20browser");
  assert.equal(searchUrl("nyra browser", "bing"), "https://www.bing.com/search?q=nyra%20browser");
}

console.log("settings-utils: appearance and search helpers passed");
