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

## Sostituire la mappa del Play

1. Scarica il nuovo PDF dal sito ufficiale di Play
2. Sovrascrivi `public/Mappa-Play-2026.pdf`
3. (Opzionale) lancia `npm run refresh-data` per ricalcolare gli stand
4. Commit + push

---

## Migrazioni DB

```bash
npm run migrate
```

Esegue tutte le `CREATE TABLE IF NOT EXISTS` / `ALTER ... IF NOT EXISTS` definite in `scripts/migrate.mjs`. Sicuro da rilanciare più volte (idempotente).

Va lanciato:
- La prima volta su un DB Neon vuoto
- Dopo aver aggiornato `scripts/migrate.mjs` con nuove tabelle/colonne

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

Su Vercel devono essere settate (Settings → Environment Variables):
- `DATABASE_URL`
- `SESSION_SECRET`

`BGG_TOKEN` non serve su Vercel (lo script gira solo locale).

Dopo aver aggiornato un env var su Vercel: Deployments → ultimo → Redeploy.

---

## Deploy

Push su `main` → Vercel auto-deploy.

```bash
git push
```

Se vuoi vedere lo stato: dashboard Vercel → Deployments.

---

## Checklist "primo setup su un PC nuovo"

1. Clona il repo
2. `npm install`
3. Copia `.env.local.example` in `.env.local` e riempi i valori
4. `npm run migrate` (se è un DB nuovo)
5. `npm run refresh-data` (popola JSON snapshot)
6. (Opzionale) `npm run bgg-refresh` per gli ID BGG
7. `npm run dev` per testare in locale, oppure `git push` per andare in produzione

---

## Domande frequenti

**Q: Ho aggiornato editor-aliases.json ma sul telefono vedo ancora il vecchio.**
Vercel cacha le route statiche per 10 min. O aspetti, o forzi un redeploy.

**Q: Login fallisce con "DB non raggiungibile".**
Manca `DATABASE_URL` su Vercel oppure il redeploy non è ancora stato fatto dopo averla aggiunta.

**Q: Login fallisce con "SESSION_SECRET mancante su Vercel".**
Stessa cosa per `SESSION_SECRET`.

**Q: Ho rotto qualcosa, come faccio rollback?**
Dashboard Vercel → Deployments → trovi un deploy precedente verde → menu `⋯` → "Promote to Production".
