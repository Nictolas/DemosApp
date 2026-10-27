# DEMOS — Attestazione del divario tra produzione e controlli GDPR Draft

**Ricognizione in sola lettura del 27 ottobre 2026.** Relativa a [issue #296](https://github.com/Nictolas/DemosApp/issues/296). Non è un’autorizzazione a interrompere il servizio, modificare segreti, integrare le PR o ripristinare dati. Stato obbligatorio: **NO-GO**.

## Evidenza provider Render — non isolamento

Snapshot `list_services(includePreviews=true)` del workspace Render DEMOS: **11 servizi** (10 web, 1 static site), tutti `not_suspended`. Tutti i 10 web mostrano `maintenanceMode.enabled=false`. I nove servizi di staging hanno `autoDeploy=no`, ma **rimangono non sospesi**; `demos-security-gates-staging` segue anche il ramo `main` pur senza auto-deploy. Il nome «staging» o «readonly» non dimostra che le variabili DB/B2 puntino solo a staging.

| Servizio | Render ID | Branch | Auto-deploy | Stato | Ultimo deploy osservato |
| --- | --- | --- | --- | --- | --- |
| `demos-backend` | `srv-d2gt3dodl3ps73fmereg` | `main` | **yes** | `not_suspended`, maintenance `false` | **live**: `77cfd86277e8a7c5c5540d42464fe5af46923d01`, terminato 24 ottobre 2026 alle 21:54:38 UTC |
| `demos-frontend` | `srv-d2nm5pmmcj7s73cophhg` | `main` | **yes** | `not_suspended` (static site) | **live**: `b413a0fff5d5c8130ee16b88bd8a0ba25585e09f`, terminato 24 ottobre 2026 alle 21:15:49 UTC |
| Altri nove servizi di staging | Vedi `gdpr-provider-quarantine-audit-20261026.md` | Branch vari, uno su `main` | no | **tutti not_suspended**, maintenance web `false` | Non attestato da questo documento |

L'assenza di deploy successivi nella lista restituita e il valore `live` sono una **fotografia metadata**, non prova della configurazione di tutte le istanze o dell'assenza di sidecar/cron/writer esterni. L'auto-deploy su `main` resta da gestire nel piano di freeze per evitare che un commit successivo modifichi la superficie durante il recovery.

## Confronto puntuale con il commit realmente distribuito

Le seguenti letture GitHub sono state effettuate **usando direttamente il commit del deploy backend live** (`77cfd862`), non solo `main`. Sono state confrontate con la **testa della PR #364 Draft**, commit `2e27a72eaa5bba0fae5d8d048658a912b8f6d3c8`.

| Controllo | Backend live `77cfd862` | Catena Draft fino a #364 `2e27a72` |
| --- | --- | --- |
| `api/middleware/privacyRecoveryMaintenance.js` | **Assente** | Presente (middleware HTTP/guardia job) |
| `api/services/privacyRecoveryGateService.js` | **Assente** | Presente (offline gate/replay) |
| `api/services/privacyErasureOutboxWorker.js` | **Assente** | Presente (outbox, non attiva in produzione) |
| `api/services/privacyErasureLedgerService.js` | **Presente**: `recordEvent()` richiama `ensureTable()`, che contiene `CREATE TABLE IF NOT EXISTS` senza contestuale RLS esplicita | Provisioning esplicito, RLS/revoche nello stesso blocco SQL; nessuna DDL nel normale `recordEvent()` |
| `api/jobs/referendumForecastSnapshotJob.js` | Nessun controllo indipendente `isPrivacyRecoveryMaintenanceActive` | Guardie indipendenti nel job e nel servizio |
| `api/jobs/votiParlamentoSyncJob.js` | Pool PostgreSQL indipendente, solo guardia cron originale assente sul commit live | Guardie nel cron e prima delle query nel Draft |
| `api/routes/cleanup.js`, `api/routes/migrate-columns.js`, `api/routes/admin/database.js` | Percorsi legacy DML/DDL esistenti | Vecchie POST ritirate con 410; guardie addizionali |

**Conseguenza:** il codice dei test sintetici green nelle PR non è in esecuzione sul servizio Render mostrato come live. Prima di una migrazione o di qualunque restore non si può invocare `DEMOS_PRIVACY_RECOVERY_MAINTENANCE` come prova di quarantena in questa revisione distribuita: il middleware della catena Draft **non esiste nel commit osservato**. L'attuale tabella `privacy_erasure_ledger` già presente con RLS non implica la stessa protezione quando la tabella viene creata da zero in un ripristino.

## Riscontro PostgreSQL tramite cataloghi — nessuna riga utente

Snapshot Supabase di **sole query SQL SELECT di `pg_catalog` / `pg_stat_activity`** (27 ottobre 2026):

| Aspetto | Demos produzione | Demos-Staging |
| --- | --- | --- |
| Ledger `public.privacy_erasure_ledger` | Presente, **RLS on** | Assente |
| Outbox `public.privacy_erasure_delivery_outbox` | **Assente** | Assente |
| Sessioni PostgreSQL backend `client backend` nell'istante | 5 | 4 |
| Sessioni etichettate `demos-app-performance-optimized` | 0 | 0 |
| Sessioni client con stato `active` | 1 | 1 |

Questo **non** prova a quali servizi corrispondano le sessioni né l'assenza di connessioni tramite pooler, REST/Data API, edge, job esterni o credenziali riutilizzate. Non sono stati letti `DATABASE_URL`, username dell'app in esecuzione, indirizzi di client, query SQL di utenti, token, righe del ledger o eventi personali. Lo **stato di abilitazione della Data API Supabase non è stato verificato** con gli strumenti disponibili.

## Procedura operativa che richiede autorizzazione distinta

1. **Titolare / operatore responsabile**: approvare il perimetro, finestra, rollback, piano comunicazioni e obblighi di conservazione. Separare «preparare il recovery» da «eseguire il recovery». Non assumere che un incidente sia effettivamente in corso.
2. **Inventario credenziali solo attraverso interfacce protette**: mappare *tutte* le destinazioni dei nove servizi staging, delle 10 web app, eventuali cron, API REST/RPC, pooler PostgreSQL e client esterni senza copiare i valori dei segreti in issue/PR/log. Il solo branch GitHub non dimostra l'isolamento.
3. **Approvazione freeze**: stabilire il blocco effettivo di accessi utente e writer, impedire auto-deploy non coordinati, drenare richieste e query, inclusi processi con pool indipendenti. Annotare l'istante e acquisire evidenza indipendente e verificabile; guardie applicative sono una difesa ulteriore, non sostitutiva.
4. **Preflight codice/distribuzione**: accertare *a runtime* l'esatto commit distribuito per ogni istanza e che contenga le guardie approvate; validare risposta 503 e assenza dei writer **solo nella finestra esplicitamente autorizzata**. Nessun nuovo rilascio è stato effettuato da questa ricognizione.
5. **Preflight database/outbox**: identificare ruolo SQL reale e policy RLS senza pubblicare credenziali; applicare migrazione con permessi minimi solo in ambiente isolato e approvato; il codice Draft richiede **ledger già installato** prima delle normali cancellazioni/revoche. Pianificare il backfill idempotente e contare gli eventi mancanti in outbox senza diffondere eventi utente.
6. **Verifica B2 ed evidenze indipendenti**: dimostrare catena di custodia degli originali, integrità, firme Ed25519/pin root, checkpoint di completezza e freschezza rispetto al freeze, revoche GDPR successive al backup, riconciliazione e approvazione titolare/DPO. Un semplice `HEAD` su B2 o un test mock non prova la completezza.
7. **Decisione manuale GO/NO-GO**: solo dopo aver raccolto i fatti dal provider reale e le autorizzazioni. Se qualunque punto è ignoto/fallisce, **NO-GO** e issue #296 aperta. Nessuna CI verde o auto-valutazione offline può impostare automaticamente GO.

**Non è stato compiuto nessuno dei passaggi operativi mutanti sopra**. Questa è esclusivamente un'attestazione dei limiti tecnici presenti e una checklist per un eventuale operatore autorizzato.
