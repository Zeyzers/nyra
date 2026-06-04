# Nyra

> - This project is also available in **[English](../README.md)**.
> - Dieses Projekt ist auch in **[Deutsch](./README.de.md)** verfügbar.
> - このプロジェクトは、**[日本語](./README.jp.md)** にもあります。

Nyra è un browser desktop minimale e personale costruito con Electron.

È pensato per essere silenzioso, veloce e privato di default, mantenendo comunque gli strumenti quotidiani che ti aspetti da un browser: schede, preferiti, cronologia, download, impostazioni, permessi, password salvate e aggiornamenti automatici.

![GitHub repo size](https://img.shields.io/github/repo-size/zeyzers/nyra?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/zeyzers/nyra?style=flat-square)
![GitHub license](https://img.shields.io/github/license/zeyzers/nyra?style=flat-square)

---

## Stato

Versione attuale: **1.6.2**

Nyra è in sviluppo attivo. Windows è il target principale al momento. Esistono script di packaging per Linux, ma Windows è la piattaforma su cui feature e release vengono validate per prima.

Scarica l'ultima release da:

https://github.com/zeyzers/nyra/releases

---

## Stato del progetto

Nyra è un progetto browser personale e open-source. È utilizzabile, ma ancora sperimentale. Gli aggiornamenti vengono fatti nel mio tempo libero.

---

## Perché ho creato Nyra

Ho creato Nyra per capire come funzionano i browser desktop, sperimentare con Electron e costruire un browser che sembri personale, semplice e modificabile.

---

## Funzionalità

### Shell del browser

- Interfaccia browser scura, flat e moderna con sistema di colori accent Nyra.
- Navigazione multi-tab con chiusura, drag and drop, tab fissate, duplicazione e mute/unmute.
- Riapertura dell'ultima tab chiusa con `Ctrl+Shift+T`.
- Ripristino sessione con metadati delle tab salvati.
- Sidebar compatta/estesa con impostazione persistente.
- Toolbar con indietro, avanti, reload/stop, home, barra indirizzi, preferiti, download, cronologia e impostazioni.
- Scorciatoie da tastiera per le azioni comuni.
- DevTools ancorati per la webview attiva.
- Supporto fullscreen per siti come YouTube.
- Animazione di avvio e icona nativa Windows.
- Impostazione hardware acceleration applicata al riavvio.

### Pagine interne

Nyra usa pagine interne per le funzioni del browser:

- `nyra://newtab` - Pagina iniziale con ricerca privata e griglia preferiti.
- `nyra://blank` - Opzione nuova scheda vuota.
- `nyra://history` - Cronologia locale con ricerca e controlli di eliminazione.
- `nyra://bookmarks` - Manager dei preferiti.
- `nyra://downloads` - Manager dei download.
- `nyra://settings` - Impostazioni.
- `nyra://site-data` - Manager cookie e local storage.
- `nyra://diagnostics` - Diagnostica di avvio, cache e browser.
- `nyra://extensions` - Gestione estensioni unpacked.

### Ricerca e navigazione

- Barra indirizzi per URL e ricerche.
- Motori di ricerca: DuckDuckGo, Google e Bing.
- Navigazione HTTPS-first per domini senza protocollo.
- Gestione sicura degli schemi non supportati digitati dall'utente.
- Pagina interna di errore con controlli di retry.
- I PDF vengono aperti con Chromium/Electron quando possibile; se il caricamento fallisce, Nyra mostra azioni specifiche: retry, download PDF e apertura esterna.

### Preferiti

- Aggiunta/rimozione preferiti dalla toolbar.
- Griglia preferiti nella New Tab.
- Manager completo in `nyra://bookmarks`.
- Modifica, eliminazione, ricerca e ordinamento.
- Cartelle a un livello.
- Ordinamento drag and drop.
- Import/export HTML in formato browser.
- Barra preferiti nella shell.

### Download

- Cronologia download persistente locale.
- Dropdown download nella toolbar.
- Manager completo in `nyra://downloads`.
- Ricerca e filtri per stato.
- Stati: downloading, completed, failed, canceled e missing.
- Progress, dimensione, origin, path locale e data.
- Open file, show in folder, retry, remove e clear history.
- Indicatore circolare live intorno all'icona download durante i download attivi.
- L'icona download resta evidenziata dopo un completamento finché il dropdown non viene aperto.
- Cartella download configurabile e opzione "ask where to save".

### Password manager

- Salvataggio password locale cifrato con Electron `safeStorage` quando disponibile.
- Account multipli per origin.
- Prompt espliciti per save/update.
- Compilazione credenziali solo dopo azione dell'utente.
- Gestione password salvate nelle impostazioni.
- Reveal, copy username, copy password, delete login e clear all.
- Le password non vengono salvate per tab private.

### Privacy e sicurezza

- Le pagine remote girano in webview isolate.
- Le API Nyra sono esposte solo alle pagine locali trusted.
- Node.js non è esposto alle pagine remote.
- I popup web sono bloccati di default.
- Solo `mailto:` e `tel:` vengono passati al sistema operativo di default.
- I permessi sito vengono gestiti con prompt Nyra e salvati per dominio.
- Il manager permessi supporta camera, microfono, geolocalizzazione e notifiche.
- Il manager site data può cancellare cookie/local storage per dominio o tutto insieme.
- Le tab private usano partizioni webview separate e sono escluse da sessione, cronologia e password.

### Aggiornamenti e packaging

- Installer Windows: `NyraSetup.exe`.
- Build portable Windows: `Nyra.exe`.
- Distribuzione tramite GitHub Releases.
- Le build pacchettizzate supportano update check con `electron-updater`.
- Le release includono `latest.yml` e NSIS blockmap per l'updater.
- Esistono script Linux per `tar.gz`, `AppImage` e `deb`, ma Windows è il target principale testato.

---

## Per iniziare

### Prerequisiti

- [Node.js](https://nodejs.org/)
- [Git](https://git-scm.com/)

### Clona e avvia

```bash
git clone https://github.com/zeyzers/nyra.git
cd nyra
npm install
npm start
```

---

## Script di sviluppo

```bash
npm start
```

Avvia Nyra in modalità sviluppo.

```bash
npm run lint
```

Esegue controlli di sintassi su main, preload, renderer, helper e test.

```bash
npm test
```

Esegue la suite di test locale.

```bash
npm run dist
```

Genera installer Windows e build portable.

```bash
npm run dist:linux
```

Genera il pacchetto Linux `tar.gz`.

```bash
npm run dist:linux:full
```

Genera artefatti Linux `AppImage`, `deb` e `tar.gz`.

---

## Workflow release

Nyra usa GitHub Releases per distribuzione e metadata dell'updater.

Flusso tipico:

1. Completa e committa feature/fix.
2. Bumpa la versione solo quando stai preparando davvero una release.
3. Esegui `npm run lint`.
4. Esegui `npm test`.
5. Esegui `npm run dist`.
6. Committa il bump versione.
7. Crea un tag come `v1.6.2`.
8. Crea una GitHub Release e carica:
   - `NyraSetup.exe`
   - `NyraSetup.exe.blockmap`
   - `latest.yml`
   - opzionalmente `Nyra.exe`

Versioning pragmatico basato su semantic versioning:

- Patch: bugfix, polish e piccole feature sicure.
- Minor: feature pack più grandi e visibili.
- Major: breaking change o modifiche importanti ad architettura/dati.

---

## Storage

Nyra salva lo stato nella directory Electron `userData`.

File principale:

- `nyra-state.json`

Contiene impostazioni, tab di sessione, preferiti, download, permessi, cronologia, metadata estensioni e altro stato locale.

Le password sono salvate separatamente:

- `passwords.json`

Le password vengono cifrate con Electron `safeStorage` quando la cifratura del sistema operativo è disponibile. Nyra crea backup dei file corrotti prima di ricreare default puliti.

---

## Note privacy

Nyra è local-first:

- Nessun sistema account.
- Nessun cloud sync.
- Nessuna telemetria implementata in questa repository.
- Nessun server password.
- Nessun accesso Node remoto dai siti web.

Alcuni dati normali da browser restano comunque locali, come cookie, local storage, cronologia download, password salvate e cronologia di navigazione, in base all'uso e alle impostazioni.

---

## Roadmap

Aree ancora importanti da migliorare:

- Controlli più completi per la barra preferiti.
- Supporto estensioni più completo.
- Reader mode.
- Diagnostica più avanzata stile task manager/processi.
- Import/export più completo dei dati Nyra.
- Ulteriore polish e audit della modalità privata.
- PDF handling più robusto se il comportamento nativo Electron/Chromium si dimostra instabile.

---

## Contribuire

I contributi sono benvenuti.

1. Fai un fork della repository.
2. Crea un branch.
3. Committa le modifiche.
4. Pusha il branch.
5. Apri una pull request.

Mantieni le modifiche focalizzate ed evita di mischiare feature non correlate nella stessa PR.

---

## Licenza

Questo progetto è distribuito sotto licenza MIT.

---

## Autore

Creato con curiosità da [@zeyzers](https://github.com/zeyzers).
