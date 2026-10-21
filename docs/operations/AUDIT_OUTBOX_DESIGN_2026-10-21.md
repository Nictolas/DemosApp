# DEMOS — outbox durevole per audit e sicurezza (proposta, 21/10/2026)

**Stato: componente e integrazione dietro flag completati nel ramo di sviluppo, NON attivati in produzione. Nessuna migrazione applicata.**

La proposta di conservazione e di gestione degli incidenti è in
`docs/operations/AUDIT_OUTBOX_RETENTION_PROPOSAL_2026-10-21.md`:
le durate proposte sono **da approvare**, non regole applicate né un obbligo
legale uniforme.
La PR #217 ha migliorato il controllo dell'esito HTTP di Axiom, ma un evento critico
può andare perduto se Axiom è indisponibile. L'archivio storico B2 non può
recuperare eventi mai ricevuti da Axiom. Serve una coda *prima* dell'invio.

## Componente già preparato

`api/services/auditOutboxService.js` implementa, ma non attiva:
- `enqueue(event, dataset)`: convalida categoria `audit` o `security`, limita il
  payload a 2 KiB, assegna UUID stabile `axiom_delivery_id`, acquisisce un
  lock transazionale PostgreSQL e verifica che la coda abbia capacità prima
  dell'`INSERT` e del `COMMIT`. Se la scrittura fallisce non simula il successo.
  Il limite predefinito è **5.000 eventi**, includendo dead-letter; il massimo
  configurabile tramite `AUDIT_OUTBOX_MAX_RECORDS` è 10.000. A capienza esaurita
  l'applicazione rifiuta l'accodamento con codice controllato
  `OUTBOX_CAPACITY_EXCEEDED`, senza eliminare eventi storici.
- `drainOnce()`: acquisisce al massimo **10 eventi** per batch usando
  `FOR UPDATE SKIP LOCKED`, *lease* di 90 s e token di proprietà per lavoratori
  concorrenti. Cancella il record solo quando il trasporto conferma realmente
  l'invio. Altrimenti aggiorna scadenza e prossimo tentativo.
- Backoff esponenziale con jitter, massimo un'ora più jitter; dopo otto
  tentativi porta l'evento in `dead_letter` e produce una segnalazione priva
  di identificatori personali.
- `AuditService.logAction` accoda soltanto con `AUDIT_OUTBOX_ENABLED=true` e Axiom abilitato. Restituisce `delivery: 'queued'`, non un falso successo di invio.
- `api/jobs/auditOutboxWorker.js` esegue il drenaggio tramite timer con due flag espliciti; non sovrappone drain nello stesso processo e stampa solo metriche aggregate. Legge salute e profondità coda a ogni ciclo e segnala con `AUDIT_OUTBOX_HEALTH_WARNING` se la coda raggiunge l'80%, se un evento non consegnato attende da almeno 15 minuti oppure se è presente anche un solo dead-letter. L'avviso è limitato a uno per ora finché persiste il problema.
- In modalità disattivata il servizio mantiene il flusso storico direttamente verso Axiom. Nessun cambiamento di retention o database di produzione.

**Garanzia prevista: at-least-once**, non exactly-once. Se Axiom riceve l'evento
ma il processo cade prima del DELETE, al riavvio l'evento può essere ritrasmesso.
L'UUID `axiom_delivery_id` è stabile per consentire la deduplicazione a valle. La PR include ora la deduplicazione **per finestra** nell'archiviatore B2 per audit/security esplicitamente taggati, con errore a contenuti incompatibili; tra finestre sovrapposte resta necessaria la deduplicazione per `archive_event_id` durante il restore.
l'archivio/ricerca deve verificarne esplicitamente la gestione.

## Schema PostgreSQL proposto (NON applicato)

Utilizzare lo schema privato `demos_private`, escluso dagli schemi esposti
nel Supabase Data API. Lo schema seguente serve per revisione; **non è una
migrazione automaticamente applicabile**:

