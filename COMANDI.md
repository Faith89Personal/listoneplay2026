# Comandi e operazioni manuali

Cheatsheet per ricordarsi i comandi e le cose da fare a mano sul progetto.

Tutti i comandi vanno lanciati dalla root del repo (`listoneplay2026`).

---

## Refresh dati dal listone GSNT

```bash
npm run refresh-data
```

Cosa fa:
1. Scarica `items.json` (catalogo giochi) da `list.giochisulnostrotavolo.it/be/public/api/items`
2. Scarica `votes.json` (voti utenti GSNT)
3. Legge `public/Mappa-Play-2026.pdf` dal disco e ricostruisce `src/data/editors.json` con il match editore → stand

I tre file finiscono in `src/data/`. Per renderli live in produzione:

```bash
git add src/data/
git commit -m "refresh dati"
git push
```

Vercel rideploya in ~2 min.

> Quando lanciarlo: ogni volta che GSNT aggiorna la loro lista (di solito 1–2 volte a settimana).

---

## Refresh ID BoardGameGeek

```bash
npm run bgg-refresh
```

Cosa fa:
1. Per ogni gioco nel catalogo, cerca il match su BoardGameGeek tramite XML API 2 (richiede `BGG_TOKEN` in `.env.local`)
2. Salva i match in `src/data/bgg.json` (chiave: id item → bggId)
3. Skip dei giochi già mappati e di quelli con alias manuale

Tempo stimato: ~4–5 minuti per 411 giochi.

Per forzare un re-fetch di tutto: `npm run bgg-refresh -- --force`.

Poi commit + push come sopra.

> Quando lanciarlo: dopo `refresh-data` se ci sono titoli nuovi nel catalogo, oppure se hai cambiato il `BGG_TOKEN`.

---

## Pagina link BGG (`/bgg`) e scraping

Pagina nascosta (no login, no indicizzazione, non in navigazione), raggiungibile solo via link diretto:

```
https://listoneplay2026.vercel.app/bgg
```

Mostra **solo i giochi da tavolo** (categoria `GIOCHI DA TAVOLO`, esclusi giochi di ruolo e librogame), divisi per editore. Ogni gioco linka direttamente alla scheda BoardGameGeek se l'ID è noto, altrimenti alla ricerca BGG.

Gli ID vengono da `src/data/bgg.json`. Due modi per popolarlo:

```bash
npm run bgg-refresh -- --force     # via XML API 2 (richiede BGG_TOKEN)
node scripts/bgg-scrape.mjs --force # via scraping HTML della ricerca (usa curl.exe)
```

Lo **scraping** (`bgg-scrape.mjs`) non richiede token: fa il fetch della pagina di ricerca di ogni gioco con `curl.exe` (passa dal proxy aziendale, a differenza di `fetch` Node), legge la tabella `#collectionitems` e sceglie il risultato col **nome esatto** e, tra quelli, l'**anno più recente** (gestisce ristampe/nuove edizioni; evita spin-off tipo "Dice Game"). Se nessun nome combacia esatto, ripiega sull'anno più recente fra tutti i risultati.

Tempo: ~9 minuti per 274 giochi (pausa 0.9s tra le richieste). Output in `src/data/bgg.json` (stesso formato di `bgg-refresh`, quindi `/api/items` lo fa già il merge in `idBgg`).

