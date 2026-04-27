# Nyra

> - Questo progetto è disponibile anche in **[Italiano](./docs/README.it.md)**
> - Dieses Projekt ist auch in **[Deutsch](./docs/README.de.md)** verfügbar.
> - このプロジェクトは、**[日本語](./docs/README.jp.md)** にもあります。

Nyra is a minimal, personal web browser built with Electron.  
Fast, distraction-free, privacy-first — and fully yours.

![GitHub repo size](https://img.shields.io/github/repo-size/zeyzers/nyra?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/zeyzers/nyra?style=flat-square)
![GitHub license](https://img.shields.io/github/license/zeyzers/nyra?style=flat-square)

---

## ✨ Features

- **Clean, minimal UI**: Focus on what matters.  
- **Dark theme ready**: Perfect for night-time browsing.  
- **Built with Electron**: Powered by HTML, CSS, and JavaScript.  
- **Keyboard-first navigation**: (Planned) Navigate effortlessly without a mouse.  
- **Navigation controls**: Forward/back buttons like any modern browser.  
- **Multiple Tabs**: Open and manage multiple tabs seamlessly.  
- **Dynamic address bar**: Updates with current URL in real time.  
- **Dynamic window title**: Shows page title in the app window.  
- **Smart new tab page**: Custom homepage with integrated search.  
- **Modular by design**: Extend and customize with ease.  
- **DevTools toggle**: Press F12 or Ctrl+Shift+I to inspect the active webview.
- **Persistent settings**: Nyra stores settings in a small JSON state file.
- **Session restore**: Optionally restores your previous tabs on launch.
- **Internal settings page**: Visit `nyra://settings` to change core browsing behavior.
- **Browser controls**: A dynamic reload/stop control, home, settings, and bookmark controls live in the toolbar.
- **Basic bookmarks**: Bookmark normal web pages and access them from `nyra://newtab`.
- **Local history**: Recent normal web pages are stored locally and shown on `nyra://history`.
- **Failed-load page**: Nyra shows a simple internal error page when navigation fails.
- **Privacy-minded defaults**: HTTPS-first navigation, blocked popups, and denied site permissions by default.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or later)
- [Git](https://git-scm.com/)

### Clone & Run

Follow these steps to get started:

```bash
# Clone the repository
git clone https://github.com/zeyzers/nyra.git

# Navigate to the project directory
cd nyra

# Install dependencies
npm install

# Start the application
npm start
```

---

## 🛠️ Roadmap

- [x] Load URL via input  
- [x] Add forward/back buttons  
- [x] Dynamic window title  
- [x] Fix double scroll issue  
- [x] New tab with smart search bar  
- [x] DevTools toggle for the active webview
- [x] Persistent settings stored in Electron userData
- [x] Session restore
- [x] Settings page (`nyra://settings`)
- [x] Dynamic reload/stop, home, settings, and bookmark toolbar controls
- [x] Basic bookmarks on `nyra://newtab`
- [x] Dedicated local history tab (`nyra://history`)
- [x] Internal failed-load error page with explicit HTTP retry for local addresses
- [ ] Devtools docked in the same page
- [ ] Dynamic favorites system  
- [ ] Add custom new tab page background  
- [ ] Add privacy toggle (JS / cookies)  
- [x] Add multiple tab support  
- [x] Add close-tab button
- [ ] About page (`nyra://about`)

---

## 🔒 Privacy & Security

Nyra currently keeps its privacy model intentionally small and explicit:

- Bare domains open with `https://` by default.
- `nyra://settings` can disable HTTPS-first behavior for local/testing workflows.
- Web popups are blocked instead of being opened automatically.
- Site permission requests are denied by default until Nyra has user-facing permission controls.
- Only `mailto:` and `tel:` are opened through the operating system as external protocols.
- Unsafe typed schemes such as `javascript:alert(1)` are treated as search text, not navigation.
- Failed HTTPS loads for `localhost` or private LAN IPs or IPv4 addresses can be retried with HTTP only after clicking the explicit retry button.

Persistent state is stored as `nyra-state.json` in Electron's `userData` directory. It currently contains settings, saved session tabs, bookmarks, and recent history.

Got ideas? Feel free to suggest features or improvements!

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature-name`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature-name`).
5. Open a pull request.

---

## 📜 License

This project is licensed under the MIT License.  
Feel free to use, modify, and distribute — just give credit to the [author](https://github.com/zeyzers).

---

## 👤 Author

Made with curiosity by [@zeyzers](https://github.com/zeyzers).  
Feel free to reach out or explore my other projects!
