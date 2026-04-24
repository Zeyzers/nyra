# Nyra

> - This project is also available in **[English](../README.md)**.
> - Dieses Projekt ist auch in **[Deutsch](./README.de.md)** verfügbar.
> - このプロジェクトは、**[日本語](./README.jp.md)** にもあります。

Nyra è un browser web minimale e personale costruito con Electron.
Veloce, senza distrazioni, orientato alla privacy — e completamente tuo.

![GitHub repo size](https://img.shields.io/github/repo-size/zeyzers/nyra?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/zeyzers/nyra?style=flat-square)
![GitHub license](https://img.shields.io/github/license/zeyzers/nyra?style=flat-square)

---

## ✨ Funzionalità

- **Interfaccia pulita e minimale**: Concentrati su ciò che conta.
- **Tema scuro pronto all'uso**: Perfetto per la navigazione notturna.
- **Basato su Electron**: Alimentato da HTML, CSS e JavaScript.
- **Navigazione da tastiera**: (In programma) Naviga facilmente senza mouse.
- **Controlli di navigazione**: Pulsanti avanti/indietro come ogni browser moderno.
- **Schede multiple**: Apri e gestisci più schede senza problemi.
- **Barra degli indirizzi dinamica**: Si aggiorna in tempo reale con l'URL corrente.
- **Titolo finestra dinamico**: Mostra il titolo della pagina nella finestra dell'app.
- **Nuova scheda intelligente**: Homepage personalizzata con ricerca integrata.
- **Struttura modulare**: Estendibile e personalizzabile con facilità.
- **Toggle DevTools**: Premi F12 o Ctrl+Shift+I per ispezionare la webview attiva.
- **Impostazioni persistenti**: Nyra salva le impostazioni in un piccolo file JSON di stato.
- **Ripristino sessione**: Può ripristinare le schede precedenti all'avvio.
- **Pagina impostazioni interna**: Visita `nyra://settings` per modificare il comportamento di navigazione principale.
- **Default orientati alla privacy**: Navigazione HTTPS-first, popup bloccati e permessi dei siti negati per impostazione predefinita.

---

## 🚀 Per iniziare

### Prerequisiti

Assicurati di avere installato:

- [Node.js](https://nodejs.org/) (v14 o superiore)
- [Git](https://git-scm.com/)

### Clona e Avvia

Segui questi passaggi per iniziare:

```bash
# Clona la repository
git clone https://github.com/zeyzers/nyra.git

# Vai nella cartella del progetto
cd nyra

# Installa le dipendenze
npm install

# Avvia l'applicazione
npm start
```

---

## 🛠️ Roadmap

- [x] Caricamento URL da input
- [x] Pulsanti avanti/indietro
- [x] Titolo finestra dinamico
- [x] Risolto problema doppia scrollbar
- [x] Nuova scheda con barra di ricerca intelligente
- [x] Toggle DevTools per la webview attiva
- [x] Impostazioni persistenti salvate in Electron userData
- [x] Ripristino sessione
- [x] Pagina impostazioni (`nyra://settings`)
- [ ] DevTools ancorati nella stessa pagina
- [ ] Sistema di preferiti dinamico
- [ ] Aggiunta sfondo personalizzato nella nuova scheda
- [ ] Toggle privacy (JS / cookie)
- [x] Supporto per schede multiple
- [x] Pulsante per chiudere scheda
- [ ] Pagina about (`nyra://about`)

---

## 🔒 Privacy e Sicurezza

Nyra mantiene intenzionalmente il proprio modello di privacy piccolo ed esplicito:

- I domini senza protocollo si aprono con `https://` per impostazione predefinita.
- `nyra://settings` può disattivare il comportamento HTTPS-first per workflow locali o di test.
- I popup web vengono bloccati invece di essere aperti automaticamente.
- Le richieste di permesso dei siti vengono negate per impostazione predefinita finché Nyra non avrà controlli visibili per l'utente.
- Solo `mailto:` e `tel:` vengono aperti tramite il sistema operativo come protocolli esterni.
- Schemi digitati non sicuri come `javascript:alert(1)` vengono trattati come testo di ricerca, non come navigazione.

Lo stato persistente viene salvato come `nyra-state.json` nella directory `userData` di Electron. Al momento contiene impostazioni, schede di sessione salvate e segnaposto per futuri preferiti e cronologia.

Hai idee? Sentiti libero di suggerire funzionalità o miglioramenti!

---

## 🤝 Contribuire

Ogni contributo è benvenuto! Ecco come puoi aiutare:

1. Fai un fork del repository.
2. Crea un nuovo branch (`git checkout -b nome-feature`).
3. Fai il commit delle modifiche (`git commit -m 'Aggiunta nuova funzionalità'`).
4. Fai il push del branch (`git push origin nome-feature`).
5. Apri una pull request.

---

## 📜 Licenza

Questo progetto è distribuito sotto licenza MIT.
Puoi usarlo, modificarlo e condividerlo liberamente — basta attribuire il merito all'[autore](https://github.com/zeyzers).

---

## 👤 Autore

Creato con curiosità da [@zeyzers](https://github.com/zeyzers).
Sentiti libero di contattarmi o esplorare gli altri miei progetti!
