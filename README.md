# Quercus · Diario di Trasformazione

App React + Vite con 9 sezioni (Peso, Diario, Pasti, Digiuno, Corpo, Rituale, Respiro, Sonno, Sera) e integrazione opzionale con Claude AI tramite Netlify Functions.

---

## ⚠️ LEGGI QUESTO PRIMA DI DEPLOYARE

**NON usare il drag-and-drop sullo "Sites" di Netlify** (quel rettangolo grande dove trascini cartelle). Il drag-and-drop carica solo file statici e **NON esegue le Netlify Functions** — quindi la funzione AI non risponderebbe mai e l'app sembrerebbe rotta.

Devi usare uno di questi **due metodi**:

### Metodo A — Deploy da Git (consigliato, semplice)

1. Crea un repository nuovo su GitHub
2. Carica questa cartella nel repo:
   ```bash
   cd quercus-app
   git init
   git add .
   git commit -m "init quercus"
   git branch -M main
   git remote add origin https://github.com/TUO_USER/TUO_REPO.git
   git push -u origin main
   ```
3. Vai su https://app.netlify.com → **Add new site** → **Import an existing project** → scegli GitHub e seleziona il repo
4. Netlify legge `netlify.toml` automaticamente: build command `npm run build`, publish dir `dist`, functions dir `netlify/functions`. Conferma e fai partire il deploy.
5. Quando il deploy è completato, vai in **Site settings** → **Environment variables** → **Add a variable**:
   - Key: `ANTHROPIC_API_KEY`
   - Value: la tua API key Anthropic (la trovi su https://console.anthropic.com/settings/keys, inizia con `sk-ant-`)
6. Vai in **Deploys** → **Trigger deploy** → **Deploy site** per applicare la variabile

### Metodo B — Deploy da CLI Netlify

```bash
cd quercus-app
npm install
npx netlify login            # login con il browser
npx netlify init             # crea il sito (scegli "Create & configure a new site")
npx netlify env:set ANTHROPIC_API_KEY sk-ant-XXXX
npx netlify deploy --build --prod
```

---

## Verifica che funzioni

Dopo il deploy, prova questi check:

1. **Apri il sito** (URL `https://NOME-SITO.netlify.app`) — deve caricarsi e mostrare la pagina Peso
2. **Vai in Functions** sulla dashboard Netlify — devi vedere `anthropic` nella lista
3. **Test rapido AI**: vai nel **Diario**, scrivi qualcosa tipo *"ho bevuto 2 bicchieri d'acqua e mangiato pasta al pomodoro"*, premi **✦ Registra con l'IA**. Se vedi il modal coi pasti trovati, tutto funziona. Se vedi *"IA non disponibile in questo contesto"* allora hai un problema con l'API key.

---

## Troubleshooting

### "IA non disponibile in questo contesto"

→ La variabile `ANTHROPIC_API_KEY` non è stata letta. Verifica:
- È stata aggiunta nelle Site settings → Environment variables (NON nel netlify.toml)
- Dopo averla aggiunta hai rilanciato un deploy (le env var richiedono un nuovo build per essere lette)
- La key è valida — testala con `curl` ad Anthropic per verificare

### Build fallisce su Netlify

→ Apri il log del deploy. Se vedi errori su `npm install`, verifica che il Node version sia 20 (configurato in netlify.toml). Se altri errori, copiameli.

### "Page not found" cliccando su qualcosa

→ Il file `public/_redirects` dovrebbe gestire questo. Verifica che ci sia.

### Function non risponde, 404 su /api/anthropic

→ Vai su **Functions** nella dashboard Netlify — vedi `anthropic`? Se no, il bundling è fallito. Apri il log e cerca errori.

### Sto vedendo "tutto rotto" sul sito

→ Probabilmente hai fatto drag-and-drop invece di Git deploy. Drag-and-drop non esegue functions. Vedi la sezione "LEGGI QUESTO PRIMA" sopra.

---

## Sviluppo locale

```bash
npm install
npm run dev              # dev server Vite su :5173 (IA non funziona)
```

Per testare anche le functions in locale:
```bash
npm install -g netlify-cli
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
netlify dev              # dev server completo su :8888
```

---

## Architettura

```
quercus-app/
├── index.html
├── netlify.toml                  ← build config
├── package.json
├── vite.config.js
├── public/
│   └── _redirects                ← fallback redirect (oltre a netlify.toml)
├── netlify/functions/
│   └── anthropic.js              ← proxy server-side con API key
└── src/
    ├── main.jsx
    ├── storage-polyfill.js       ← window.storage → localStorage
    └── App.jsx
```

### Persistenza

Tutto in `localStorage` del browser (chiavi: `weights`, `goal`, `foodnotes`, `water`, `watergoal`, `meals`, `workouts`, `workouttypes`, `supps`, `supptaken`, `sleeps`, `mindful`, `fasts`). Nessun database remoto: i dati restano sul dispositivo dell'utente.

### Sicurezza API key

L'API key di Anthropic vive solo come **environment variable** lato Netlify. Il browser non la vede mai. Il frontend chiama `/api/anthropic` (che Netlify routerà automaticamente alla function grazie a `config.path` nella function v2). La function aggiunge l'header `x-api-key` e inoltra a `api.anthropic.com`.

### Costi

Le chiamate AI hanno un costo (Anthropic API a consumo). L'app le invoca solo su azione esplicita dell'utente. Modello: `claude-sonnet-4-20250514`.
