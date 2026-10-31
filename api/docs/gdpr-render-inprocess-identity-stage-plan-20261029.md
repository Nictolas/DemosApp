# DEMOS — GH-296 / ruolo SQL del processo Render: probe su staging (29 ottobre 2026)

> **AGGIORNAMENTO FASE P — SUPERATO E DISABILITATO (29/10/2026).** Questo
> documento descrive lo storico progetto di un probe dopo l'avvio del web
> server. Tale approccio è stato **rimosso** dalla PR Draft #374: avviare
> `api/server.js` inizializzava comunque Firebase Admin, audit manager,
> performance optimizer e possibili job nonostante la deny-list. Ora
> `api/index.js` **rifiuta entrambi i marker diagnostici**, mentre
> `api/scripts/attest-gdpr-render-staging-isolated.js` è un programma CLI
> separato, da invocare esclusivamente in un contesto isolato e autorizzato.
> La CLI osserva una **nuova** sessione configurata per lo staging, **non**
> la connessione dell'app Render già in esecuzione. Vedere
> `api/docs/gdpr-render-isolated-cli-handoff-20261029.md`.
> Le descrizioni in-process riportate sotto sono **storiche**, non operative.
> Nessun deploy o probe provider eseguito; `GH-296 OPEN / NO-GO`.



**Stato: SOLO CODICE IN PR DRAFT #374. Nessuna attivazione su Render, nessun nuovo deploy o credenziale, nessuna interrogazione SQL live. GH-296 OPEN / NO-GO.**

## Perché serve

Le query `current_user` e `session_user` eseguite nella Supabase Management API identificano la sessione della Management API, **non** il pool SQL già esistente nel processo `demos-backend`. Anche `pg_stat_activity` e i log di uno staging indipendente sono indizi, non attribuzioni univoche alla connessione del runtime live. Per questo è predisposto un **probe dentro il medesimo processo Node del backend**, con `getPool()` dal modulo canonico.

Il probe **non è una chiusura del data-plane**: non impedisce l'accesso a PostgreSQL, Supavisor, PostgREST, Auth, Storage, script o altri processi. Non autorizza restore, modifica di grant, GO, cancellazioni, operazioni B2 o nuove credenziali.

## Implementazione, disabilitata per impostazione predefinita

- `api/index.js` (**nuova barriera pre-avvio**): se `GDPR_RENDER_INPROCESS_ATTESTATION` è presente, esegue `assertProcessTarget(process.env)` **prima** di importare `api/server.js` e quindi prima di inizializzare app, route, job e pool. Su servizio/DB/marker errati il processo abortisce con il solo codice `GDPR_RENDER_STAGING_PREFLIGHT_REFUSED`, senza stampare URI o password. Senza marker, avvio normale senza nuova verifica.
- `api/server.js`: dopo l'avvio consentito, richiama il probe una sola volta, dopo l'evento `listening`. Non pubblica endpoint HTTP.
- `api/services/gdprRenderInProcessStagingAttestation.js`: controlla il contesto **prima** di ottenere un pool o effettuare una connessione. Per un'esecuzione valida esige `RENDER=true`, `NODE_ENV=production`, `RENDER_SERVICE_ID=srv-db52l1g473hc739ld250` (servizio esistente `demos-functional-staging`), `GDPR_RENDER_INPROCESS_ATTESTATION=demos-staging-inprocess-readonly-20261029` e `GDPR_WRITER_ATTESTATION=demos-staging-readonly-20261027`.
- `api/scripts/attest-gdpr-writer-readonly.js` fornisce l'ulteriore guardia già testata del **target Demos-Staging**, ref `fkeayjzvtuvzesljhjbc`, con URI PostgreSQL diretto o Supavisor in `eu-central-1`, porta e `sslmode=require` obbligatori; target diverso, downgrade TLS, URI con parametri non previsti o configurazione errata: **nessuna connessione viene effettuata**.
- Una volta ammessa l'operazione, il probe acquisisce **una sola** sessione dal `getPool()` usato dal processo, esegue la sola SELECT di identità e catalogo RLS/privilegi esistente nella CLI staging, rilascia il client in `finally` e produce **una sola riga JSON di audit** con prefisso `GDPR_RENDER_STAGING_POOL_IDENTITY`. Errori SQL, stack, URI, password e token **non vengono riportati**. I campi di esito includono `in_process_staging_session_observed`, `live_production_pool_verified:false`, `scope:ONE_CANONICAL_POOL_SESSION_NOT_ALL_CONNECTIONS` e `recoveryReady:false`.
- L'acquisizione di una sessione prova al massimo quale ruolo è stato usato da **quella sessione in quel momento** nello staging. Non dimostra che ogni worker/thread/script usi la stessa identità o che il processo Render **di produzione** ne utilizzi una uguale. Non confondere lo `sql_writer_attested:true` riportato dalla CLI con un'affermazione di effettiva possibilità di scrittura nel ledger.

