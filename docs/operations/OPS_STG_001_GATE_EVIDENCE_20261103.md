# DEMOS — OPS-STG-001 · Evidenza requisiti GO/NO-GO (03/11/2026)

## Decisione verificata

**STAGING APPLICATIVO: NO-GO.** Il servizio Render condiviso `demos-staging` è in modalità
bootstrap, auto-deploy disabilitato, nessun collegamento all'app. La PR #565 rimane
Draft e non è autorizzata alcuna distribuzione di produzione. Nessuna delle quattro
macro-fasi è pronta ad essere marcata come completata.

La tabella operativa leggibile è nel Google Sheet
[DEMOS — Roadmap · STAGING — GO GATES](https://docs.google.com/spreadsheets/d/1o7gI3m2Mbs2NRQtoyVh3DZW-7jlQinZgC-ou9Nc-q10/edit#gid=2026110303).
I dati qui registrati sono stati rilevati **senza modifiche al DB/Render**.

## Controlli attualmente superati (solo metadata + CI)

| Controllo | Stato | Fonte |
| --- | --- | --- |
| PostgreSQL Supabase Demos-Staging | Engine 17, progetto dedicato e attivo | Metadata Supabase |
| Tabelle minime richieste dal preflight | **35/35** presenti | Catalogo staging vs `REQUIRED_TABLES` nel codice |
| Colonne runtime richieste | **18/18** conformi al contratto; `users.status` è `varchar` nullable, consentito esplicitamente dal valutatore | `information_schema.columns` e `CIVIC_RUNTIME_COLUMNS` |
| Tutte le tabelle `public` | **51/51** con RLS; zero concessioni dirette di SELECT/INSERT/UPDATE/DELETE o per-colonna ai ruoli `anon`/`authenticated` | Catalogo staging |
| Sequenze `public` | **6/6** senza grant `SELECT/USAGE/UPDATE` a `anon`/`authenticated` | Catalogo staging |
| Views/matviews/foreign tables `public` | **0** oggetti | Catalogo staging |
| Procedure e funzioni `public` | **0** oggetti | Catalogo staging |
| Dati fixture | 2 utenti sintetici; zero snapshot; `civic_push_delivery_guard.blocked = true` | Query in sola lettura |
| Test offline | `Unified Staging Offline Safety` 7/7 job SUCCESS su PostgreSQL 16 e 17 | GitHub Actions, run 41650911351 |
| Servizi Render staging | 1 condiviso e 9 legacy, tutti `autoDeploy=no`, nessuno sospeso, ultimo deploy del condiviso 02/11/2026 | Dettagli Render `get_service` e storico deploy `list_deploys` |
| Backup vecchio PostgreSQL Render | La Roadmap riporta hash verificato e `pg_restore --exit-on-error` riuscito in PG17 temporaneo, 33 tabelle/124 indici/26 FK | `STAGING — DIRETTIVA` righe 40 e 43; **non ripetuto** in questo audit |

**Nota:** queste verifiche **non provano** che l'API, l'autenticazione o il ciclo di vita
delle notifiche funzionino sullo staging condiviso. Non usare l'assenza di
viste/funzioni come prova che non esistano altre superfici API; sono controlli
sullo schema `public`.

## Blocchi operativi attuali (non modificati)

1. **Credenziale dedicata:** `demos_staging_preflight` è **assente** nel database.
   Il provisioning `PASSWORD NULL` è preparato e collaudato in CI, ma l'applicazione
   reale richiede un'approvazione distinta e un gestore di segreti autorizzato.
2. **Autorizzazioni applicative:** nove tabelle dei flussi P3/P4/P5
   (`civic_ballots`, `civic_ballot_positions`, `civic_ballot_forecast_snapshots`,
   `preference_change_cooldowns`, `notifiche_avvistamenti`,
   `notifiche_comunali`, `notifiche_voti_comuni`,
   `political_opinion_notifications`, `segnalazioni`) hanno RLS abilitata
   ma **nessun grant SELECT/INSERT/UPDATE/DELETE per `demos_staging_runtime`**,
   e nessuna policy per quel ruolo. È una scelta deny-by-default finché non
   saranno approvati i singoli SQL di fixture sintetiche P3, P4, P5.
3. **Render→Supabase:** bootstrap senza API e senza connessione SQL operativa.
   Non sono autorizzati E2E né consegne FCM/email, né i job automatici.
4. **Dipendenze legacy:** i 9 servizi esistono, sono ancora LIVE/non sospesi.
   L'audit delle variabili **dirette** è disponibile, ma non elimina l'incertezza
   sui collegamenti indiretti (Environment Groups, job, riferimenti esterni).
5. **Retirement/rollback:** E2E, parità test specialistici, rollback e
   autorizzazione della dismissione restano aperti.

Il database Render `demos-civic-staging-db` (piano Free) risulta
`available` con scadenza **08/11/2026 17:38:42 UTC** secondo i
metadata Render. Il backup verificato in precedenza è una condizione
necessaria, **non** un'autorizzazione a eliminare il database o i servizi
associati. La verifica diretta di telemetria delle connessioni non è stata
ripetuta in questo audit, che ha rilevato soltanto deployment e metadata
dei servizi. Le connessioni segnalate in controlli precedenti non
sono ancora state attribuite a una sorgente specifica.

## Sequenza di sblocco suggerita

- Completare inventario credenziali **senza esportare segreti** e approvare
  il ruolo preflight con password protetta; controllare identità PostgreSQL,
  TLS e assenza di poteri di scrittura.
- Dopo approvazione separata, applicare solo le ACL sintetiche strettamente
  necessarie e verificare l'isolamento tra utenti fittizi.
- Eseguire test Render→Supabase dell'app con canali esterni disabilitati,
  poi rollback documentato.
- Soltanto dopo il GO finale, ritirare con verifiche progressive gli
  ambienti legacy. Non abbassare la soglia di privacy degli snapshot
  (`MIN_PUBLIC_RESPONSES=10`) per far passare test con due utenti.

**Nessuna risorsa creata/eliminata e nessun dato utente reale letto o modificato
durante questo intervento.**
