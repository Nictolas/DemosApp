# DEMOS — Worker GDPR B2: retry e ricevute, soltanto Draft (27 ottobre 2026)

**Catena PR:** #366 → #371 → #372 → #373 → worker (questa tranche). **NO-GO recovery.**

Questa tranche isola il consumer operatore della coda `privacy_erasure_delivery_outbox` dal vecchio stack #365, senza migrare automaticamente in produzione le sue centinaia di commit. Non registra cron/job, import in `app.js`, route HTTP o inizializzazione automatica. **Non viene attivato B2.**

## Controlli aggiunti al worker

- Due abilitationi esplicite e distinte: `GDPR_ERASURE_OUTBOX_ENABLED=true` e `GDPR_ERASURE_OUTBOX_WORKER_ENABLED=true`. Ogni altro stato rimane bloccato. B2 deve inoltre superare `exporter.config()` **prima di ottenere una connessione SQL**.
- Blocco conservativo con `DEMOS_PRIVACY_RECOVERY_MAINTENANCE`: solo valore assente/`false` consente l'esecuzione; durante recovery o con valori sconosciuti abort prima e dopo i trasferimenti.
- Solo `runOnce(pool, {limit})` su chiamata esplicita dell'operatore (limit 1–20); rifiuta pool o limit errati. **Il modulo non crea connessioni in proprio.**
- La connessione deve identificarsi come **non-superuser, senza BYPASSRLS e non proprietaria** né del ledger né dell'outbox. Verifica `assertProtectedLedger` e `assertProtectedOutbox` su RLS, `FORCE RLS` e grant Data API. Nessun DDL automatico.
- Selezione degli eventi pending con `FOR UPDATE ... SKIP LOCKED`, sorgenti SQL prefissate `public`, ordinamento di coda e lock per evento. Ricevute con `eventKey`, chiave B2, SHA-256 della rappresentazione canonica, ID versione e scadenza COMPLIANCE validata; **se una ricevuta non coincide, non esegue ACK**.
- Il trasporto B2 può riuscire e il commit SQL fallire: l'evento resta pending e il prossimo tentativo può **riusare la stessa versione immutabile**, anziché creare un secondo evento.
- La funzione `status` è un riassunto SQL locale e **non** dichiara l'archivio esterno completo se esistono eventi senza outbox, orfani o ricevute inconsistenti. La lettura dei quattro contatori usa **una sola query e snapshot SQL**, evitando contatori incompatibili durante nuove scritture. Inoltre un ruolo soggetto a RLS riceve `ready=false`, `completeVisibility=false` e contatori globali `null`: non può attestare uno stato completo sulla base delle sole righe visibili. Anche `status.ready=true` con visibilità completa **non** autorizza un recovery: servono checkpoint di completezza indipendenti e confronto dei singoli oggetti B2.

## Prove isolate

`api/tests/gdprOutboxWorkerIsolated.pg17.test.js` utilizza esclusivamente PostgreSQL 17 di un servizio temporaneo GitHub Actions, database `gdpr_outbox_worker_ci`, dati inventati e `FakeB2` in memoria. La guardia richiede gli identificativi locali e rifiuta env/provider di produzione.

Il test prevede: blocco default/recovery senza SQL e rete; identità least-privilege reale; amministratore rifiutato; una consegna valida con ACK; retry a coda vuota; timeout **dopo** un PUT simulato con conservazione della coda; hash/chiave manomessi rifiutati; recovery intervenuto **dopo** l'upload e prima dell'ACK; UPDATE negato; inventario con evento senza outbox che produce `ready=false`.

La suite B2 della #372 copre separatamente Object Lock COMPLIANCE e readback per versione tramite un client S3 in memoria. **Nessuna delle due suite prova un provider B2 reale**.

## Bloccanti non risolti

1. **Completato solo nello staging Supabase:** ruolo worker SQL separato, outbox e policy RLS minime installati con rollback/prove SQL sintetiche. Rimane da testare il processo backend isolato, con credenziali sicure e senza endpoint pubblico. Produzione invariata.
2. Runtime backend privato con credenziali gestite e ruoli verificati realmente in connessione. Non usare servizi web Free esposti come staging isolato.
3. Bucket GDPR B2 dedicato con Object Lock COMPLIANCE, cifratura, retention approvata, readback e checkpoint di completezza/freschezza firmato e conservato in canale esterno.
4. Prova end-to-end di perdita/restore in ambiente in quarantena, riconciliazione bidirezionale con outbox e approvazione del DPO/titolare prima della messa in esercizio.

**Nessun merge, deploy, nuovo segreto o accesso a dati personali.** Issue #296 resta OPEN/NO-GO.

## Demos-Staging: outbox e ruolo worker installati (27 ottobre 2026)