## Test disponibili nel repository

`api/tests/gdprRenderInProcessStagingAttestation.test.js` simula il client del pool senza rete né database esterni e verifica:

1. Il gate di servizio Render, progetto Supabase, marker operatore e TLS **rifiuta** produzione, servizi diversi, host arbitrari e downgrade.
2. Il rifiuto avviene **prima** dell'ottenimento del pool; non effettua nemmeno una chiamata al mock di `getPool`.
3. Una SELECT in un singolo client della pool canonica restituisce l'identità artificiale, rilascia sempre la sessione e non segnala mai `GO`.
4. Ledger assente, query fallita, errore contenente URI fittizio e utenze errate generano output fail-closed e non divulgano segreti.
5. `api/server.js` usa `getPool()` del processo e non pubblica nuovi endpoint diagnostici.

La suite è richiamata dal workflow già esistente `.github/workflows/gdpr-b2-worker-retry-isolated-ci.yml`, **senza contatto con Supabase, Render o B2**.

## Evidenze di preflight connesso, read-only (29 ottobre 2026)

- Il servizio Render esistente **demos-functional-staging** (ID `srv-db52l1g473hc739ld250`) è su branch **`staging/functional-integration-v0`**, `autoDeploy=no`, comando `cd api && node index.js`; ultimo deploy **live** visibile su commit **`645d72d37b9178233b7f66c7433cb90e51bf585c`**, datato 15 ottobre 2026. **Non è il branch né il codice della PR Draft #374.** Il solo trigger redeploy non potrebbe eseguire il probe nuovo.
- Il ramo staging carica **`api/scripts/stagingBoot.js`** prima di `api/server.js`, con un proprio gate `DEMOS_STAGING_MIGRATION_MODE`. La precondizione ambientale `NODE_ENV=production` per il probe **non è stata verificata** nell'istanza Render e non deve essere cambiata ciecamente: un mismatch blocca il test.
- I tool Render disponibili permettono di leggere metadati, log e deploy, ma **non** elencano/verificano in modo sicuro gli effettivi `DATABASE_URL` e tutti i segreti esterni di uno staging. Non possiamo attestare che tutti i job, i servizi Firebase, le API e gli altri ingressi siano separati da produzione. **Il fatto che il servizio si chiami staging non prova il corretto isolamento.**
- Una query **solo catalogo** sulla Supabase Management API del progetto **Demos-Staging** ha rilevato `public.privacy_erasure_ledger` esistente con `relrowsecurity=true`. Il ruolo `postgres` restituito per `current_user` è il ruolo della connessione **Management SQL**, **non** il writer Render staging. Non sono stati letti record dell'utente né eseguite DML/DDL.

**Esito preflight:** `NO_GO_STAGING_PROBE_NOT_DEPLOYABLE_YET`. Prima di una prova reale serve una derivazione di codice e configurazione di staging controllata, conservando e rivedendo il suo `stagingBoot` e verificando **tutte** le destinazioni esterne, non soltanto il database. Non aggiornare il ramo di staging o rilanciare il servizio solo per vedere se il probe parte: senza questa verifica si rischiano processi di staging collegati a produzione.

## Verifiche offline aggiunte

La suite `api/tests/gdprRenderInProcessStagingAttestation.test.js` esegue anche il contenuto reale di `api/index.js` in una sandbox VM con `require('./server')` sostituito da uno stub, verificando che in caso di marker errato, Render production, target SQL production o `NODE_ENV=staging` **il server non venga mai importato/avviato**. Il test non costruisce pool, non chiama provider e non tocca dati reali.

## Fase O — audit statico del ramo staging e disabilitazione modalità attive (29/10/2026)

Un audit di sola lettura del ramo Render `staging/functional-integration-v0` ha rilevato che lo staging NON è una semplice copia della PR Draft:

