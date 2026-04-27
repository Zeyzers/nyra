# Nyra

> - This project is also available in **[English](../README.md)**.
> - Questo progetto è disponibile anche in **[Italiano](./README.it.md)**
> - このプロジェクトは、**[日本語](./README.jp.md)** にもあります。

Nyra ist ein minimalistischer, persönlicher Webbrowser, der mit Electron entwickelt wurde.
Schnell, ablenkungsfrei, datenschutzorientiert — und ganz dein eigener.

![GitHub repo size](https://img.shields.io/github/repo-size/zeyzers/nyra?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/zeyzers/nyra?style=flat-square)
![GitHub license](https://img.shields.io/github/license/zeyzers/nyra?style=flat-square)

---

## ✨ Funktionen

- **Saubere, minimale Benutzeroberfläche**: Konzentriere dich auf das Wesentliche.
- **Dunkles Design bereit**: Ideal für das Surfen bei Nacht.
- **Erstellt mit Electron**: Betrieben mit HTML, CSS und JavaScript.
- **Tastaturbasierte Navigation**: (Geplant) Navigation ganz ohne Maus.
- **Navigationssteuerung**: Vor-/Zurück-Buttons wie bei modernen Browsern.
- **Mehrere Tabs**: Öffne und verwalte mehrere Tabs mühelos.
- **Dynamische Adressleiste**: Aktualisiert sich in Echtzeit mit der aktuellen URL.
- **Dynamischer Fenstertitel**: Zeigt den Seitentitel im App-Fenster an.
- **Intelligente neue Tab-Seite**: Benutzerdefinierte Startseite mit integrierter Suche.
- **Modularer Aufbau**: Einfach zu erweitern und anzupassen.
- **DevTools-Umschalter**: Drücke F12 oder Ctrl+Shift+I, um die aktive Webview zu inspizieren.
- **Persistente Einstellungen**: Nyra speichert Einstellungen in einer kleinen JSON-Zustandsdatei.
- **Sitzungswiederherstellung**: Stellt beim Start optional deine vorherigen Tabs wieder her.
- **Interne Einstellungsseite**: Besuche `nyra://settings`, um grundlegendes Browserverhalten zu ändern.
- **Browser-Steuerung**: Eine dynamische Reload/Stop-Steuerung sowie Home, Einstellungen und Lesezeichen befinden sich in der Toolbar.
- **Einfache Lesezeichen**: Speichere normale Webseiten und greife über `nyra://newtab` darauf zu.
- **Lokaler Verlauf**: Zuletzt besuchte normale Webseiten werden lokal gespeichert und auf `nyra://history` angezeigt.
- **Fehlerseite bei Ladefehlern**: Nyra zeigt eine einfache interne Fehlerseite, wenn Navigation fehlschlägt.
- **Datenschutzfreundliche Standards**: HTTPS-first-Navigation, blockierte Popups und standardmäßig abgelehnte Website-Berechtigungen.

---

## 🚀 Erste Schritte

### Voraussetzungen

Stelle sicher, dass du Folgendes installiert hast:

- [Node.js](https://nodejs.org/) (Version 14 oder höher)
- [Git](https://git-scm.com/)

### Klonen & Starten

Folge diesen Schritten, um loszulegen:

```bash
# Repository klonen
git clone https://github.com/zeyzers/nyra.git

# In das Projektverzeichnis wechseln
cd nyra

# Abhängigkeiten installieren
npm install

# Anwendung starten
npm start
```

---

## 🛠️ Roadmap

- [x] URL über Eingabefeld laden
- [x] Vor-/Zurück-Buttons hinzufügen
- [x] Dynamischer Fenstertitel
- [x] Problem mit doppeltem Scrollen beheben
- [x] Neuer Tab mit intelligenter Suchleiste
- [x] DevTools-Umschalter für die aktive Webview
- [x] Persistente Einstellungen in Electron userData speichern
- [x] Sitzungswiederherstellung
- [x] Einstellungsseite (`nyra://settings`)
- [x] Toolbar-Steuerung für eine dynamische Reload/Stop-Funktion, Home, Einstellungen und Lesezeichen
- [x] Einfache Lesezeichen auf `nyra://newtab`
- [x] Eigener lokaler Verlaufstab (`nyra://history`)
- [x] Interne Fehlerseite mit explizitem HTTP-Retry für lokale Adressen
- [ ] DevTools im selben Fenster andocken
- [ ] Dynamisches Favoritensystem
- [ ] Benutzerdefinierter Hintergrund für neue Tabs
- [ ] Datenschutz-Umschalter (JS / Cookies)
- [x] Unterstützung für mehrere Tabs
- [x] Tab-Schließen-Button hinzufügen
- [ ] About-Seite (`nyra://about`)

---

## 🔒 Datenschutz & Sicherheit

Nyra hält sein Datenschutzmodell derzeit bewusst klein und explizit:

- Domains ohne Protokoll werden standardmäßig mit `https://` geöffnet.
- `nyra://settings` kann HTTPS-first für lokale oder testbezogene Workflows deaktivieren.
- Web-Popups werden blockiert, statt automatisch geöffnet zu werden.
- Website-Berechtigungsanfragen werden standardmäßig abgelehnt, bis Nyra sichtbare Berechtigungskontrollen bietet.
- Nur `mailto:` und `tel:` werden über das Betriebssystem als externe Protokolle geöffnet.
- Unsichere eingegebene Schemas wie `javascript:alert(1)` werden als Suchtext behandelt, nicht als Navigation.
- Fehlgeschlagene HTTPS-Ladevorgänge für `localhost` oder private LAN-IPs oder IPv4-Adressen können nur nach Klick auf den expliziten Button mit HTTP erneut versucht werden.

Persistenter Zustand wird als `nyra-state.json` im Electron-Verzeichnis `userData` gespeichert. Er enthält aktuell Einstellungen, gespeicherte Sitzungstabs, Lesezeichen und aktuellen Verlauf.

Hast du Ideen? Schlage gerne Funktionen oder Verbesserungen vor!

---

## 🤝 Mitwirken

Beiträge sind willkommen! So kannst du helfen:

1. Forke das Repository.
2. Erstelle einen neuen Branch (`git checkout -b feature-name`).
3. Mache deine Änderungen (`git commit -m 'Funktion hinzugefügt'`).
4. Pushe den Branch (`git push origin feature-name`).
5. Eröffne einen Pull Request.

---

## 📜 Lizenz

Dieses Projekt steht unter der MIT-Lizenz.
Du kannst es frei verwenden, ändern und verbreiten — gib einfach dem [Autor](https://github.com/zeyzers) die Anerkennung.

---

## 👤 Autor

Mit Neugier entwickelt von [@zeyzers](https://github.com/zeyzers).
Kontaktiere mich gerne oder sieh dir meine anderen Projekte an!
