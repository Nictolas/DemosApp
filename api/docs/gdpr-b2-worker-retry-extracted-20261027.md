# DEMOS — Worker GDPR B2: retry e ricevute, soltanto Draft (27 ottobre 2026)

**Catena PR:** #366 → #371 → #372 → #373 → worker (questa tranche). **NO-GO recovery.**

Questa tranche isola il consumer operatore della coda `privacy_erasure_delivery_outbox` dal vecchio stack #365, senza migrare automaticamente in produzione le sue centinaia di commit. Non registra cron/job, import in `app.js`, route HTTP o inizializzazione automatica. **Non viene attivato B2.**

## Controlli aggiunti al worker

- Due abilitationi esplicite e distinte: `GDPR_ERASURE_OUTBOX_ENABLED=true` e `GDPR_ERASURE_OUTBOX_WORKER_ENABLED=true`. Ogni altro stato rimane bloccato. B2 deve inoltre superare `exporter.config()` **prima di ottenere una connessione SQL**.
- Blocco conservativo con `DEMOS_PRIVACY_RECOVERY_MAINTENANCE`: solo valore assente/`false` consente l'esecuzione; durante recovery o con valori sconosciuti abort prima e dopo i trasferimenti.
- Solo `runOnce(pool, {limit})` su chiamata esplicita dell'operatore (limit 1–20); rifiuta pool o limit errati. **Il modulo non crea connessioni in proprio.**
- La connessione deve identificarsi come **non-superuser, senza BYPASSRLS e non proprietaria** né del ledger né dell'outbox. Verifica `assertProtectedLedger` e `assertProtectedOutbox` su RLS, `FORCE RLS` e grant Data API. Nessun DDL automatico.
- Selezione degli eventi pending con `FOR UPDATE ... SKIP LOCKED`, sorgenti SQL prefissate `public`, ordinamento di coda e lock per evento. Ricevute con `eventKey`, chiave B2, SHA-256 della rappresentazione canonica, ID versione e scadenza COMPLIANCE validata; **se una ricevuta non coincide, non esegue ACK**.
- **Semantica del risultato batch (28/10):** `moreMayRemain=true` se il batch raggiunge il limite; altrimenti `moreMayRemain=null` (**sconosciuto**, mai `false`). `SKIP LOCKED` può non vedere righe bloccate da altri worker; le policy RLS possono nascondere eventi di altri soggetti. Un batch vuoto non è una prova di coda globale esaurita. La verifica globale resta `status()` eseguito da ruolo autorizzato con visibilità completa e, per il recovery, attestazione esterna B2 indipendente.
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

## Prova del pool PostgreSQL reale del backend (senza Render)

Questa verifica rappresenta un ulteriore passo rispetto alle precedenti prove PostgreSQL SQL-only su Demos-Staging, ma **non** prova una connessione Render→Supabase.

