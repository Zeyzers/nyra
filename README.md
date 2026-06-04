# Nyra

> - Questo progetto è disponibile anche in **[Italiano](./docs/README.it.md)**
> - Dieses Projekt ist auch in **[Deutsch](./docs/README.de.md)** verfügbar.
> - このプロジェクトは、**[日本語](./docs/README.jp.md)** にもあります。

Nyra is a minimal, personal desktop browser built with Electron.

It is designed to feel quiet, fast and private by default, while still giving you the everyday browser tools you expect: tabs, bookmarks, history, downloads, settings, permissions, saved passwords and automatic updates.

![GitHub repo size](https://img.shields.io/github/repo-size/zeyzers/nyra?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/zeyzers/nyra?style=flat-square)
![GitHub license](https://img.shields.io/github/license/zeyzers/nyra?style=flat-square)

---

## Status

Current version: **1.6.2**

Nyra is actively evolving. Windows is the primary target right now. Linux packaging scripts exist, but Windows is where features and releases are currently validated first.

Download the latest release from:

https://github.com/zeyzers/nyra/releases

---

## Project Status

Nyra is a personal open-source browser project. It is usable, but still experimental. Updates are made in my free time.

---

## Why I Built Nyra

I built Nyra to understand how desktop browsers work, experiment with Electron, and create a browser that feels personal, simple, and hackable.

---

## Features

### Browser Shell

- Dark, flat, modern browser UI with a Nyra accent color system.
- Multi-tab browsing with close buttons, drag and drop reorder, pinned tabs, duplicate tab and mute/unmute.
- Reopen closed tab with `Ctrl+Shift+T`.
- Session restore with saved tab metadata.
- Compact/expanded sidebar with persistent setting.
- Toolbar navigation: back, forward, reload/stop, home, address bar, bookmark, downloads, history and settings.
- Keyboard shortcuts for common browser actions.
- Docked DevTools for the active webview.
- Fullscreen support for sites such as YouTube.
- Startup animation and native Windows icon integration.
- Hardware acceleration setting, applied on restart.

### Internal Pages

Nyra uses internal pages for browser features:

- `nyra://newtab` - Start page with private search and bookmark grid.
- `nyra://blank` - Blank new tab option.
- `nyra://history` - Local browsing history with search and delete controls.
- `nyra://bookmarks` - Bookmarks manager.
- `nyra://downloads` - Downloads manager.
- `nyra://settings` - Settings.
- `nyra://site-data` - Cookies and local storage manager.
- `nyra://diagnostics` - Startup, cache and browser diagnostics.
- `nyra://extensions` - Unpacked extensions management.

### Search and Navigation

- Address bar supports URLs and search queries.
- Search engines: DuckDuckGo, Google and Bing.
- HTTPS-first navigation for bare domains.
- Safe handling for unsupported typed schemes.
- Internal failed-load page with retry controls.
- PDF links are opened with Chromium/Electron where possible; if loading fails, Nyra shows PDF-specific actions such as retry, download PDF and open externally.

### Bookmarks

- Add/remove bookmark from the toolbar.
- Bookmark grid on the New Tab page.
- Full bookmarks manager at `nyra://bookmarks`.
- Edit, delete, search and sort bookmarks.
- One-level bookmark folders.
- Drag and drop bookmark ordering.
- Import/export browser-style bookmarks HTML.
- Bookmarks bar in the browser shell.

### Downloads

- Persistent downloads history stored locally.
- Toolbar downloads dropdown for quick access.
- Full downloads manager at `nyra://downloads`.
- Search and status filters.
- Download states: downloading, completed, failed, canceled and missing.
- Progress, file size, origin, local path and date display.
- Open file, show in folder, retry, remove from list and clear history.
- Live circular progress indicator around the toolbar download icon while downloads are active.
- Completed downloads highlight the toolbar icon until the dropdown is opened.
- Configurable download folder and "ask where to save" setting.

### Password Manager

- Local encrypted password storage using Electron `safeStorage` when available.
- Multiple accounts per origin.
- Explicit save/update prompts.
- Fill saved credentials only after user action.
- Saved passwords management in Settings.
- Reveal, copy username, copy password, delete login and clear all saved logins.
- Passwords are not stored for private tabs.

### Privacy and Security

- Remote pages run in isolated webviews.
- Nyra APIs are exposed only to trusted local pages.
- Node.js is not exposed to remote pages.
- Web popups are blocked by default.
- Only `mailto:` and `tel:` are handed off externally by default.
- Site permissions are handled through Nyra prompts and persisted per domain.
- Permissions manager supports camera, microphone, geolocation and notifications.
- Site data manager can clear cookies/local storage by domain or all at once.
- Private tabs use separate non-default webview partitions and are excluded from saved session/history/password flows.

### Updates and Packaging

- Windows installer: `NyraSetup.exe`.
- Windows portable build: `Nyra.exe`.
- GitHub Releases are used for distribution.
- Packaged builds support update checks through `electron-updater`.
- Release metadata includes `latest.yml` and NSIS blockmaps for updater support.
- Linux packaging scripts are present for `tar.gz`, `AppImage` and `deb`, but Windows is currently the main tested release target.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)

### Clone and Run

```bash
git clone https://github.com/zeyzers/nyra.git
cd nyra
npm install
npm start
```

---

## Development Scripts

```bash
npm start
```

Run Nyra in development mode.

```bash
npm run lint
```

Run syntax checks for main, preload, renderer, helpers and tests.

```bash
npm test
```

Run the local test suite.

```bash
npm run dist
```

Build Windows installer and portable artifacts.

```bash
npm run dist:linux
```

Build the Linux `tar.gz` package.

```bash
npm run dist:linux:full
```

Build Linux `AppImage`, `deb` and `tar.gz` artifacts.

---

## Release Workflow

Nyra uses GitHub Releases for distribution and updater metadata.

Typical release flow:

1. Finish and commit the feature/fix.
2. Bump the version only when a release is actually being prepared.
3. Run `npm run lint`.
4. Run `npm test`.
5. Run `npm run dist`.
6. Commit the version bump.
7. Create a tag such as `v1.6.2`.
8. Create a GitHub Release and upload:
   - `NyraSetup.exe`
   - `NyraSetup.exe.blockmap`
   - `latest.yml`
   - optionally `Nyra.exe`

Versioning is pragmatic semantic versioning:

- Patch: bugfixes, polish and small safe features.
- Minor: larger user-facing feature packs.
- Major: breaking changes or major architecture/data changes.

---

## Storage

Nyra stores browser state in Electron's `userData` directory.

Main state file:

- `nyra-state.json`

It contains settings, session tabs, bookmarks, downloads, permissions, history, extensions metadata and other local browser state.

Passwords are stored separately:

- `passwords.json`

Passwords are encrypted with Electron `safeStorage` when OS encryption is available. Nyra backs up corrupt state/password files before recreating clean defaults.

---

## Privacy Notes

Nyra is local-first:

- No account system.
- No cloud sync.
- No telemetry implementation in this repository.
- No password server.
- No remote Node access from websites.

Some normal browser data still exists locally, such as cookies, local storage, downloads history, saved passwords and browsing history, depending on user behavior and settings.

---

## Roadmap

High-priority areas still worth improving:

- More complete bookmarks bar controls.
- More complete extensions support.
- Reader mode.
- More advanced diagnostics/task-manager style process information.
- Better import/export for full Nyra user data.
- More private-mode polish and audit coverage.
- Stronger PDF handling if Electron/Chromium native PDF behavior proves unreliable.

---

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a branch.
3. Commit your changes.
4. Push your branch.
5. Open a pull request.

Please keep changes focused and avoid mixing unrelated features in one PR.

---

## License

This project is licensed under the MIT License.

---

## Author

Made with curiosity by [@zeyzers](https://github.com/zeyzers).
