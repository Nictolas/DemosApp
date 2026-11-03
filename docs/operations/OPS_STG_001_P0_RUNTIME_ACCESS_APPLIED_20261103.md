# OPS-STG-001 — permessi P0 del runtime applicati a Demos-Staging (3 novembre 2026)

## Intervento realmente applicato

Il ruolo PostgreSQL `demos_staging_runtime` esisteva, con LOGIN e senza privilegi SUPERUSER/BYPASSRLS, ma non aveva permessi sulle quattro tabelle P0 create in `Demos-Staging`. La sola presenza delle tabelle non permetteva al backend di leggerle.

È stato aggiunto il file sorgente `api/database/staging/ops_stg_001_p0_runtime_least_privilege_20261103.sql`, protetto da identità univoca del database, approvazione separata, verifica delle due utenze sintetiche `pending`, controllo di tabelle vuote e RLS già abilitata, assenza di policy/grant preesistenti e `civic_push_delivery_guard.blocked=true`. La migrazione è stata provata contro **PostgreSQL 16 effimero** su GitHub Actions: esito **SUCCESS** per il job `p0-schema-postgres16` della run `41548886703`, con rifiuto di database errato, operator GO assente, righe di altri utenti e applicazione duplicata. Nessuna connessione a servizi reali durante il test.

Dopo il controllo preliminare del database reale (tutti i gate veri), la migrazione `ops_stg_001_p0_runtime_fixture_acl_20261103` è stata **applicata esclusivamente** al progetto Supabase `Demos-Staging` (`fkeayjzvtuvzesljhjbc`), ottenendo `success=true`.

## Verifica successiva — letture di soli metadati e conteggi

| Tabella | Runtime SELECT | Runtime INSERT/UPDATE | Runtime DELETE | RLS | Accesso anon/auth |
| --- | --- | --- | --- | --- | --- |
| `user_profile` | sì | sì, solo i due ID di test | no | ON | no |
| `notifiche_demos` | sì | sì, solo i due ID di test | no | ON | no |
| `iniziative_popolari` | sì | no | no | ON | no |
| `referendum_abrogativi` | sì | no | no | ON | no |

- Quattro policy dedicate per il ruolo `demos_staging_runtime`, nessuna policy o grant pubblico nuovo.
- Le quattro tabelle restano **vuote** (0 righe ciascuna).
- I due account sintetici sono invariati, ancora nello stato `pending`.
- La guardia globale delle notifiche `blocked=true` è invariata.
- Il numero di tabelle `public` in Demos-Staging era **38** nell'ultima lettura: l'aumento rispetto ai 29 della verifica precedente riflette anche avanzamenti P1 paralleli, **non** solo questa migrazione di permessi (che non crea tabelle).
- Nessun deploy, invio Firebase, backend Render collegato o intervento sul database di produzione.

## Gate ancora aperti

Lo staging Render `demos-staging` è ancora **bootstrap-only**, con auto-deploy OFF e readiness applicativa 503. I permessi appena applicati non costituiscono un GO per altri test applicativi. Il gate T-55 richiede ancora connessione reale **Render → Supabase Demos-Staging in session mode**, TLS e identità del runtime verificata, senza utilizzare il pooler transaction-mode 6543. Restano inoltre test end-to-end con dati sintetici, consenso e revoca, Firebase e dispositivi reali, privacy/DPO, canary e rollback.

**Non** cancellare i vecchi staging, il vecchio PostgreSQL Render o abilitare l'invio push sulla base di questo intervento. Il backup del vecchio database Render è stato ripristinato con successo in precedenza, ma il cutover non è concluso.

## Controllo globale delle esposizioni RLS — 03/11/2026

Audit read-only effettuato su **tutte le 38 tabelle `public`** presenti su Supabase Demos-Staging al momento della verifica: **38/38 con RLS attiva**, nessun privilegio diretto `SELECT/INSERT/UPDATE/DELETE` concesso ai ruoli `anon` o `authenticated`. Il provider non consente all'account di connessione di impostare `SET ROLE demos_staging_runtime` (permission denied); questo audit quindi **non è un test reale dell'esecuzione delle API come runtime**, né chiude T-55.

Per impedire regressioni future, il preflight in `api/scripts/unifiedStagingPreflight.js` è stato esteso: invece di ispezionare soltanto una lista fissa di tabelle private, verifica RLS e grants client per **ogni tabella pubblica presente**, comprese quelle aggiunte successivamente, e rifiuta risultati sconosciuti o vuoti. Resta obbligatorio il controllo di identità DB e il GO separato per qualunque socket di rete. Test negativi in `api/tests/unifiedStagingPreflight.test.js` coprono nuove tabelle prive di RLS e privilegi pubblici non autorizzati. 

**Risultati:** 37/37 test Node locali PASS (worktree temporanea rimossa); workflow `Unified Staging Offline Safety` sul commit `366f9160` completato **SUCCESS**. Nessun cambio a Render/Supabase o invio FCM per questa modifica di codice. **Staging ancora NO-GO per E2E applicativi e session-affinity T-55 non certificata.**

## T-55: identità verificata sulla connessione autenticata

Il precedente diagnostico T-55 controllava l'URL staging e campionava `pg_backend_pid()` su due sessioni, ma non verificava **chi fosse l'utente PostgreSQL effettivamente autenticato** e se fosse collegato all'identità del database di test. L'URL validato da solo non è una garanzia del ruolo assunto dal backend.

La PR #565 aggiunge `api/services/civicStagingSessionRuntimeIdentity.js`: **prima** della misurazione della stabilità dei PID, su una connessione realmente ottenuta dal pool, viene eseguita una transazione `BEGIN READ ONLY` con una sola interrogazione delle tabelle private `civic_runtime_identity` e `civic_push_delivery_guard`, oltre a `current_user` e `current_database()`. Devono risultare esattamente: `demos_staging_runtime`, database `postgres`, hash dell'identità staging prevista, `blocked=true`. In caso di discrepanza, dati assenti o errore provider il diagnostico rifiuta l'operazione **prima di eseguire il probe dei PID**, non registra URL, token o identità e distrugge l'eventuale connessione incerta. La transazione è esplicitamente read-only e termina con ROLLBACK.

Test simulati in `api/tests/civicStagingSessionOnRender.test.js` verificano ruolo errato, database errato, identità assente/errata, guardia non bloccata e fallimenti della query. Il controllo **non è ancora stato eseguito sul runtime Render**: lo staging resta bootstrap-only, senza connessione al database. Qualsiasi test T-55 reale richiede prima il GO separato già previsto e credenziali dedicated staging per la sola diagnostica, senza abilitare Firebase.
