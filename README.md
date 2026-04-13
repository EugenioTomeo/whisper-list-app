# Whisper List App

App locale senza Lovable per:
- aprire `https://booking.whisper-system.net/`
- far eseguire all'utente il login manuale
- cliccare i pulsanti `D.DELIVERY`, `D.REENTRY`, `T.DELIVERY`, `T.REENTRY`
- acquisire i dati visibili sotto:
  - `ID Status`
  - `Company`
  - `Tour Leader`
  - `Delivery Place`
  - `Bag Model`
  - `Bag Status`
  - `Operation Notes`
  - `Staff M.Delivery`
- ripetere lo stesso flusso su `https://booking.whisper-system.net/service.php`
- generare una lista finale con prefisso sorgente:
  - `DDV`
  - `DRT`
  - `TDV`
  - `TRT`
- cancellazione singola righe
- riordino drag and drop
- checkbox con linea orizzontale sui dati
- UI pulita e mobile-friendly

## Perché non è stata fatta come iframe

Una soluzione con `iframe` che poi legga e clicchi il DOM di un altro dominio non è robusta:
- il browser limita l'accesso DOM cross-origin con la same-origin policy
- il sito remoto può anche vietare proprio l'embedding tramite `X-Frame-Options` o `CSP frame-ancestors`

Per questo qui c'è una soluzione funzionante: **web app locale + Playwright**.
L'utente fa login manualmente nel browser controllato dall'app, poi l'app acquisisce i dati.

## Avvio

```bash
npm install
npm start
```

Apri poi:

```bash
http://localhost:3000
```

## Struttura

- `server.js` → API Express e persistenza JSON
- `scraper.js` → automazione browser con Playwright
- `public/` → interfaccia web
- `data/db.json` → memoria locale dei record e lista

## Flusso operativo

1. Clic su **Apri BOOKING**
2. Login manuale nel browser Chromium aperto dall'app
3. Clic su **Acquisisci dati**
4. Clic su **Apri SERVICE**
5. Secondo login
6. Clic su **Acquisisci dati**
7. Clic su **Genera lista**
8. Riordino, spunta, cancellazione

## Nota importante sui selettori

Non ho visibilità del DOM interno dopo login. Lo scraper usa una strategia robusta ma generica:
- cerca i pulsanti per testo esatto
- dopo il click analizza blocchi di pagina che contengono almeno 4 delle etichette target
- estrae i valori in base ai label

Se Whisper usa una struttura HTML molto particolare, potrebbe servire un piccolo adattamento in `scraper.js`, soprattutto dentro:
- `clickButtonByText(...)`
- `scrapeFromButton(...)`

## Formato lista finale

Ogni riga mostra:
- prefisso origine (`DDV`, `DRT`, `TDV`, `TRT`)
- `ID Status`
- `Company`
- `Delivery Place`
- `Tour Leader`
- `Bag Model`
- `Bag Status`
- `Operation Notes`
- `Staff M.Delivery`
- sorgente sessione (`BOOKING` / `SERVICE`)

## GitHub

Puoi incollare tutto il contenuto di questa cartella in un repository GitHub così com'è.
