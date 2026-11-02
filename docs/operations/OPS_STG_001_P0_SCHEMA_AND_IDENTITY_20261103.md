# DEMOS — OPS-STG-001: identità sicura e schema P0 (3 novembre 2026)

## Ambiente e dipendenze Render

- Unico backend condiviso: **`demos-staging`** (già `demos-functional-staging`), piano Render gratuito, auto-deploy OFF, bootstrap fail-closed. Endpoint `/health` 200, `/health/ready` 503, API applicative disattivate.
- Nessun nuovo servizio Render o progetto Supabase creato. Produzione non modificata.
- Audit read-only **Environment Groups** via API Render: esiste un gruppo `ALL` (`evg-d2hkvpumcj7s73aj9t00`), ma **0 servizi collegati**. Non è quindi una sorgente attualmente collegata di variabili d'ambiente. Restano possibili altri segreti/configurazioni indiretti da verificare.
- L'ultimo controllo delle 12 configurazioni dirette Render aveva già individuato e rimosso dal solo `demos-staging` il collegamento `DATABASE_URL` al vecchio PG Render; i job ministeriali e civici sono disattivati, così come i test push e le migrazioni non autorizzate.
- Quattro web service di staging legacy presentano `NODE_ENV=production`: una variabile isolata non implica scritture in produzione. Richiede verifica funzionale/di credenziali prima della dismissione.

## Attestazione identità staging (fallimento chiuso)

La tabella `public.civic_runtime_identity` **esiste sia in Demos-Staging sia in produzione**: verificare solo `to_regclass(...)` non è una prova di isolamento. Le identità effettive sono distinte (verifica non mutante in entrambi i progetti).

- `api/database/staging/ops_stg_001_missing_tables.sql`: rinforzata la guardia originale usando l'hash dell'identità del **solo database staging**, oltre al controllo esplicito del progetto Supabase selezionato. La migrazione originale è già stata applicata, non rieseguirla.
- `api/scripts/unifiedStagingPreflight.js`: aggiunto controllo read-only `SELECT md5(db_identity::text)` che rifiuta un database con identità diversa, anche se l'host o il nome `postgres` sembrano corretti. Il preflight richiede ancora `APPROVED_READ_ONLY_PREFLIGHT` e non può autorizzare automaticamente l'applicazione.
- Test del controllo hash contro valori inesatti, mancanti e duplicati: tutti PASS.

## Migrazione P0 effettivamente applicata al solo Supabase Demos-Staging

Migrazione registrata: `ops_stg_001_app_routes_p0_20261103`. SQL sorgente su PR #565: `api/database/staging/ops_stg_001_p0_app_routes_20261103.sql`.

Quattro tabelle pubbliche **create vuote**, senza dati utente importati dalla produzione:

1. `user_profile` — compatibilità tecnica con route del profilo e autenticazione; `genere` è un campo dello schema legacy, non una decisione di UI sul modello dati attuale.
2. `notifiche_demos` — notifiche interne.
3. `iniziative_popolari` — iniziative popolari.
4. `referendum_abrogativi` — referendum abrogativi.

Evidenze di lettura dopo la migrazione:
- **73/73** colonne con tipi, nullability, default e lunghezza identici allo schema pubblico di produzione.
- **7/7** vincoli e **9/9** indici corrispondenti alla produzione.
- **4/4** tabelle vuote (0 righe) e RLS attiva.
- Ruoli `anon` e `authenticated`: accesso diretto SELECT/INSERT/UPDATE/DELETE negato su 4/4.
- Numero tabelle in `public` da **25 a 29** nel progetto `Demos-Staging`; produzione invariata. La differenza di nomi rispetto a 115 tabelle pubbliche di produzione **non va interpretata come una checklist di copia integrale**.

## Preflight notifiche civiche: letture non mutanti

Controllo remoto mediante Supabase MCP sul solo progetto `Demos-Staging`:
- **18/18** definizioni di colonne civiche corrette (tipo, nullability e default opt-in disattivati).
- **5/5** tabelle riservate con RLS attiva e privilegi diretti di client negati.
- `civic_push_delivery_guard`: esattamente una riga `id=1` con `blocked=true` (nessun via libera all'invio push).

**23/23 test Node locali** superati su bootstrap, preflight e contratti di migrazione. Worktree temporanea di revisione rimossa alla fine dei test. Non sono state testate le API applicative end-to-end; stato runtime resta **NON READY**.

## Gate aperti

1. Verifica ulteriori segreti e dipendenze non direttamente esposte su Render; audit degli staging legacy, in particolare quelli con `NODE_ENV=production`.
2. Schema necessario alle route E2E ancora da completare; usare dati sintetici, non copiare tabelle/righe indistintamente.
3. Collegare in modo controllato il servizio Render esclusivamente al progetto Supabase `Demos-Staging`, con TLS, privilegi minimi e prove negative verso la produzione; mantenere FCM/email/cron in dry-run.
4. QA multiutente, regressione e piano di rollback; solo dopo GO eliminare nove web service staging ridondanti, verificare Key Value e dismettere il vecchio PostgreSQL Render senza spesa.

**Il servizio `demos-staging` non è ancora utilizzabile dalle altre chat per test applicativi.** Tutto lo sviluppo deve proseguire in test locali/CI senza nuovi staging permanenti.
