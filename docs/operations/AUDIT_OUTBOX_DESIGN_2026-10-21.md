# DEMOS — outbox durevole per audit e sicurezza (proposta, 21/10/2026)

**Stato: componente e integrazione dietro flag completati nel ramo di sviluppo, NON attivati in produzione. Migrazione applicata esclusivamente a Demos-Staging; nessuna migrazione applicata al database DEMOS di produzione.**

Staging Supabase creato e verificato il 21/10/2026 (progetto `fkeayjzvtuvzesljhjbc`, regione `eu-central-1`, preventivo $0/mese): report dettagliato in `docs/operations/SUPABASE_OUTBOX_STAGING_VERIFICATION_2026-10-21.md`.

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
  `FOR UPDATE SKIP LOCKED`, ma **uno alla volta**: il *lease* di 90 s
  viene creato immediatamente prima dell'invio di ciascun evento, non per
  tutti i dieci all'inizio del batch. Ogni evento ha un token di proprietà
  distinto. Cancella il record solo quando il trasporto conferma realmente
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

## Schema PostgreSQL (applicato solo nello staging Supabase; NON in produzione)

Utilizzare lo schema privato `demos_private`, escluso dagli schemi esposti
nel Supabase Data API. Questo schema è stato creato nel progetto Demos-Staging
mediante la migrazione `create_private_audit_delivery_outbox_staging`.
**Non è stato applicato in produzione e non deve essere applicato senza
approvazione e collaudo dell'identità database effettiva del backend:**

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

### Ruolo tecnico minimo (seconda migrazione, applicata solo su staging)

Lo staging contiene ora anche la migrazione
`grant_private_audit_outbox_worker_staging` (versione `20261021160408`).
La seguente istruzione è stata applicata **solo** al progetto
`Demos-Staging`, mai al database di produzione:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'demos_outbox_worker') THEN
    CREATE ROLE demos_outbox_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA demos_private TO demos_outbox_worker;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE demos_private.audit_delivery_outbox TO demos_outbox_worker;

