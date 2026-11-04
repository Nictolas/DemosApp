# DEMOS — OPS-STG-001: autorizzazioni sintetiche referendum P3 — 03/11/2026

## Cambiamento implementato in PR #565

Preparata una migrazione SQL *non applicata* allo staging condiviso: `api/database/staging/ops_stg_001_p3_synthetic_ballot_acl_20261103.sql`. Non crea nuovi servizi, ruoli, password, utenti o voti. **Non modifica la produzione** e non avvia backend o notifiche.

Scopo: delimitare le operazioni del ruolo applicativo già esistente `demos_staging_runtime` alle sole prove **sintetiche** sui referendum reali, senza aprire `anon` o `authenticated`.

Il file è protetto da controlli obbligatori:
- Approvazione transazionale esplicita `SET LOCAL civic.p3_runtime_approval='I_APPROVE_P3_SYNTHETIC_BALLOT_ACL'`; senza di essa fallisce chiuso.
- Identità univoca del database **Demos-Staging** e singola riga dell'identificatore, senza basarsi sul solo nome database.
- Ruolo applicativo con `LOGIN` ma senza `SUPERUSER`, `BYPASSRLS` o `INHERIT`.
- **Esattamente due utenti fittizi predefiniti**, nessun altro utente, ballot o posizione preesistente.
- Guard `civic_push_delivery_guard.blocked=true`, entrambe le tabelle con RLS e nessun privilegio diretto pubblico; politiche P3 preesistenti impediscono la riesecuzione.
- Solo `SELECT` sui ballot fittizi appartenenti al processo fittizio e con prefisso `staging-fixture-`; solo `SELECT/INSERT` sulle posizioni dei due utenti sintetici e su ballot visibili.
- Il ruolo non ottiene `UPDATE`, `DELETE`, `TRUNCATE` o privilegi per creare nuovi ballot. Nessun cambio alla guard push.

**Limite da non nascondere:** il ruolo SQL applicativo è condiviso e può vedere i voti di entrambi gli utenti sintetici. Questo controllo è valido **esclusivamente per il collaudo con dati fittizi** e **non costituisce autorizzazione individuale sicura per utenti reali**. La verifica identità del votante deve avvenire tramite l'autenticazione dell'applicazione e va testata in un gate E2E separato. Non usare queste policy in produzione.

## Test GitHub CI

Esteso `api/tests/test_ops_stg_001_p1_p2_p3_migrations_postgres.py` con test di approvazione, database errato, notifiche sbloccate, permessi SQL, accesso di lettura ai soli ballot fittizi, inserimento consentito per uno dei due utenti, rifiuto di schede non consentite e utenti esterni, rollback totale dei dati, impossibilità di applicare due volte la stessa ACL.

Il workflow `.github/workflows/unified-staging-offline-safety.yml` monitora questa migrazione ed esegue il test su **PostgreSQL 16 temporaneo `civic_ci`**, non sul database Render o Supabase. Le verifiche già esistenti per P0, P1, P2, P3 e il frontend continuano a essere richieste.

## Gate aperti e ordine successivo

1. Credenziali e ruolo `demos_staging_preflight` a sola lettura, non ancora disponibili; audit servizi legacy e impostazioni segrete.
2. Verifica finale policy e fixture sintetiche di tutti i flussi E2E. Migrazione P3 preparata, ma **applicazione al database reale richiede specifica autorizzazione e nuova verifica dei prerequisiti**.
3. Collegamento sicuro da Render a Supabase Demos-Staging, con TLS, identificazione della sessione e test E2E autenticazione, profili, opinioni, voto reale, notifiche e privacy; push/email/cron ancora disattivati.
4. Parità test, rollback e solo dopo dismissione graduale dei nove servizi Render staging obsoleti e verifica dei vecchi database/Key Value.

**Non autorizzare lo staging condiviso ai test applicativi**; bootstrap e `/health/ready=503` invariati.

Importanza operativa dell'intervento: da valutare dopo l'esito CI; senza E2E non si chiude alcun gate principale.

## Esito CI verificato

**Commit collaudato:** `38591fb2eab32a9701b4fb302dfb6970f77ee641`. **Workflow Unified Staging Offline Safety** run `41619492048`: tutti e tre i job **SUCCESS** (`bootstrap-offline-contract`, `p0-schema-postgres16`, `p1-p3-schema-postgres16`). Gruppi Node **47/47 + 27/27 = 74/74**. Nel job PostgreSQL P1–P3 entrambe le prove Python risultano `ok`, inclusa la nuova `test_z_explicit_ballot_acl_requires_approval_and_only_exposes_fixtures`.

Il primo tentativo CI ha individuato un test mal costruito: provava a creare due referendum con lo stesso `civic_process_id`, vietato dal vincolo univoco effettivo. Il fixture test è stato corretto introducendo un secondo processo **interamente sintetico e temporaneo**. La nuova esecuzione è verde. Non si sono cambiate le regole della produzione né introdotte eccezioni di schema per far passare il test.

**Stato effettivo:** file SQL e prove automatiche pronti, ma la migrazione delle autorizzazioni **NON è stata applicata** a Supabase condiviso. L'account read-only `demos_staging_preflight`, la connettività Render → Supabase e gli E2E sono ancora gate aperti. Non confondere successo CI con GO applicativo.

## Revisione compatibilità route e ACL (03/11/2026)