```sql
CREATE SCHEMA IF NOT EXISTS demos_private;
REVOKE ALL ON SCHEMA demos_private FROM PUBLIC, anon, authenticated;

CREATE TABLE demos_private.audit_delivery_outbox (
  id UUID PRIMARY KEY,
  dataset VARCHAR(96) NOT NULL
    CHECK (dataset ~ '^[A-Za-z0-9_-]{1,96}$'),
  category VARCHAR(8) NOT NULL
    CHECK (category IN ('audit', 'security')),
  payload JSONB NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0
    CHECK (attempt_count BETWEEN 0 AND 100),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_id UUID,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_delivery_outbox_due
ON demos_private.audit_delivery_outbox (next_attempt_at, created_at)
WHERE status = 'pending';
CREATE INDEX audit_delivery_outbox_expired_lease
ON demos_private.audit_delivery_outbox (lease_expires_at)
WHERE status = 'sending';

-- Defense in depth even if a schema is accidentally exposed.
ALTER TABLE demos_private.audit_delivery_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON demos_private.audit_delivery_outbox FROM PUBLIC, anon, authenticated;
```

La tabella deve essere visibile **solo** all'identità Postgres usata dal
backend (privilegi dedicati da definire prima dell'attivazione), non alle
chiavi `anon`/`authenticated`; verificare RLS e Data API con query di controllo.
Non è necessaria una nuova istanza database: la tabella può vivere nello
stesso Supabase di DEMOS, con un limite di dimensione e monitoraggio dei costi.


## Collaudo SQL con due connessioni PostgreSQL reali in GitHub CI

Il job `postgres-outbox` di `.github/workflows/logging-regression.yml` avvia
`postgres:17` **solo sul runner effimero di GitHub Actions**, con database
`demos_outbox_ci` e password sintetica di CI. Nessuna connessione al Supabase
di DEMOS e nessuna credenziale produttiva.

Il test `api/tests/auditOutboxRealPostgres.test.js` rifiuta URL che non
puntino esattamente a `127.0.0.1:5432/demos_outbox_ci` e richiede esplicitamente
tale URL sotto GitHub Actions (non può risultare verde saltando la prova).
Esegue lo schema SQL descritto sopra con i seguenti controlli:

- `anon` / `authenticated` non hanno accesso allo schema né alla tabella;
  RLS abilitata e verifica negativa eseguendo `SET LOCAL ROLE anon`.
- La `SELECT ... FOR UPDATE SKIP LOCKED` non attende un record bloccato da
  un'altra transazione.
- Due worker separati condividono lo stesso pool PostgreSQL con connessioni
  indipendenti; un record in invio con lease valido non viene acquisito due
  volte.
- Dopo un'interruzione simulata e la scadenza forzata del lease, un secondo
  worker recupera l'evento con lo **stesso** `axiom_delivery_id`; un ACK
  tardivo del vecchio worker non elimina altri dati.
- Invio fallito → prossimo tentativo, successo → DELETE, tentativi esauriti →
  `dead_letter` senza reinvio successivo.

Il test vero comprende anche la competizione tra due INSERT per l'ultimo
posto disponibile: un solo writer può confermare il COMMIT; gli eventi
`dead_letter` occupano ancora spazio e non vengono eliminati automaticamente.

Questa prova colma la lacuna del test PGlite a connessione singola ma resta
un **collaudo PostgreSQL effimero**, non un collaudo di configurazione Supabase,
rete o credenziali reali. Il job non modifica Render e non configura retention.

**Motivo del limite a 10 per batch:** il worker invia in sequenza e ha timeout
HTTP Axiom di 5 secondi per evento. Dieci richieste possono richiedere
circa 50 secondi, inferiori al lease SQL di 90 secondi in condizioni
ordinarie. Lentezza anomala del database o crash possono comunque produrre
reinvii: la garanzia rimane *at-least-once*, non exactly-once. Per questo
serve controllare la deduplicazione a valle.

## Da completare prima dell'attivazione

1. Revisionare schema e impatto GDPR (finalità, IP/user ID, cifratura, accessi,
   periodi di conservazione degli eventi non consegnati e `dead_letter`).
2. Eseguire una migrazione **solo in staging** e verificare accessi, RLS,
   indici, concorrenza e isolamento dal Data API.
3. **Implementato nel codice, non attivo:** verificare in staging `AuditService.logAction()` con il flag `AUDIT_OUTBOX_ENABLED=true`, assicurando che l'acknowledgement significhi *evento persistito*, non consegnato.
4. **Implementato nel codice, non attivo:** verificare in staging il trasporto Axiom di eventi già minimizzati e il worker con `AUDIT_OUTBOX_WORKER_ENABLED=true`, senza sovrapporlo al job Axiom → B2 esistente.
5. **Implementato nel codice, non attivo:** limite hard a 5.000 record con
   lock PostgreSQL transazionale e allarmi aggregati nei log applicativi di
   Render indipendenti da Axiom. **Aggiunto anche un canale admin opt-in**
   tramite l'esistente `OperationalAlertService` (notifiche in-app e push FCM
   se disponibili), con codici fissi e retry controllato. **Ancora da
   completare:** prova su destinatari admin reali/staging, un monitor
   realmente esterno se sia Render sia DB non funzionano, approvazione soglie
   e runbook per revisione manuale dei dead-letter; nessuna cancellazione
   automatica prima della decisione sulle retention GDPR.
