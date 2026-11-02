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