- `api/index.js` carica `stagingBoot` **prima** di `server`. Il flag `DEMOS_STAGING_MIGRATION_MODE` abilita `baseline`, `preflight`, `apply` e `e2e-seed`, con gate `NODE_ENV=staging`. `api/scripts/stagingMigrate.js` impone un database **`demos_civic_staging_db`**, mentre il progetto Supabase Demos-Staging già verificato con SELECT ha database **`postgres`** e il probe accetta `/postgres` e `NODE_ENV=production`. I due percorsi **non sono intercambiabili**. Qualunque prova reale deve evitare di attivare la migrazione.
- Nel `server.js` staging esistono nove variabili `DEMOS_STAGING_*_E2E` che possono avviare test attivi dopo il listener.
- Nel `app.js` staging esistono dieci switch di job `ENABLE_*` e `AXIOM_ARCHIVE_ENABLED`: retention, violazioni, backup legacy, sincronizzazioni Ministero/civic process/territori/unità elettorali/voti/Openpolis, archiviazione Axiom->B2. Alcuni job possono eseguire scritture o chiamare provider esterni.
- Lo staging esegue anche `initializeFirebaseAdmin` da `server.js` e avvia `auditManager` e `performanceOptimizer` all'import di `app.js`, senza un'unica guardia per il solo probe. **Né l'identità Firebase né i provider esterni né ogni SQL client sono certificati come isolati** dalla sola lettura dei sorgenti.

Nel servizio Draft `gdprRenderInProcessStagingAttestation.js` sono state aggiunte guardie fail-closed: prima di caricare app/server, il probe rifiuta `DEMOS_STAGING_MIGRATION_MODE` quando non vuoto, ciascuna delle nove modalità E2E a `true` e ciascuno dei dieci job/archivi a `true`. Queste guardie **non disabilitano** automaticamente Firebase, auditManager, performanceOptimizer o funzioni non conosciute e **non sono un cut-off del data-plane**.

### Audit di drift nella CI

La PR Draft include `api/tests/gdprStagingBootSourceAudit.test.js`. Il workflow `gdpr-b2-worker-retry-isolated-ci.yml` esegue un `git fetch` **read-only** del branch esistente `staging/functional-integration-v0` e usa `git show` per ispezionarne `index.js`, `stagingBoot.js`, `stagingMigrate.js`, `server.js` e `app.js`, senza eseguirli. Le verifiche assicurano che:

1. Il percorso delle migrazioni sia ancora riconoscibile, separato, con `NODE_ENV=staging` e database `demos_civic_staging_db`.
2. **Tutti** i nove flag E2E e i dieci switch dei job nel ramo staging siano rappresentati nelle deny-list del probe Draft; nuovi flag su quel ramo rendono il test rosso e richiedono una nuova revisione.
3. L'entrypoint di staging non contenga ancora il nuovo probe, per impedire di dichiararlo installato quando è solo nel Draft.
4. La verifica scriva esclusivamente un risultato di **NO-GO**: non legge segreti e non prova l'effettivo isolamento sul provider.

**Attenzione:** l'audit rileva la deriva di questi percorsi espliciti, non può inventariare tutti i processi remoti o dimostrare che il deploy live coincida con il ramo corrente. Il servizio Render non è stato modificato. Per ottenere una vera prova isolata occorre prima una progettazione di staging che separi *tutti* i side-effect d'avvio e verifichi esternamente ogni destinazione/credenziale.

## Decisione successiva, non autorizzata da questa PR

Se si vorrà produrre una **prova reale** su `demos-functional-staging`, occorrerà autorizzare **separatamente**: verifica dell'effettivo avvio da branch/commit isolato e dell'assenza di connessioni/worker di produzione, un deploy controllato soltanto dello staging già esistente, configurazione fuori banda dei due marker e dell'URL di connessione staging con credenziali minime, lettura di un unico output sanitario e successiva rimozione dei marker. La PR Draft non introduce né effettua questi passi e non fa uso delle credenziali di alcun provider.

**Per chiudere GH-296 servono comunque** un cut-off reale e indipendente che neghi tutte le superfici SQL e HTTPS anche con vecchie sessioni e ruoli, un restore completamente isolato con journal Backblaze B2 e prova di replay durevole, più le verifiche DPO/DPIA e RP-10/F5-17. `GH-296 = NO-GO`.