6. Testare in staging Axiom non disponibile, riavvio, lease scaduto,
   doppio worker, duplicazioni, dead-letter e recupero completo.
7. Soltanto dopo queste verifiche, valutare rollout graduale su Render.

**Disponibilità staging verificata 21/10/2026:** il connettore Supabase mostra un solo progetto DEMOS attivo, senza branch di sviluppo; il secondo progetto storico `DemosReplit` è inattivo. Nel progetto DEMOS attivo non esiste ancora lo schema `demos_private` (sola lettura). Non usare il progetto attivo come staging né attivare i flag fino a collaudo PostgreSQL indipendente.

**Flag runtime (entrambi disattivati se assenti):** `AUDIT_OUTBOX_ENABLED=true` accoda gli audit invece di inviarli direttamente, `AUDIT_OUTBOX_WORKER_ENABLED=true` consente il worker periodico, `AUDIT_OUTBOX_RUN_ON_START=true` effettua un ciclo alla partenza. `AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED=true` abilita separatamente notifiche agli admin per backlog, dead-letter e problemi al worker attraverso `OperationalAlertService`; senza il flag il sistema emette solo contatori nei log Render. Avviare solo dopo schema/permessi/retention verificati. Il percorso esplicito `securityEvent=true` del logger centralizzato è ora collegabile alla stessa outbox soltanto con `AUDIT_OUTBOX_SECURITY_ENABLED=true` **oltre** ad `AUDIT_OUTBOX_ENABLED=true`; senza il nuovo flag mantiene l'invio Axiom precedente. Il payload di sicurezza minimizzato include timestamp, `log_type=security`, codice evento controllato e identificativi già anonimizzati secondo configurazione; non salva messaggi liberi, URL, body o campi arbitrari. Questo è un collegamento opt-in a livello del logger: non prova che ogni sorgente applicativa emetta un evento `securityEvent`.

## Test locali del componente

```bash
cd api
npm run test:logging-privacy
```

Oltre ai mock, `api/tests/auditOutboxPostgres.test.js` usa `@electric-sql/pglite` (PostgreSQL WASM) per eseguire realmente lo schema SQL con dati sintetici e verificare RLS, mancanza di privilegi di `anon`/`authenticated`, INSERT, lease SQL, retry, DELETE dopo ACK e dead-letter. La suite logging include ora test di limite transazionale e monitoraggio, oltre ai 15 test di archivio; i risultati numerici aggiornati sono pubblicati dalla GitHub Action dedicata. **PGlite non equivale a uno staging Supabase collegato né testa due connessioni realmente concorrenti.** La prova indipendente di
recupero B2 resta un'altra attività: `archive:axiom:verify-latest` è presente
in `main` ma richiede un ambiente autorizzato con credenziali **di lettura**
sul bucket reale, che non sono risultate disponibili nella copia di sviluppo
locale controllata tramite DeskMCP.