Per i giochi non trovati o sbagliati: correggi a mano in `src/data/bgg-aliases.json` (vince sull'auto). Poi commit + push di `src/data/bgg.json`.

---

## Sostituire la mappa del Play

1. Scarica il nuovo PDF dal sito ufficiale di Play
2. Sovrascrivi `public/Mappa-Play-2026.pdf`
3. (Opzionale) lancia `npm run refresh-data` per ricalcolare gli stand
4. Commit + push

---

## Sostituire l'icona dell'app

Il file `icon.jpg` è presente in **3 posizioni** che devono restare in sync:
- `public/icon.jpg` — referenziato dal manifest PWA
- `src/app/icon.jpg` — favicon del browser (Next.js auto-inietta)
- `src/app/apple-icon.jpg` — icona "Aggiungi a Home" su iOS

Copia il nuovo file in tutte e tre. Per la notifica push, l'icona piccola in barra di stato è generata da `src/app/api/badge/route.tsx` (3 barre bianche monocromo) — modifica lì se vuoi cambiarla.

---

## Migrazioni DB

```bash
npm run migrate
```

Esegue tutte le `CREATE TABLE IF NOT EXISTS` / `ALTER ... IF NOT EXISTS` definite in `scripts/migrate.mjs`. Sicuro da rilanciare più volte (idempotente).

Va lanciato:
- La prima volta su un DB Neon vuoto
- Dopo aver aggiornato `scripts/migrate.mjs` con nuove tabelle/colonne

Tabelle attuali:
- `users` (email, name)
- `selections` (look/play/buy state per item)
- `reservations` (tavolo prenotato, con share_token, max_seats, shared_with, guests)
- `manual_events` (eventi manuali in calendario, stessi campi sharing)
- `manual_items` (giochi aggiunti dall'utente al listone, id negativo per utente)
- `manual_plays` (giocati fuori listone con voto)
- `plays` (voti su giochi catalogo)
- `rushes` (stand da raggiungere la mattina presto)
- `push_subscriptions` (subscription web push degli utenti)

---

## Alias manuali

Se un editore non viene matchato con uno stand sulla mappa, o se BGG suggerisce il gioco sbagliato, si aggiusta a mano.

### Editori → stand

File: `src/data/editor-aliases.json`

Format:
```json
{
  "Nome Editore Esatto": ["A12", "B13"]
}
```

Sostituisce il match automatico. Niente rebuild di `editors.json` necessario: il merge avviene a runtime in `/api/editors`.

### Giochi → BoardGameGeek ID

File: `src/data/bgg-aliases.json`

Format:
```json
{
  "Nome Gioco Esatto": 167791
}
```

Vince sull'auto-match di `bgg.json`. Per trovare l'ID: apri la pagina BGG del gioco, copia il numero in URL (`boardgamegeek.com/boardgame/167791/...`).

Dopo modifica: commit + push.

---

## Sviluppo locale

```bash
npm run dev
```

Apre Next.js su `http://localhost:3000`. Hot reload attivo.

```bash
npm run build
```

Verifica che la build passi prima di pushare (Vercel rifiuta build rotte).

---

## Env var

File `.env.local` (gitignored, locale):

| Variabile | Cosa serve | Dove usata |
|---|---|---|
| `DATABASE_URL` | Connection string Neon | `npm run migrate`, app a runtime |
| `SESSION_SECRET` | Hex 64 chars per firma cookie | App a runtime |
| `BGG_TOKEN` | Bearer token BGG | Solo `npm run bgg-refresh` |
| `VAPID_PUBLIC_KEY` | Chiave pubblica web push | Lib `web-push` lato server |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Copia della pubblica per il client | `PushManager.subscribe` |
| `VAPID_PRIVATE_KEY` | Chiave privata web push | Firma push lato server |
| `VAPID_SUBJECT` | `mailto:tuamail` per il VAPID | Header VAPID per push services |

### Su Vercel
Settings → Environment Variables, devono essere presenti (sia Production che Preview/Development):
- `DATABASE_URL`
- `SESSION_SECRET`
- `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

`BGG_TOKEN` non serve su Vercel (lo script gira solo in locale).

Dopo aver aggiornato un env var su Vercel: Deployments → ultimo → Redeploy.

### Generare VAPID keys da zero (solo se devi rifarle)
```bash
npx web-push generate-vapid-keys --json
```
Pubblica/privata in output, copiale in `.env.local` E nelle env Vercel. Nota: se cambi le chiavi, tutte le subscription esistenti diventano invalide e gli utenti devono ri-abilitare le notifiche.

---

## Deploy

Push su `main` → Vercel auto-deploy.

```bash
git push
```

Se vuoi vedere lo stato: dashboard Vercel → Deployments.

---

## Checklist "primo setup su un PC nuovo"

1. `git clone https://github.com/Faith89Personal/listoneplay2026.git`
2. `cd listoneplay2026 && npm install`
3. Copia `.env.local.example` in `.env.local` e riempi tutti i valori (DATABASE_URL, SESSION_SECRET, VAPID_*; BGG_TOKEN se serve)
4. `npm run migrate` (idempotente, si può lanciare comunque)
5. (Opzionale) `npm run refresh-data` se vuoi rinfrescare lo snapshot — al primo clone i file ci sono già dal repo
6. (Opzionale) `npm run bgg-refresh` per gli ID BGG
7. `npm run dev` per testare in locale, oppure `git push` per andare in produzione

---

## Domande frequenti

**Q: Ho aggiornato editor-aliases.json o bgg-aliases.json ma sul telefono vedo ancora il vecchio.**
Vercel cacha la route `/api/editors` e `/api/items` per ~10 min. O aspetti, o forzi un redeploy.

**Q: Login fallisce con "DB non raggiungibile".**
Manca `DATABASE_URL` su Vercel oppure il redeploy non è ancora stato fatto dopo averla aggiunta.

**Q: Login fallisce con "SESSION_SECRET mancante su Vercel".**
Stessa cosa per `SESSION_SECRET`.

**Q: Le push notifications non arrivano.**
Verifica:
1. Le 4 var `VAPID_*` sono settate su Vercel
2. Redeploy fatto dopo averle messe
3. Il browser/PWA ha chiesto permesso e l'utente ha cliccato "Attiva notifiche" nel banner ambra
4. Su iOS le push richiedono la PWA installata sulla home (Safari → Condividi → Aggiungi a Home)

**Q: Sulla notifica vedo un quadrato bianco invece dell'icona.**
È il comportamento di Android per il "badge" piccolo in barra di stato (lo forza a monocromo). Il file `src/app/api/badge/route.tsx` genera un PNG trasparente con 3 barre bianche, che dovrebbe apparire correttamente. Se vedi ancora un quadrato, prova a disinstallare e reinstallare la PWA per forzare il refresh del service worker.

**Q: Ho rotto qualcosa, come faccio rollback?**
Dashboard Vercel → Deployments → trovi un deploy precedente verde → menu `⋯` → "Promote to Production".

---

## Architettura veloce (per orientarsi)

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind 4
- **DB**: Neon Postgres (serverless)
- **Auth**: trust-the-email + JWT in cookie HttpOnly, durata 90gg, gestito da `src/lib/session.ts`
- **PWA**: manifest in `src/app/manifest.ts`, service worker in `public/sw.js`, install hint in `src/components/InstallHint.tsx`
- **Push notifications**: `web-push` lato server (`src/lib/push.ts`), subscription gestite in `src/app/api/push/`, UI in `src/components/NotificationsHint.tsx`
- **Dati upstream**: snapshot in `src/data/` (items.json, votes.json, editors.json, bgg.json, alias)
- **API routes**: tutte in `src/app/api/`, usano runtime nodejs (eccetto `/api/badge` che è edge per ImageResponse)
