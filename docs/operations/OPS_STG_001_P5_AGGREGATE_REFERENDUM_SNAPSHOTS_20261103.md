# DEMOS — OPS-STG-001 P5: snapshot aggregati referendum (3 novembre 2026)

## Intervento realmente eseguito

Solo nel progetto Supabase **Demos-Staging** `fkeayjzvtuvzesljhjbc` è stata applicata la migrazione additiva, versionata in PR #565, `api/database/staging/ops_stg_001_p5_forecast_snapshots_20261103.sql` (`ops_stg_001_p5_forecast_snapshots_20261103`; esito `success=true`).

**Perché serve:** `api/services/referendumForecastSnapshotService.js` registra periodicamente soltanto conteggi aggregati dei referendum, e i servizi di statistiche/storico leggono `civic_ballot_forecast_snapshots`. La tabella mancava del tutto dallo staging, impedendo test di storico, andamento e confronto della previsione finale.

**Tabella nuova e vuota:** `civic_ballot_forecast_snapshots`, composta da `civic_ballot_id`, intervallo temporale e sei campi di conteggio/stato e timestamp, **senza `user_id`, email o scelta individuale**. Conserva conteggi aggregati, non identificativi dei votanti.

### Guardrail applicati

- SQL `BEGIN/COMMIT`, identità esclusiva del database Demos-Staging validata mediante hash `0cbb6ace68a9f11956904e2a37898ec8`, identità distinta da produzione, singola riga nell'identificatore.
- Guardia `civic_push_delivery_guard.blocked=true`; esistenza della tabella prerequisito `civic_ballots`; assenza preventiva della tabella e dell'indice destinazione, con errore e rollback su collisione.
- **Nessun DML** per trasferire dati di produzione, nessuna copia di voti, nessuna cronologia individuale, nessun trigger di notifiche.
- `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL` su PUBLIC/anon/authenticated; nessuna nuova autorizzazione al ruolo applicativo `demos_staging_runtime`. Non aprire l'accesso automaticamente per far passare gli E2E.
- Nessun deploy, nessun nuovo ambiente persistente o costo di infrastruttura e nessuna modifica alla produzione.

### Verifica dopo l'applicazione

Confrontati *metadati* di produzione in sola lettura con quelli dello staging dopo la migrazione:
- **9/9 colonne** identiche per nome, tipo, default e nullabilità.
- **7/7 vincoli** identici per nome e definizione, compresi `CHECK` su conteggi non negativi e somma delle scelte, PK composta e FK a `civic_ballots` con `ON DELETE CASCADE`.
- **2/2 indici** identici per nome e definizione.
- **0 righe** nella nuova tabella; RLS attiva; SELECT/INSERT/UPDATE/DELETE non concessi a `anon`, `authenticated` o `demos_staging_runtime`.
- Staging da **50 a 51 tabelle pubbliche**, protezione RLS e diniego a ruoli pubblici **51/51**, invio push ancora bloccato.
- Il preflight statico ora richiede **35 tabelle**, inclusa `civic_ballot_forecast_snapshots` fra quelle riservate; in mancanza di questa, deve fallire chiuso.

### Test GitHub

Commit di test `694cca140e9f79a6a88a437117887653d18e0486`, run `41627781256` — **Unified Staging Offline Safety: 3/3 job SUCCESS**, di cui Node **51/51 + 29/29 = 80/80 PASS**, PostgreSQL 16 P0 SUCCESS, PostgreSQL 16 migrazioni P1–P5 e ACL sintetiche **5/5 test Python PASS**.

I test PG16 eseguono realmente la migrazione P5 su un database temporaneo `civic_ci`, ne verificano le guardie fail-closed, i nove campi, sette vincoli, due indici, RLS e divieto di accesso pubblico. Il nuovo test aggiuntivo crea una sola scheda sintetica, scrive uno snapshot con dieci risposte aggregate, respinge somme incoerenti, conteggi negativi e intervalli duplicati, annulla l'intera transazione e verifica zero righe residue. **Non usano Supabase né Render.**

Per questo commit risultano **6/6 workflow GitHub SUCCESS**, inclusi build frontend e Security Agent, più **Snyk SUCCESS**.

### Stato operativo e priorità

Lo staging Render `demos-staging` è ancora **solo bootstrap** (`autoDeploy=no`, start `cd api && node staging/unified_staging_bootstrap.js`, `/health/ready=503`); **nessun E2E applicativo autorizzato**.

**Restano quattro gate obbligatori:**
1. Audit delle dipendenze dei servizi staging legacy e credenziale davvero read-only `demos_staging_preflight` con provisioning autorizzato, isolata da produzione.
2. Fixture, policy e privilegi minimali per provare i flussi sintetici, incluse ACL P3/P4 preparate ma non applicate e ulteriori requisiti dei servizi aggregati. Verificare autenticazione/isolamento utente nel backend.
3. Collegamento con TLS/session-mode di Render esclusivamente a Demos-Staging e veri test E2E di auth, opinioni, profili, referendum, notifiche, privacy con FCM/email/cron OFF.
4. Collaudo/regressione, rollback e solo dopo GO dismissione graduale dei **9 vecchi staging**, con verifica del vecchio PostgreSQL/Key Value e backup.

Non importare ciecamente altre tabelle della produzione: valutare soltanto la dipendenza delle route effettive. Il codice sorgente della PR non è ancora distribuito.

**Valutazione dell'avanzamento: 8/10.** Completata in modo verificato una dipendenza necessaria a storico/trend dei referendum, con collaudo SQL reale e zero ampliamenti dei permessi. I quattro gate infrastrutturali non sono chiusi.
