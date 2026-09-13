# Meditazione Timer A.C.D.

App web (HTML/CSS/JS puro, nessuna dipendenza da installare) per la
meditazione guidata a fasi multiple, con suoni rilassanti sintetizzati e
pagine completamente personalizzabili. Funziona sia da computer che da
cellulare (design responsive) e può essere installata come app (PWA).

## Come usarla

**Online (consigliato):** una volta che GitHub Pages è attivo per questo
repo (Settings → Pages → Deploy from a branch → branch `main`, cartella
`/ (root)`), l'app sarà disponibile su:

```
https://thatgrlshop.github.io/meditazione-timer-acd/
```

**Da cellulare:** apri il link nel browser (Safari su iPhone, Chrome su
Android) e scegli "Aggiungi a Home" / "Installa app" per averla come
un'icona a schermo intero, senza barra del browser.

**Da computer:** apri il link in Chrome/Edge e clicca l'icona di
installazione nella barra degli indirizzi, oppure tienila semplicemente
come una scheda del browser.

**Offline / in locale:** basta aprire `index.html` direttamente nel
browser — non serve un server né una connessione internet, tutti i suoni
sono generati al volo (Web Audio API) e i dati sono salvati sul
dispositivo (localStorage).

## Cosa contiene

- `index.html` — struttura della pagina
- `style.css` — tutto lo stile (sfondo animato, glass card, colori)
- `app.js` — logica dell'app (timer, pagine, suoni, editor)
- `manifest.webmanifest` + `sw.js` — permettono l'installazione come app e
  l'uso offline
- `icon.svg` — icona dell'app

## Funzionalità

- **Pagina principale** con la sequenza predefinita: Rilassamento (5
  min), Chi (7), Plesso (4), Cuore (7), Mente (7), Corona (3), Finale (2).
- **Pagine aggiuntive predefinite**: "Taglio + Protezione" e "Protezione
  Personale + Casa", con i valori indicati, tutti modificabili.
- **Crea nuove pagine** a piacere, con un numero qualsiasi di fasi.
- Ogni fase è completamente modificabile: nome, minuti e secondi, e può
  avere un **suono personalizzato** oppure usare quello generale
  impostato nelle Impostazioni.
- 4 suoni distinti generati via Web Audio API (nessun file da scaricare):
  Gong, Campanella, Cinguettio di uccellini, Ciotola tibetana.
- Anello di progresso animato, colori ispirati ai chakra per ogni fase,
  sfondo "nebulosa" blu/viola/indaco/rosa in movimento lento.
- Salvataggio automatico sul dispositivo: le tue modifiche restano anche
  chiudendo il browser.

## Prossimi miglioramenti possibili

Idee già in mente per iterazioni future: riordino delle pagine, esportare
e condividere pagine personalizzate, temi di colore alternativi, suoni
aggiuntivi, statistiche delle sessioni completate.
