# DEMOS — OPS-STG-001 / P3 referendum reali, notifiche e segnalazioni — 03/11/2026

## Stato verificato: migrazione P3 APPLICATA a Supabase Demos-Staging

Il progetto **Demos-Staging** `fkeayjzvtuvzesljhjbc` è l'unico progetto database modificato. Lo script versionato in PR #565 `api/database/staging/ops_stg_001_p3_ballots_notifications_segnalazioni_20261103.sql` è stato applicato una sola volta come migrazione `ops_stg_001_p3_ballots_notifications_segnalazioni_20261103`, ottenendo **success=true**.

### Scopo preciso

Sette tabelle richieste da percorsi esistenti dell'app, *senza replicare dati personali*:

| Tabella | Percorso/funzione |
| --- | --- |
| `civic_ballots` | Referendum reali: quesito e apertura/chiusura ufficiale |
| `civic_ballot_positions` | Scelte sì/no/astensione legate a utenti sintetici |
| `notifiche_voti_comuni` | Notifiche di comunicazioni/voti comunali |
| `political_opinion_notifications` | Notifiche sulle opinioni dei rappresentanti |
| `notifiche_comunali` | Notifiche territoriali |
| `notifiche_avvistamenti` | Notifiche avvistamenti |
| `segnalazioni` | Segnalazioni/report app |

Sono rimaste fuori le tabelle di preferenze ormai ritirate, come `voti_iniziative_popolari`: non replicare automaticamente ogni tabella della produzione.

### Protezioni della migrazione

- Prima di qualsiasi DDL, transazione `BEGIN/COMMIT` con confronto **identità effettiva** `md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8'` e verifica `civic_push_delivery_guard.blocked=true`.
- Verifica preventiva delle dipendenze `users` e `civic_processes`, degli oggetti e degli indici preesistenti; errore e rollback se condizioni inattese.
- **7 tabelle vuote**, nessun `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE` o invio push.
- RLS **ON per tutte le sette tabelle**; `REVOKE ALL ... FROM PUBLIC, anon, authenticated`. Nessun GRANT al ruolo `demos_staging_runtime` durante la migrazione: i privilegi applicativi richiedono progetto, verifica delle fixture, policy e GO separati.

### Verifica indipendente dopo applicazione

Query read-only su **produzione** (solo metadati) e su **Demos-Staging**:

- **78/78 colonne** identiche per nome, tipo, default, nullability, lunghezza/precisione.
- **33/33 vincoli** identici per nome, tipo e definizione.
- **22/22 indici** identici per nome e definizione.
- **7/7 tabelle con 0 righe**, RLS attiva e permessi diretti anon/auth negati.
- Totale schema `public` staging **49** tabelle (da 42), produzione **115**; ora **69** nomi presenti in produzione non presenti nello staging, *non tutti necessari al collaudo*.
- Audit globale staging: **49/49** tabelle con RLS e senza GRANT diretti anon/auth.
- Verifica ruoli: `demos_staging_runtime` esiste senza BYPASSRLS; **`demos_staging_preflight` non esiste ancora**. Non confondere questi ruoli.
- Advisor Supabase security: sola informativa `rls_enabled_no_policy`, coerente con l'approccio default-deny delle tabelle ancora non autorizzate.

### Codice e test di regressione

In PR #565 il preflight `api/scripts/unifiedStagingPreflight.js` richiede adesso tutte le **33 tabelle P0–P3**; la lista statica delle tabelle private aggiunge queste sette e i test impongono che l'assenza di una sola mantenga il risultato NO-GO.

`api/tests/unifiedStagingSchemaContract.test.js` verifica atomicità, identità esclusiva dello staging, assenza di scritture e RLS P3. Il workflow `Unified Staging Offline Safety` osserva le modifiche P3 e ha terminato **SUCCESS** sul commit `05a09f46`, run `41616962335`, con entrambi i job (contratti Node e PostgreSQL 16 effimero) verdi; nel job Node risultano **47/47 + 27/27 = 74/74 test** superati. Nello stesso commit `Legacy Menu retirement regression`, `Recognition CIE evidence validation` e `Civic new initiative notifications (draft)` risultavano **SUCCESS**; Snyk `success`. Build frontend e Security Agent ancora in corso all'ultimo controllo, non marcarli PASS preventivamente.

### Quattro gate ancora aperti

1. Audit completo delle credenziali e dipendenze dei servizi legacy; provisioning **autorizzato** di `demos_staging_preflight` solo lettura, diverso dal runtime. Non aggirare il blocco del provisioning precedente.
2. Completare esclusivamente schema, policy e **fixture sintetiche** per i flussi E2E selezionati. P3 ha migliorato lo schema, non ha autorizzato scritture né creato dati sintetici per notifiche/referendum.
3. Collegare Render `demos-staging` a Supabase **Demos-Staging** con session mode 5432, TLS e identità/ruolo reali verificati; eseguire E2E autenticazione, opinioni, voto referendum reale, profili, notifiche e privacy; FCM/mail/cron disabilitati.
4. Validare parità dei test specialistici e rollback, poi procedere a eventuale dismissione dei nove servizi staging ridondanti e verifica KV/vecchio PG Render.

Render resta **bootstrap fail-closed** (`autoDeploy=no`, `/health/ready=503`); lo staging non è autorizzato ai test applicativi. Nessun nuovo ambiente permanente, costo aggiuntivo o modifica produzione.

**Valutazione importanza intervento: 8/10** — sette dipendenze applicative reali preparate, verifica di parità/isolamento completa, test offline verdi; i gate di rete ed E2E restano il collo di bottiglia.
