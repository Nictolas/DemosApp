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