**Questa sezione aggiorna i riferimenti precedenti all'outbox assente. La creazione del database NON autorizza un rilascio né dimostra una connessione effettiva da Render.**

Il progetto Supabase **Demos-Staging** (`fkeayjzvtuvzesljhjbc`, PostgreSQL 17) era già dotato delle 6 tabelle `public` sintetiche e del ruolo `demos_staging_runtime` con RLS/FORCE RLS, mentre `privacy_erasure_delivery_outbox` e il ruolo dedicato al worker non esistevano. Il ledger conteneva **zero eventi** e gli utenti erano esclusivamente i due UUID inventati `...0301` e `...0302`.

### Bootstrap e attestazioni

- SQL operator-only: `api/docs/sql/gdpr-staging-outbox-worker-secure-bootstrap-20261027.sql`. Prima eseguito in una singola transazione `BEGIN; DO ...; ROLLBACK;` (successo; nessun oggetto persistito), quindi applicato con la migrazione Supabase **`20261027225727`**, nome **`gdpr_staging_b2_outbox_worker_secure_20261027`**. Contiene sentinelle sul bootstrap preesistente `20261027205040`, esatta cardinalità degli utenti fittizi e registro vuoto, vietando la sovrascrittura.
- Nuova tabella `public.privacy_erasure_delivery_outbox`: proprietario `postgres`, **RLS=true**, **FORCE RLS=true**, **4 policy** per writer e worker. Il ledger esistente dispone ora di una ulteriore policy `SELECT` per il worker. `anon`, `authenticated` e `service_role`: **zero privilegi DML** sulla tabella. `demos_staging_runtime` può inserire una consegna; il worker può leggere il ledger e aggiornare solo `delivered_at`, `b2_version_id`, `b2_sha256` nella coda, non inserirvi eventi.
- Nuovo ruolo `demos_staging_b2_worker`: `LOGIN`, `NOBYPASSRLS`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, **`PASSWORD NULL`**. La password SQL è nulla anche per `demos_staging_runtime`; verificato nel catalogo `pg_authid` senza leggere alcun segreto. Nessuna credenziale Render/Backblaze B2 generata o configurata.
- Postcheck SQL: **2 utenti sintetici**, `privacy_erasure_ledger=0`, `privacy_erasure_delivery_outbox=0`, **0 utenti estranei**, 4 policy outbox, 3 policy ledger; Supabase Security Advisor `lints=[]`. Gli altri schemi e i privilegi preesistenti non sono stati alterati.

### Prove con transazioni annullate

- `api/docs/sql/gdpr-staging-outbox-worker-transaction-rollback-20261027.sql`: concedendo temporaneamente `SET ROLE` nel medesimo `BEGIN`, l'effettivo ruolo `demos_staging_runtime` ha inserito ledger+outbox mediante CTE atomiche; l'effettivo `demos_staging_b2_worker` ha ottenuto il lock dell'evento pendente (`FOR UPDATE SKIP LOCKED`) e scritto una **ricevuta puramente fittizia**. Il risultato prima del rollback conteneva 1 evento e 1 ricevuta; **`ROLLBACK`** ha ripristinato 0/0 eventi.
- `api/docs/sql/gdpr-staging-outbox-worker-denial-rollback-20261027.sql`: un evento deliberatamente di soggetto *estraneo* alla policy non era visibile al worker; neppure la consegna era visibile o aggiornabile. Le prove di `INSERT` non autorizzato su ledger e outbox sono state respinte con `insufficient_privilege`. Anche questo esperimento è stato **interamente annullato**.
- Postcheck indipendente dopo entrambe: `ledger=0`, `outbox=0`, `users=2`, `pg_has_role('postgres', writer, 'SET')=false`, `pg_has_role('postgres', worker, 'SET')=false`, outbox ancora con RLS/FORCE RLS attivi.
- `api/docs/sql/gdpr-staging-outbox-worker-guarded-rollback-20261027.sql` è un piano di rollback **non eseguito**: controlla identità staging, fixture, policy, zero eventi e assenza di sessioni worker; non usa drop in cascata e mantiene le 6 tabelle originarie.

### Gate ancora aperti

**Non c'è un collegamento Render→staging testato.** La prova con `SET LOCAL ROLE` dimostra privilegi e transazioni PostgreSQL, non la correttezza di TLS, `DATABASE_URL`, `api/config/database.js`, pool Render, autenticazione o comportamento di un servizio privato. Inoltre **non è stato contattato B2**: non esistono evidenze verificate di bucket GDPR separato con Object Lock COMPLIANCE e retention approvata, di una sequenza completa/fresca di eventi esterni o di un restore completo in quarantena.

**Decisione invariata:** issue #296, recovery GDPR **NO-GO**. Le PR stacked restano Draft, nessun merge su `main`, nessun deploy o modifica ai dati di produzione.
