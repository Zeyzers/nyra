# Nyra

> - This project is also available in **[English](../README.md)**.
> - Questo progetto è disponibile anche in **[Italiano](./README.it.md)**.
> - このプロジェクトは、**[日本語](./README.jp.md)** にもあります。

Nyra ist ein minimalistischer, persönlicher Desktop-Browser, der mit Electron entwickelt wird.

Er soll ruhig, schnell und standardmäßig privat wirken, aber trotzdem die alltäglichen Browser-Werkzeuge bieten: Tabs, Lesezeichen, Verlauf, Downloads, Einstellungen, Berechtigungen, gespeicherte Passwörter und automatische Updates.

![GitHub repo size](https://img.shields.io/github/repo-size/zeyzers/nyra?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/zeyzers/nyra?style=flat-square)
![GitHub license](https://img.shields.io/github/license/zeyzers/nyra?style=flat-square)

---

## Status

Aktuelle Version: **1.7.0**

Nyra wird aktiv weiterentwickelt. Windows ist aktuell das wichtigste Ziel. Es gibt Packaging-Skripte für Linux, aber Features und Releases werden derzeit zuerst unter Windows validiert.

Die neueste Release findest du hier:

https://github.com/zeyzers/nyra/releases

---

## Projektstatus

Nyra ist ein persönliches Open-Source-Browserprojekt. Es ist nutzbar, aber weiterhin experimentell. Updates entstehen in meiner Freizeit.

---

## Warum ich Nyra gebaut habe

Ich habe Nyra gebaut, um zu verstehen, wie Desktop-Browser funktionieren, mit Electron zu experimentieren und einen Browser zu schaffen, der persönlich, einfach und hackbar wirkt.

---

## Screenshots

Dies sind echte Screenshots aus dem aktuellen Windows-Entwicklungsbuild.

### Browser und neuer Tab

Starte mit Lesezeichen, zuletzt besuchten Seiten und wiederherstellbaren Seiten des aktuellen Space.

![Nyra Browser-Shell, Spaces-Sidebar und New-Tab-Seite](./assets/screenshots/nyra-new-tab.png)

### Nyra Spaces

Erstelle getrennte Bereiche für Arbeit, persönliches Browsen, Shopping oder andere Teile deines digitalen Lebens.

![Erstellen eines isolierten Space in Nyra](./assets/screenshots/nyra-spaces.png)

### Lesezeichen

Organisiere, durchsuche, bearbeite und öffne gespeicherte Seiten im integrierten Lesezeichen-Manager.

![Nyra-Lesezeichen-Manager mit Ordnern und gespeicherten Seiten](./assets/screenshots/nyra-bookmarks.png)

### Downloads

Verfolge dauerhafte Downloads, Fortschritt, fehlende Dateien und Dateiaktionen auf einer Seite.

![Nyra-Downloadseite mit abgeschlossenen, fehlenden und fehlgeschlagenen Einträgen](./assets/screenshots/nyra-downloads.png)

### Datenschutz und Sicherheit

Verwalte HTTPS-First-Navigation, lokal verschlüsselte Passwörter, Websitedaten und Berechtigungen pro Space.

![Nyra-Einstellungen für Datenschutz und Sicherheit](./assets/screenshots/nyra-settings-privacy.png)

---

## Funktionen

### Browser-Shell

- Dunkle, flache und moderne Browser-Oberfläche mit Nyra-Akzentfarben.
- Multi-Tab-Browsing mit Schließen, Drag-and-drop-Sortierung, angehefteten Tabs, Duplizieren und Stummschalten.
- Geschlossenen Tab mit `Ctrl+Shift+T` wieder öffnen.
- Sitzungswiederherstellung mit gespeicherten Tab-Metadaten.
- Kompakte/erweiterte Sidebar mit persistenter Einstellung.
- Toolbar mit Zurück, Vor, Reload/Stop, Home, Adressleiste, Lesezeichen, Downloads, Verlauf und Einstellungen.
- Tastaturkürzel für häufige Browser-Aktionen.
- Angedockte DevTools für die aktive Webview.
- Fullscreen-Unterstützung für Seiten wie YouTube.
- Startanimation und native Windows-Icon-Integration.
- Hardwarebeschleunigungs-Einstellung, die nach Neustart greift.

### Spaces

- Getrennte digitale Lebensbereiche mit isolierten Cookies, Logins und Website-Daten.
- Jeder normale Tab gehört zu einem Space mit eigener persistenter Electron-Partition.
- Spaces mit eigenem Namen, Icon und eigener Farbe erstellen.
- Spaces über die Sidebar wechseln und nur die zugehörigen Tabs anzeigen.
- Tabs zwischen Spaces verschieben oder duplizieren.
- Die Sitzungswiederherstellung bewahrt den Space jedes Tabs.
- Passwörter, Berechtigungen und Website-Daten bleiben dem richtigen Space zugeordnet.

### Interne Seiten

Nyra nutzt interne Seiten für Browser-Funktionen:

- `nyra://newtab` - Startseite mit privater Suche und Lesezeichenraster.
- `nyra://blank` - Leere neue Tab-Option.
- `nyra://history` - Lokaler Verlauf mit Suche und Löschen.
- `nyra://bookmarks` - Lesezeichenverwaltung.
- `nyra://downloads` - Downloadverwaltung.
- `nyra://settings` - Einstellungen.
- `nyra://site-data` - Cookies und Local-Storage-Verwaltung.
- `nyra://diagnostics` - Start-, Cache- und Browserdiagnose.
- `nyra://extensions` - Verwaltung entpackter Erweiterungen.

### Suche und Navigation

- Adressleiste unterstützt URLs und Suchanfragen.
- Suchmaschinen: DuckDuckGo, Google und Bing.
- HTTPS-first-Navigation für Domains ohne Protokoll.
- Sichere Behandlung nicht unterstützter eingegebener Schemas.
- Interne Fehlerseite mit Retry-Aktionen.
- PDF-Links werden, wenn möglich, mit Chromium/Electron geöffnet; falls das Laden fehlschlägt, zeigt Nyra PDF-Aktionen wie Retry, PDF herunterladen und extern öffnen.

### Lesezeichen

- Lesezeichen über die Toolbar hinzufügen/entfernen.
- Lesezeichenraster auf der New-Tab-Seite.
- Vollständige Verwaltung unter `nyra://bookmarks`.
- Bearbeiten, löschen, suchen und sortieren.
- Einstufige Lesezeichenordner.
- Drag-and-drop-Sortierung.
- Import/Export von Browser-Lesezeichen-HTML.
- Lesezeichenleiste in der Browser-Shell.

### Downloads

- Persistenter lokaler Downloadverlauf.
- Download-Dropdown in der Toolbar.
- Vollständige Verwaltung unter `nyra://downloads`.
- Suche und Statusfilter.
- Status: downloading, completed, failed, canceled und missing.
- Fortschritt, Dateigröße, Herkunft, lokaler Pfad und Datum.
- Datei öffnen, im Ordner anzeigen, retry, entfernen und Verlauf leeren.
- Live-Kreisindikator um das Download-Icon während aktiver Downloads.
- Abgeschlossene Downloads färben das Icon bis zum Öffnen des Dropdowns.
- Konfigurierbarer Downloadordner und "ask where to save"-Option.

### Passwortmanager

- Lokal verschlüsselte Passwortspeicherung mit Electron `safeStorage`, wenn verfügbar.
- Mehrere Accounts pro Origin.
- Explizite Save/Update-Prompts.
- Zugangsdaten werden nur nach Benutzeraktion ausgefüllt.
- Verwaltung gespeicherter Passwörter in den Einstellungen.
- Reveal, Benutzername kopieren, Passwort kopieren, Login löschen und alle löschen.
- Passwörter werden nicht für private Tabs gespeichert.

### Datenschutz und Sicherheit

- Remote-Seiten laufen in isolierten Webviews.
- Nyra-APIs werden nur vertrauenswürdigen lokalen Seiten bereitgestellt.
- Node.js wird Remote-Seiten nicht offengelegt.
- Web-Popups werden standardmäßig blockiert.
- Nur `mailto:` und `tel:` werden standardmäßig an das Betriebssystem übergeben.
- Website-Berechtigungen werden über Nyra-Prompts verwaltet und pro Domain gespeichert.
- Berechtigungsverwaltung für Kamera, Mikrofon, Geolocation und Benachrichtigungen.
- Site-Data-Manager kann Cookies/Local Storage pro Domain oder vollständig löschen.
- Private Tabs nutzen separate Webview-Partitionen und sind von Session-, Verlauf- und Passwortflüssen ausgeschlossen.

### Updates und Packaging

- Windows-Installer: `NyraSetup.exe`.
- Portable Windows-Build: `Nyra.exe`.
- Distribution über GitHub Releases.
- Paketierte Builds unterstützen Update-Checks über `electron-updater`.
- Release-Metadaten enthalten `latest.yml` und NSIS-Blockmaps.
- Linux-Skripte für `tar.gz`, `AppImage` und `deb` sind vorhanden, aber Windows ist derzeit das primär getestete Release-Ziel.

---

## Erste Schritte

### Voraussetzungen

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)

### Klonen und starten

```bash
git clone https://github.com/zeyzers/nyra.git
cd nyra
npm install
npm start
```

---

## Entwicklungsskripte

```bash
npm start
```

Startet Nyra im Entwicklungsmodus.

```bash
npm run lint
```

Führt Syntaxprüfungen für Main, Preload, Renderer, Helfer und Tests aus.

```bash
npm test
```

Führt die lokale Testsuite aus.

```bash
npm run dist
```

Erstellt Windows-Installer und portable Artefakte.

```bash
npm run dist:linux
```

Erstellt das Linux-`tar.gz`-Paket.

```bash
npm run dist:linux:full
```

Erstellt Linux-`AppImage`-, `deb`- und `tar.gz`-Artefakte.

---

## Release-Workflow

Nyra nutzt GitHub Releases für Distribution und Updater-Metadaten.

Typischer Ablauf:

1. Feature/Fix fertigstellen und committen.
2. Version nur bumpen, wenn wirklich eine Release vorbereitet wird.
3. `npm run lint` ausführen.
4. `npm test` ausführen.
5. `npm run dist` ausführen.
6. Versions-Bump committen.
7. Tag wie `v1.7.0` erstellen.
8. GitHub Release erstellen und hochladen:
   - `NyraSetup.exe`
   - `NyraSetup.exe.blockmap`
   - `latest.yml`
   - optional `Nyra.exe`

Pragmatisches Semantic Versioning:

- Patch: Bugfixes, Polishing und kleine sichere Features.
- Minor: größere sichtbare Feature-Pakete.
- Major: Breaking Changes oder große Architektur-/Datenänderungen.

---

## Storage

Nyra speichert Browserzustand im Electron-`userData`-Verzeichnis.

Hauptdatei:

- `nyra-state.json`

Sie enthält Einstellungen, Session-Tabs, Lesezeichen, Downloads, Berechtigungen, Verlauf, Erweiterungsmetadaten und weiteren lokalen Zustand.

Passwörter werden separat gespeichert:

- `passwords.json`

Passwörter werden mit Electron `safeStorage` verschlüsselt, wenn OS-Verschlüsselung verfügbar ist. Nyra sichert beschädigte State-/Passwortdateien, bevor saubere Defaults neu erstellt werden.

---

## Datenschutzhinweise

Nyra ist local-first:

- Kein Account-System.
- Keine Cloud-Synchronisierung.
- Keine Telemetrie-Implementierung in diesem Repository.
- Kein Passwortserver.
- Kein Remote-Node-Zugriff durch Websites.

Normale Browserdaten können trotzdem lokal existieren, etwa Cookies, Local Storage, Downloadverlauf, gespeicherte Passwörter und Browserverlauf, abhängig von Nutzung und Einstellungen.

---

## Roadmap

Wichtige Bereiche, die noch verbessert werden können:

- Vollständigere Steuerung der Lesezeichenleiste.
- Vollständigere Erweiterungsunterstützung.
- Reader Mode.
- Erweiterte Diagnose im Stil eines Task-Managers/Prozessmonitors.
- Besserer Import/Export vollständiger Nyra-Nutzerdaten.
- Mehr Private-Mode-Polish und Audit-Abdeckung.
- Robustere PDF-Behandlung, falls natives Electron/Chromium-Verhalten unzuverlässig ist.

---

## Mitwirken

Beiträge sind willkommen.

1. Forke das Repository.
2. Erstelle einen Branch.
3. Committe deine Änderungen.
4. Pushe den Branch.
5. Öffne einen Pull Request.

Bitte halte Änderungen fokussiert und mische keine unabhängigen Features in einer PR.

---

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz.

---

## Autor

Mit Neugier entwickelt von [@zeyzers](https://github.com/zeyzers).