Una prova negativa aggiuntiva ha individuato una incompatibilità reale: la route `api/routes/referendum-vote.js` effettuava un `SELECT ... FOR UPDATE` sulla scheda del referendum e la bozza ACL consentiva solo SELECT/INSERT sulle posizioni. Il backend usa però `ON CONFLICT DO UPDATE` per modificare una scelta già salvata.

Correzioni **in branch PR #565, non distribuite**:
- ACL `ops_stg_001_p3_synthetic_ballot_acl_20261103.sql` aggiornata con `GRANT UPDATE (choice, updated_at)` solo sulle posizioni e policy RLS di UPDATE con gli stessi limiti sintetici di SELECT e INSERT. Non concede modifiche a user_id, civic_ballot_id o created_at. Restano 2 utenti fittizi, processo sintetico, approvazione transazionale obbligatoria e guardia push attiva.
- La route legge la scheda senza blocchi che richiedano UPDATE su `civic_ballots`, e ricontrolla `status='scheduled'` e `opens_at > clock_timestamp()` nell'istruzione INSERT/UPSERT, rifiutando le scritture congelate con HTTP 409. Il controllo di consenso politico, identità civica verificata e cooldown resta invariato.
- Verifiche su PostgreSQL 16 temporaneo: **2/2 test Python P1/P2/P3 e ACL superati**, comprese operazioni su scelta esistente, UPDATE limitati alle colonne consentite, accessi sintetici vietati e rollback. Il ramo continua a **non essere GO** sullo staging condiviso; la migrazione ACL non è stata applicata.

**Blocco CI residuo da correggere:** il nuovo test statico `api/tests/referendumRealVote.smoke.test.js` contiene una espressione regolare con backslash duplicati, quindi fallisce pur con la route corretta. La suite `Unified Staging Offline Safety` ha 2/3 job riusciti e 1 job fallito (47/47 test Node di bootstrap; 27/28 smoke Node). Il workflow `Security Agent Validation` fallisce sulla stessa prova; Snyk è success. Un tentativo di correggere il test via connettore è stato bloccato e non è stato aggirato. La CI NON può essere dichiarata verde fino a un nuovo commit con il test corretto e una esecuzione conclusa positivamente.

È emersa anche una dipendenza di E2E ancora assente dallo schema condiviso: `preference_change_cooldowns`, richiesta da `preferenceCooldownService`. Prima dei test applicativi è necessario verificarne schema, privilegi e fixture, senza copiare dati utenti. Restano **4 gate infrastrutturali principali**: credenziali/isolamento, ACL/fixture, collegamento ed E2E, QA/rollback e cleanup. Valutazione intervento **6/10**: corretto un bug reale di privilegi e freeze, ma il test statico e la connessione restano da chiudere.


## Aggiornamento 05/11/2026 — compatibilità con QA notifiche civiche

La condizione iniziale «esattamente due utenti nel database» non riflette più il Demos-Staging reale: i due vecchi account sintetici `pending` coesistono con gli account di prova `DEMOS_CIVIC_QA_20261104_ON` e `DEMOS_CIVIC_QA_20261104_OFF`, entrambi `a` e `PERSON`. La protezione proposta mantiene obbligatori i due UUID originali e accetta **solo** questa coppia aggiuntiva esatta, non altri profili. Gli account QA aggiuntivi **non ottengono accesso ai ballot, ai cooldown o agli snapshot**: le policy restano limitate agli UUID originali e al processo sintetico. Le modifiche sono preparate in un ramo separato per verifica CI PG16/PG17; applicazione sullo staging soltanto dopo i controlli e con l'approvazione transazionale originale. Nessuna cancellazione account, nessun cambio alla guardia push, nessun privilegio per anon/authenticated. Questo non equivale a E2E Android né a GO release.


## Stato applicazione sullo staging unico — 05/11/2026

**APPLICATA E VERIFICATA SU Demos-Staging, NON IN PRODUZIONE.**
Dopo la PR #595 (CI *Unified Staging Offline Safety* **7/7 job SUCCESS** su PG16/PG17 e merge **solo** in `ops/demos-unified-staging-20261102`, commit `509b2b64343834ac0786114a03fb7b9d8abd314e`), questa ACL sintetica è stata applicata sul solo progetto Supabase `Demos-Staging`, usando la procedura transazionale originale `SET LOCAL civic.p3/p4/p5_runtime_approval` per ogni fase P3→P4→P5.

Verifica SQL post-migrazione: **10 policy RLS** sulle quattro tabelle P3/P4/P5, runtime grant ristretto a SELECT/INSERT e alle sole colonne UPDATE indicate; `anon` e `authenticated` senza grant sulle quattro tabelle, nessun DELETE o modifica delle colonne protette. Sono rimasti **4 account di test** (2 originali pending, coppia civica QA ON/OFF), **0** schede/posizioni/cooldown/snapshot, **0** dispositivi e **0** outbox. `civic_push_delivery_guard.blocked=true`.

Il servizio Render `demos-staging` non è stato ridistribuito: è ancora preflight-only, `app_ready=false` e notifiche disattivate. Non sono stati eseguiti test Android/FCM reali (0/6) né aggiornamenti di `main`/produzione/Play. Il completamento ACL **non** conclude il gate applicativo né abilita notifiche. Prossimi blocchi: backend E2E autenticato, fonti ECI/Ministero (issue #589), canary FCM, DPO, rilascio Google Play con GO specifico.