CREATE POLICY demos_outbox_worker_access
  ON demos_private.audit_delivery_outbox
  FOR ALL TO demos_outbox_worker
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON SCHEMA demos_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON demos_private.audit_delivery_outbox FROM PUBLIC, anon, authenticated;
```

`demos_outbox_worker` è intenzionalmente **NOLOGIN**, non può autenticarsi
come utente di rete e non possiede `BYPASSRLS` o `CREATEROLE`.
Non è stato creato un login o una password per il worker e **nessun
backend è collegato allo staging**. In futuro servirà un'identità di
connessione dedicata, una membership controllata e una verifica effettiva
di autorizzazione e isolamento, compresi i privilegi implicitamente
concessi dal ruolo Postgres `PUBLIC`. Il ruolo NOLOGIN ha infatti
`USAGE` sullo schema `public` per eredità, ma non `CREATE`:
https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c
Non concedere l'accesso alla coda ai ruoli
client `anon`, `authenticated` o `service_role`; non usare il ruolo
`postgres` amministrativo come soluzione definitiva a privilegi minimi.

La tabella deve essere visibile **solo** all'identità Postgres usata dal
backend (privilegi dedicati da definire prima dell'attivazione), non alle
chiavi `anon`/`authenticated`; verificare RLS e Data API con query di controllo.
Non è necessaria una nuova istanza database: la tabella può vivere nello
stesso Supabase di DEMOS, con un limite di dimensione e monitoraggio dei costi.


## Connessione applicativa dedicata: fail-closed

Il servizio usa ora `api/services/auditOutboxDatabase.js` per creare un
**pool PostgreSQL separato** (massimo due connessioni), indipendente
da `DATABASE_URL` e dal pool applicativo di DEMOS.

L'accesso alla coda necessita della **nuova** variabile server-side
`AUDIT_OUTBOX_DATABASE_URL` con un login Postgres dedicato: non viene
letta finché la funzione non è attivata. La URL è obbligatoria e non può
essere identica alla normale `DATABASE_URL`; non deve contenere account
`postgres` o `service_role`.

**Nuova barriera anti-scambio database:** la variabile obbligatoria
`AUDIT_OUTBOX_DEPLOYMENT_SCOPE` deve valere precisamente `staging` o
`production`. Entrambe le connessioni `DATABASE_URL` e
`AUDIT_OUTBOX_DATABASE_URL` devono identificare **lo stesso** progetto
Supabase, e il suo identificativo deve essere quello immutabilmente
previsto dal codice: `fkeayjzvtuvzesljhjbc` per lo staging,
`wxnblcqoyjqxktwkcqok` per la produzione.

La connessione **principale** `DATABASE_URL` può mantenere il metodo
già usato da DEMOS, incluso il Supavisor **transaction pooler 6543**
(`api/config/database.js` lo prevede esplicitamente), oppure la
connessione diretta/sessione 5432. L'URL **dedicata alla outbox** può
usare **solo** connessione diretta o Supavisor **session pooler 5432**,
perché la coda impiega transazioni, lease e lock PostgreSQL. Entrambe
devono appartenere allo stesso `project-ref`, che per Supavisor è
presente nello username `ruolo.<project-ref>`, e avere database
`/postgres`. Nessuna connessione outbox sul pooler 6543 è accettata.
Se il progetto, il ruolo, la porta o la dichiarazione dell'ambiente
non coincidono, il pool dedicato **non viene nemmeno creato**.
Nessuna scelta automatica del progetto in base alla sola `NODE_ENV`.

Guida: https://supabase.com/docs/guides/database/connecting-to-postgres

**Solo in CI** è consentito `AUDIT_OUTBOX_DEPLOYMENT_SCOPE=ci-only`,
con `NODE_ENV=test` ed entrambe le URL vincolate al database temporaneo
`127.0.0.1:5432/demos_outbox_ci`. Questa eccezione è respinta su Render
in modalità production.

Al primo utilizzo, il servizio legge soltanto metadati di autorizzazione
del ruolo effettivamente autenticato: membership nel ruolo NOLOGIN
`demos_outbox_worker`, nessun superuser/BYPASSRLS, ruolo abilitato al
login, RLS della tabella attiva e grant su SELECT/INSERT/UPDATE/DELETE.
Se la verifica fallisce, **non** effettua INSERT né consegne e produce
solo `AUDIT_OUTBOX_DATABASE_PREFLIGHT_FAILED`, senza credenziali o PII.
Un worker malconfigurato non deve impedire l'avvio del resto del backend.
La connessione usa TLS con CA verificata come la configurazione database
già in uso nel backend; vengono ignorati parametri SSL non affidabili
eventualmente presenti nella URL.

La migrazione dello staging ha creato il **solo** ruolo NOLOGIN di base.
Non esiste ancora un login dedicato reale in Supabase e nessuna credenziale
è stata copiata dai servizi di produzione. Un test SQL su Supabase 17.11
ha tuttavia impersonato temporaneamente il ruolo NOLOGIN dentro una transazione
annullata con `ROLLBACK`, verificando realmente INSERT, claim con lease,
retry, dead-letter e DELETE. È stato confermato dopo il test che `postgres`
conserva soltanto l'appartenenza amministrativa creata da Supabase
(`ADMIN=true`, `INHERIT=false`, `SET=false`), non il diritto
aggiuntivo temporaneo di assumere il ruolo. **Non equivale a testare
l'autenticazione di un LOGIN runtime attraverso il Session Pooler.**
Vedi `SUPABASE_OUTBOX_STAGING_VERIFICATION_2026-10-21.md`. In GitHub CI il collaudo crea
un login temporaneo e sintetico `demos_outbox_runtime_ci`, ne verifica
i grant e usa il vero pool dedicato per accodamento, consegna fittizia
e cancellazione dopo ACK. Le credenziali CI non devono mai essere riutilizzate.

**Nota**: un account ordinario con privilegi elevati resta vietato anche
se dispone di grant alla tabella: il controllo richiede esplicitamente
l'assenza di `BYPASSRLS` e superuser. L'utente database effettivo deve
essere distinto dalla connessione ordinaria dell'applicazione.

### Verifica preflight del runtime staging

Per evitare collegamenti accidentali alla produzione, il comando
`npm run audit:outbox:staging-preflight` rifiuta qualsiasi URL PostgreSQL
che non identifichi esplicitamente `Demos-Staging`. Verifica il ruolo
applicativo con una connessione di sola lettura e non esegue alcun
INSERT/UPDATE/DELETE. Riconosce soltanto connessioni dirette su porta
5432 o il Session Pooler Supabase su porta 5432 (non il pooler transaction-mode
6543). Anche in staging il ruolo non deve essere un account amministrativo.
Non richiede né visualizza dati personali, token Axiom o chiavi B2.

Per dettagli, configurazione e limiti degli accessi consultare
`SUPABASE_OUTBOX_STAGING_VERIFICATION_2026-10-21.md`.

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

**Correzione lease per evento:** il worker può elaborare fino a dieci
messaggi per ciclo, ma ne acquisisce **solo uno per volta**, immediatamente
prima di spedirlo. Nel precedente modello gli ultimi messaggi erano già
prenotati mentre i precedenti aspettavano Axiom: sotto latenza elevata i
lease potevano scadere prematuramente. Ogni claim usa ora il proprio token
e ha 90 secondi dalla rispettiva acquisizione. Un crash o un timeout
ancora maggiore può produrre reinvii: resta una garanzia *at-least-once*,
non exactly-once. Un test PostgreSQL reale con due worker verifica che
un primo invio lento non blocchi il secondo evento ancora pending.

## Notifiche amministrative: retry dopo consegna fallita

L'outbox usa il servizio esistente `OperationalAlertService`, senza
introdurre un servizio a pagamento. Un difetto nella soppressione degli
avvisi avrebbe potuto silenziare un errore **anche se la notifica non
fosse stata effettivamente registrata**. Il controllo è stato corretto:

- la finestra di silenziamento della notifica decorre **solo dopo**
  una conferma di persistenza in-app o push riuscita;
- se il database/notificatore fallisce, l'evento resta ritentabile
  secondo le soglie del worker (senza registrare una falsa consegna);
- gli avvisi identici contemporanei vengono coordinati in memoria;
  uno dei tentativi non viene falsamente dichiarato riuscito prima
  dell'esito del primo;
- se la notifica è già stata salvata nel database ma il successivo
  invio FCM fallisce, il salvataggio resta riconosciuto come riuscito:
  non si generano copie in-app identiche al prossimo tentativo;
- gli errori tecnici SQL/FCM non vengono stampati integralmente nei
  log Render perché potrebbero contenere credenziali o identificativi;
- test automatici simulano DB che fallisce al primo tentativo,
  database poi ripristinato, assenza di destinatari e invii concorrenti.

**Limite:** queste notifiche restano dipendenti dal backend e dal
database DEMOS; l'interruzione simultanea di Render e del DB non può
essere rilevata dal servizio interno. La consegna effettiva FCM verso
destinatari admin autorizzati resta da collaudare. Nessuna modifica
alla conservazione GDPR né cancellazione di eventi è inclusa qui.

## Da completare prima dell'attivazione

1. Revisionare schema e impatto GDPR (finalità, IP/user ID, cifratura, accessi,
   periodi di conservazione degli eventi non consegnati e `dead_letter`).
2. **Schema e test SQL reali completati nello staging:** RLS, permessi `anon`/
   `authenticated`, indici, lease, retry, dead-letter e cleanup. **Restano**
   il controllo HTTP della Data API, i grants dell'identità runtime del
   backend e un test multi-connessione sulla configurazione Supabase reale.
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

**Staging disponibile dal 21/10/2026:** `Demos-Staging` è stato creato nell'organizzazione gratuita `DemosReplit` con preventivo di 0 USD/mese. La migrazione di staging è riuscita; due eventi sintetici sono stati processati e poi cancellati singolarmente. La tabella ora è vuota. Dopo la policy ristretta al ruolo NOLOGIN l'advisor Supabase non segnala problemi di sicurezza né di prestazioni. Il progetto DEMOS attivo resta privo dello schema `demos_private`, verificato in sola lettura. **Non attivare i flag in produzione.**

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
