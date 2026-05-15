# Listone Play 2026 — Contesto progetto

Note per Claude se la sessione riparte da zero. L'utente vuole che leggi questo
prima di mettere mano al codice, così non rifai domande già risolte.

---

## Cos'è

App personale, riservata a un piccolo gruppo di amici, per il festival
**Play 2026** (22-24 maggio 2026, Bologna). Replica/estende il "Listone GSNT"
ufficiale (https://list.giochisulnostrotavolo.it) con feature aggiuntive
pensate per l'uso in fiera dal telefono.

- Repo: https://github.com/Faith89Personal/listoneplay2026
- Owner GitHub: `Faith89Personal` (anche se le credenziali Windows cached
  potrebbero avere `iFaith89`, da usare con PAT)
- Deploy: https://listoneplay2026.vercel.app (auto-deploy on push main)
- Stack: **Next.js 15.5 App Router + TypeScript + Tailwind 4 + Neon Postgres**

L'utente è italiano, scrivi sempre in italiano. UI testi tutti in italiano,
codice e identificatori in inglese.

---

## Ambiente di sviluppo (importante!)

- **Working dir**: variabile per PC (l'utente lavora da più macchine). NON
  assumere un percorso assoluto: usa sempre percorsi relativi alla root del
  repo. Esempi noti: OneDrive Nexi aziendale, oppure `C:\xampp\htdocs`.
- **OS**: Windows 11, shell PowerShell (NON bash). Usa sintassi PowerShell per
  comandi shell. `Get-ChildItem`, `Remove-Item`, ecc.
- **OneDrive aziendale Nexi** (solo su alcuni PC): se la cartella sincronizza
  su OneDrive aziendale, l'utente lo sa e ha accettato che `.env.local` (con
  secrets) ci stia dentro. Non insistere sulla sicurezza — già discusso.
- **Proxy aziendale**: la rete Nexi blocca o complica `fetch` Node verso:
  - `list.giochisulnostrotavolo.it` (API upstream listone)
  - `boardgamegeek.com` (XML API)
  - Per questo motivo `npm run refresh-data` può fallire QUI ma funziona sulla
    macchina personale dell'utente. Vercel non ha il problema.
  - `curl.exe` invece funziona (passa dal proxy Windows). Lo uso per gli
    snapshot iniziali.
- **Node fetch + .next on OneDrive**: ogni tanto `npm run build` fallisce con
  `EINVAL readlink` su file `.next`. Rimedio: `Remove-Item -Recurse -Force .next`
  e ribuilda.

---

## Bug ricorrenti del mio tooling

- Heredoc multilinea in PowerShell (`git commit -m @'...'@`) ROMPE su caratteri
  speciali tipo em-dash `—`, middle-dot `·`, virgolette tipografiche, alcuni
  emoji. PowerShell li tratta come separatori. **Usa solo ASCII** nei commit
  message. Niente apostrofi anche.
- `git push` mostra `RemoteException` ma di solito ha funzionato — guarda la
  riga "X..Y main -> main" per conferma.
- `.git/config` ha il PAT in chiaro (l'utente ha accettato).

---

## Architettura (alto livello)

### Frontend
- Next.js 15 App Router. Tutte le pagine sono in `src/app/`.
- Tailwind 4 con `@theme` directive in `src/app/globals.css`. Theme switching
  via `data-theme` attribute su `<html>` e CSS variables (`--brand`,
  `--brand-dark`); 10 temi predefiniti in `src/lib/themes.ts`.
- Mobile-first (max-w-2xl o max-w-3xl). L'utente usa la app solo dal telefono
  Android (Chrome).
- PWA installabile: manifest in `src/app/manifest.ts`, icone JPG in
  `public/icon.jpg`, `src/app/icon.jpg`, `src/app/apple-icon.jpg` (icona =
  goblin rosso fornita dall'utente).
- Componente `LoginGate` blocca ogni route protetta finché non logghi.

### Backend
- API routes server-side in `src/app/api/`, runtime `nodejs` quasi ovunque.
- DB: **Neon Postgres** via `@neondatabase/serverless`. Connection string in
  `DATABASE_URL`. Tutto in `src/lib/db.ts`.
- Auth: trust-the-email (nessuna password, nessuna verifica). JWT firmato
  HS256 in cookie HttpOnly `lp_session`, max-age 90 giorni. Niente magic link
  — l'utente vuole semplicità per gli amici. Helper in `src/lib/session.ts`.
- Push notifications: `web-push` lato server. VAPID keys in env. Service
  worker in `public/sw.js`. Subscriptions in tabella `push_subscriptions`.
  Helper `src/lib/push.ts` con `sendPushToUser(email, payload)`.

### Sorgenti dati
- Catalogo giochi: snapshot statico in `src/data/items.json` (~411 giochi).
  Aggiornato manualmente con `npm run refresh-data` dall'utente.
- Voti aggregati GSNT: `src/data/votes.json`.
- Mappa editore → stand: `src/data/editors.json` (auto) + 
  `src/data/editor-aliases.json` (manuale, vince sull'auto).
- BGG IDs: `src/data/bgg.json` (auto via XML API) + `src/data/bgg-aliases.json`.
- PDF mappa: `public/Mappa-Play-2026.pdf` (l'utente lo sostituisce a mano se
  serve, niente fetch a runtime).
- `/api/items` merge items.json + bgg snapshot + bgg aliases prima di
  rispondere al client.
- `/api/editors` merge editors.json + editor aliases.

### Schema DB (vedi `scripts/migrate.mjs`)
- `users(email PK, name)` — email-only, name nullable ma ora richiesto al login
- `selections(email, item_id, flag, state)` — stato delle 3 caselle per gioco
  (look/play/buy × checked/forbidden). Item_id può essere negativo (manual).
- `reservations(email, item_id, reserved_at, duration_minutes, note,
  share_token, max_seats, shared_with[], guests[])` — PK (email, item_id).
  share_token UNIQUE per link join.
- `manual_events` — eventi calendario non legati a item catalogo. SERIAL id,
  stesso pattern sharing (share_token, max_seats, shared_with, guests).
- `manual_items` — giochi aggiunti dall'utente al listone. PK (email, id) con
  CHECK id < 0 per non collidere con catalogo (positivi). Negativi assegnati
  con `COALESCE(MIN(id), 0) - 1` scoped al singolo utente.
- `plays(email, item_id, rating, note)` — voti su giochi catalogo
- `manual_plays(id, email, name, editor, rating, played_on, note)` — giochi
  giocati FUORI dal catalogo
- `rushes(email, item_id, rush_day DATE)` — flag "vai allo stand presto"
  per ciascun giorno fiera
- `push_subscriptions(id, email, endpoint UNIQUE, p256dh, auth, user_agent)`

### Sharing flow (importante)
- `share_token` (12 hex chars) generato lato server al primo INSERT
- URL pubblico: `/r/[token]` (gestito da `JoinReservationView`)
- La pagina prova prima `/api/reservations/r/[token]`, poi
  `/api/manual-events/r/[token]` (token uniche cross-table)
- Owner può rimuovere partecipanti modificando `sharedWith` nella modal
  (POST `/api/reservations` accetta `sharedWith[]` e replace)
- Capacity check (hard limit): client disabilita add-guest, server rifiuta
  con `exceeds_max_seats` 400

---

## Features implementate (cronologico, alla data corrente)

In ordine di implementazione (può aiutarti a ricostruire il "perché" di certe
scelte):

1. Skeleton Next.js + tema + ISR del catalogo
2. Fetch upstream → fallback snapshot statico (proxy Vercel bloccato anche lui)
3. Editor sub-grouping, badge bookType, search/filter
4. 3-state cells (look/play/buy con stato `checked` / `forbidden`)
5. Stand codes via parsing PDF (`pdf-parse` in `scripts/refresh-data.mjs`)
6. Auth via Neon DB, 90gg session
7. Reservation modal con day picker 22-24 mag, overlap detection
8. Manual events nel calendario (eventi non legati a item)
9. Rating system (`plays`) + pagina `/giocati` ordinata per voto
10. Manual plays (giochi giocati non in lista)
11. BGG link (prima fallback ricerca, poi metodo B con bearer token)
12. UI redesign moderno + 10 colori tema + icona personale (goblin rosso)
13. Manual items (l'utente aggiunge giochi al listone come fossero catalogo)
14. Rush mattina + flash share "si sta per liberare"
15. PWA (manifest, icone, install banner)
16. Reservation sharing con WhatsApp link, posti max, guest, partecipanti
17. Web Push notifications quando qualcuno si unisce
18. Nome utente obbligatorio + edit, partecipantNames lookup, chip
    rimuovibili, capacity hard-limit

Quando l'utente chiede nuove feature, prima di iniziare a scrivere codice
considera se ricicli pattern già stabiliti:
- Per qualcosa "manuale" (eventi/giochi/items aggiunti dall'utente): pattern
  manual_events / manual_plays / manual_items
- Per sharing: pattern share_token in tabella + `/r/[token]` page
- Per notifiche: `sendPushToUser` da `src/lib/push.ts`
- Per nuova tabella DB: aggiungi a `scripts/migrate.mjs` e lancia
  `npm run migrate`

---

## Convenzioni che ho stabilito (mantienile)

- **localStorage keys versionate**: `listoneplay2026:<nome>:v<n>`. Se cambi
  formato value, bump della versione (es. selections era v1 boolean, v2
  con state stringa).
- **Cache delle hook**: tutte le hook condivise tra componenti
  (useReservations, useSession, ecc.) usano un cache globale modulo + lista
  listeners (vedi `src/lib/useSession.ts` per il pattern). Niente Context API.
- **Conferme prima delle azioni distruttive**: ManualItemModal ha doppio
  pannello (confirmDelete state). Per le altre dipende dal contesto.
- **Italian UI texts**: tutti i testi user-facing in italiano. Variabili,
  funzioni, commenti tecnici in inglese.
- **Email-to-name fallback**: helper `emailToName(email)` ritorna parte prima
  della `@`. Usato come fallback se `participantNames[email]` mancante.
- **Theme color via CSS var**: usa `bg-brand`, `text-brand`, `bg-brand-dark`,
  `bg-brand-soft`, `bg-brand-tint` (definite in globals.css). Non hardcodare
  colori brand.
- **Niente push notification per uno stesso utente self-action**: il push
  parte solo dal `/r/[token]` join endpoint, non quando l'owner aggiunge
  guest a sé.
- **Snapshot vs API**: items, votes, editors, bgg sono snapshot statici
  committati nel repo. Aggiornati con `npm run refresh-data` o
  `npm run bgg-refresh` localmente. Nessun fetch upstream a runtime.

---

## Cose da NON fare

- Non proporre di rendere la "name" optional al login — è stato esplicitamente
  reso required dall'utente.
- Non rifare il sistema auth con magic link o OAuth — l'utente vuole
  trust-the-email perché è solo per amici.
- Non rimuovere `.env.local` da OneDrive (l'utente ha deciso così).
- Non suggerire di cambiare regione Vercel — è già configurata.
- Non proporre Edge runtime per le route che usano `web-push` o
  `@neondatabase/serverless` con SQL complesso — runtime nodejs sempre per
  push e DB-pesanti.
- Non spaccare `@theme` Tailwind in più file — sta tutto in `globals.css`.
- Non aggiungere altre dipendenze npm "per comodità" senza prima discutere.
  L'utente apprezza minimal stack.
- Non aggiungere comments inutili nel codice (default no comments).

---

## File chiave (mappa rapida)

```
src/app/
  layout.tsx              metadata, viewport, theme init script
  page.tsx                home con LoginGate wrapper
  manifest.ts             PWA manifest
  icon.jpg, apple-icon.jpg  PWA icons
  globals.css             Tailwind @theme + theme CSS variables
  prenotazioni/page.tsx   pagina calendario prenotazioni
  giocati/page.tsx        lista voti
  rush/page.tsx           rush mattina list
  r/[token]/page.tsx      pagina join condivisa
  api/
    auth/{login,logout,me,name}/   endpoint sessione + nome
    items, editors, votes          dati pubblici
    reservations/                  CRUD + /r/[token]/{join,leave}
    manual-events/                 idem per eventi manuali
    manual-items, manual-plays
    plays                          voti
    rushes
    push/{subscribe,unsubscribe}
    badge                          PNG monocromo per status bar Android

src/components/
  GameList.tsx            home (sezioni catalogo, modali, filtri)
  GameRow.tsx             singola riga gioco (cells + action buttons)
  CalendarView.tsx        /prenotazioni (calendario 3 giorni con lanes overlap)
  PlayedListView.tsx      /giocati
  RushListView.tsx        /rush
  LoginGate.tsx           full-screen login
  AuthBar.tsx             header sticky con nome/logout/cambia nome
  ReservationModal.tsx    modal grossa per prenotazioni
  ManualEventModal.tsx    idem per eventi manuali
  ManualItemModal.tsx     gestione manual item (aggiungi/modifica/rimuovi)
  ManualPlayedModal.tsx   voto manuale
  PlayedModal.tsx         voto catalogo
  RushModal.tsx           rush + avviso veloce
  JoinReservationView.tsx pagina /r/[token]
  ThemePicker.tsx         drawer 10 colori
  InstallHint.tsx         banner PWA install
  NotificationsHint.tsx   banner push permission
  Legend.tsx              legenda icone
  icons.tsx               SVG icons inline

src/lib/
  db.ts                   neon client
  session.ts              JWT + cookies
  push.ts                 web-push helper
  useSession.ts           shared hook cache
  useReservations.ts      stesso pattern
  useManualEvents.ts
  useManualPlays.ts
  useManualItems.ts
  usePlays.ts
  useRushes.ts
  useItems.ts             catalogo (fetch + cache)
  storage.ts              useSelections (con sync DB se loggato)
  calendarBlocks.ts       conversione reservation/manual ↔ blocco calendario
  themes.ts               10 temi
  eventDays.ts            costanti giorni evento + helper Europe/Rome offset

scripts/
  migrate.mjs             ALTER/CREATE idempotente
  refresh-data.mjs        fetch upstream items+votes, parse PDF mappa
  bgg-fetch.mjs           BGG XML API2 con bearer token

src/data/
  items.json              snapshot catalogo
  votes.json              snapshot voti
  editors.json            mappa editore→stand auto
  editor-aliases.json     override manuale
  bgg.json                mappa item→BGG ID auto
  bgg-aliases.json        override manuale
```

---

## Note operative per chat futura

- L'utente si muove veloce e preferisce risposte sintetiche
- Conferma sempre prima di azioni distruttive (push --force, drop table)
- Per commit: messaggio breve, solo ASCII, niente em-dash o middle-dot
- Se la build fallisce su `.next` readlink → cancella `.next` e ribuilda
- Per testare in locale serve `.env.local` completo
- Comandi sempre dalla root, con `cd` esplicito nelle chiamate PowerShell
- Quando aggiorni schema → migrate.mjs è SAFE da rilanciare (IF NOT EXISTS)
- L'utente vuole un file `COMANDI.md` user-facing per i comandi quotidiani
  (refresh dati, BGG, alias, deploy). Questo file invece è solo per me.