- Nuovo test `api/tests/gdprBackendPoolIsolated.pg17.test.js`, integrato in `.github/workflows/gdpr-b2-worker-retry-isolated-ci.yml`. Richiede esplicitamente `GITHUB_ACTIONS=true`, `GDPR_BACKEND_POOL_CI=isolated` e una **URL locale esatta** verso l'istanza PostgreSQL 17 usa-e-getta; rifiuta credenziali o variabili Render/Supabase già presenti.
- Il test crea un **secondo database temporaneo** nel servizio GitHub Actions, separato dal database del test worker. Non tocca Supabase, Render, B2, né utenti reali.
- Per il writer e il worker sono creati due login PostgreSQL reali, **NOBYPASSRLS / NOSUPERUSER / senza privilegi owner**, con password palesemente inventate e specifiche della singola esecuzione CI.
- Viene importato due volte, con cleanup del singleton tra gli usi, il modulo **esattamente impiegato dal backend `api/config/database.js`**. Il primo pool si autentica con il ruolo writer, conferma `current_user`, `current_database`, `application_name`, configurazione TLS **locale** e normalizzazione del parametro `sslmode`; esegue `PrivacyErasureLedgerService.recordEvent()` in modalità outbox. Un evento di soggetto non autorizzato viene rifiutato con `42501` senza aggiungere alcuna riga.
- Il secondo pool, sempre dallo stesso modulo backend, si autentica realmente come worker. Un `PrivacyErasureOutboxWorker` a chiamata esplicita usa il pool per confermare la consegna al **FakeB2** in memoria. Il worker non può inserire eventi nel ledger e il suo `status` (limitato da RLS) non dichiara completezza globale; una sessione amministrativa locale vede le ricevute consegnate e lo stato locale.
- Testato su [workflow GitHub #40600229878](https://github.com/Nictolas/DemosApp/actions/runs/40600229878), commit `44b78e6`: **3/3** test worker PG17 e **2/2** test backend pool PG17, **0 errori**, marker `GDPR_BACKEND_REAL_POOL_PG17_PASS`. Snyk: SUCCESS. La suite non avvia alcun server HTTP né effettua richieste esterne.

**Gate NON superati:** il test verifica `buildDatabaseSsl` solo nel caso *locale*; non verifica la CA/TLS e l'autenticazione contro un server Supabase vero, il pool effettivamente usato dal processo Render, il comportamento della piattaforma Render, una vera identità SQL verificata dal deployment, un bucket/versione B2 reale o completezza dell'archivio esterno indipendente. Per queste prove servono un runtime isolato e credenziali autorizzate. Il recovery #296 continua in **NO-GO**.

## Version ID anomali: lettura locale fail-closed

La relazione outbox contiene una CHECK che impone `b2_version_id IS NOT NULL` a consegna avvenuta, ma non ne impedisce la stringa vuota o un identificativo oltre i 256 caratteri. La verifica locale `PrivacyErasureOutboxWorker.status()` ora classifica come `invalidReceipts` anche le versioni vuote, composte soltanto da spazi o troppo lunghe; in tali casi `ready=false`. Anche il worker rifiuta tali ricevute prima dell'ACK.

Una prova PostgreSQL 17 **interamente sintetica** modifica temporaneamente una ricevuta consegnata in tutte e tre le forme invalide, verifica `invalidReceipts=1` e `ready=false`, quindi ripristina la versione fittizia valida. Questa verifica non dimostra alcuna proprietà di B2 reale né la completezza del journal esterno: recovery #296 resta NO-GO.

## Cancellazione account e referendum senza foreign key (28 ottobre 2026)

Il cleanup canonico dell'account comprende ora esplicitamente `civic_ballot_positions`. La migrazione ordinaria prevede `ON DELETE CASCADE`, ma un restore parziale può conservare la tabella senza il vincolo: in quel caso il percorso precedente eliminava l'account lasciando la scelta referendum identificabile tramite `user_id`. La revoca del consenso comprendeva già questa tabella; non viene modificato quel comportamento.

La regressione PostgreSQL 17 esistente `verify-political-selection-erasure-ci.js` include la tabella senza FK, verifica rollback della cancellazione, replay dell'evento `account_deleted`, secondo replay idempotente e conservazione della scelta di un altro account sintetico. Nessun restore/provider reale viene eseguito. Correzione locale sul ramo Draft #374, ereditata dal servizio condiviso della #371; nessun restacking, nuova PR o merge su `main`. Issue #296 resta OPEN e recovery GDPR NO-GO.

Verifica locale del 28/10 su PostgreSQL 17 temporaneo con soli dati sintetici: prima della correzione la regressione estesa fallisce con una scelta referendum residua (`referendum: 1`, atteso `0`); dopo la correzione supera rollback, replay e conservazione della scelta altrui (`POLITICAL_SELECTION_ERASURE_PG17_PASS`). La suite bootstrap protetto più linked rows supera 16/16 test. Unit check selezioni 1/1, controlli sintassi e `git diff --check` superati. La CI GitHub va verificata sul nuovo HEAD dopo il push; queste prove locali non attestano provider o runtime reale.

## Profili normalizzati e sessioni dopo cancellazione account (28 ottobre 2026)

Il cleanup account elimina anche `user_profile.user_id` e `active_sessions.user_id` in modo esplicito e schema-aware. Il profilo normalizzato contiene dati anagrafici/residenza/avatar ed è scritto dai flussi passkey/OAuth; non deve sopravvivere alla cancellazione quando un restore ha omesso la FK `ON DELETE CASCADE`. Le sessioni operative contengono hash del refresh token, indirizzo IP e user agent; vengono rimosse insieme all'account. Questo intervento non modifica le durate di conservazione di audit, ledger o richieste GDPR.

La fixture PG17 esistente conserva intenzionalmente queste due tabelle senza FK e include un account estraneo con profilo e sessione attiva. Verifica rollback, cancellazione tramite replay, secondo replay idempotente e conservazione esatta del profilo e della sessione dell'altro account. Passkey e identificativi OAuth nei campi `users`, `user_auth_providers`, dispositivi e chiave pseudonima CIE mantengono il cleanup già previsto. Nessun provider reale, dato personale o segreto coinvolto; issue #296 OPEN / recovery NO-GO.

Prova PostgreSQL 17 locale con sole fixture sintetiche: sul servizio precedente la regressione fallisce con `profile: 1` e `sessions: 1` residui (entrambi attesi `0`); dopo la correzione lo script esteso supera cleanup, rollback, replay idempotente e tutela dell'altro account. Suite bootstrap protetto più linked rows: 16/16 PASS; unit selezioni: 1/1 PASS; sintassi e diff-check PASS. CI GitHub da verificare sul nuovo HEAD dopo push; nessuna attestazione di provider o runtime reale.
