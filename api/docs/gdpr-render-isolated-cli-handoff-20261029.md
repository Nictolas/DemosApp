# DEMOS — GH-296 / Fase P: isolamento totale della CLI SQL staging (29 ottobre 2026)

**Stato:** SOLO codice in PR Draft #374. **NON eseguito** su Render o Supabase reali; nessun nuovo servizio, deploy, job, connessione con credenziali reali, modifica di environment, database, backup, token, storage, utenti o provider. `GH-296 OPEN / NO-GO`, `recoveryReady:false`.

## Problema reale corretto

La precedente Fase M preparava un controllo `attestInProcess()` dopo `server.listen`. La Fase O ha dimostrato che `api/app.js` e `api/server.js` inizializzano comunque Firebase Admin, audit manager, performance optimizer e possibili worker/route anche quando i 9 E2E e 10 flag dei job sono disabilitati. **Una verifica SQL dopo l'avvio dell'app non può essere definita read-only nei confronti di tutti i provider.**

Il codice è stato modificato così:

1. `api/server.js`: **rimosso** ogni richiamo a `attestInProcess`. Il normale avvio web non esegue la diagnostica GDPR.
2. `api/index.js`: per prevenire errori operativi **rifiuta** la presenza di entrambi i marker `GDPR_RENDER_INPROCESS_ATTESTATION` e `GDPR_RENDER_SQL_CLI_ONLY`, senza importare `server.js`, `app.js`, Firebase o worker. Senza marker, l'app parte esattamente come prima.
3. `api/scripts/attest-gdpr-render-staging-isolated.js`: comando **CLI separato e one-shot**, che carica esclusivamente i due moduli puri di convalida, `pg`/configurazione TLS canonica (questi ultimi solo **dopo** preflight superato), e una connessione SQL del pool. Nessun listener HTTP, nessun import di `index`, `server`, `app`, Firebase, sincronizzazioni o migrazioni. Esegue il **singolo** `SELECT` già usato nella CLI staging, rilascia la connessione e chiude il pool, con output di sola identità/catalogo senza dati degli utenti. Errori non riportano URI, password, token o stack. Il codice di uscita resta diverso da zero anche dopo una query riuscita perché questa non equivale a GO.
4. È richiesto un **terzo marker** `GDPR_RENDER_SQL_CLI_ONLY=demos-staging-isolated-cli-readonly-20261029`, oltre ai due marker originali. Il servizio deve essere esattamente `demos-functional-staging` (Render ID `srv-db52l1g473hc739ld250`), `RENDER=true`, `NODE_ENV=production` e `DATABASE_URL` del progetto separato Supabase **Demos-Staging** (`fkeayjzvtuvzesljhjbc`, database `postgres`, TLS richiesto). Tutte le migrazioni `DEMOS_STAGING_MIGRATION_MODE`, 9 trigger E2E e 10 job di background devono essere inattivi. Target/marcatori errati => **nessun caricamento del driver del database o SQL**.

## Semantica della prova: cosa può e non può dimostrare

Una esecuzione futura, se autorizzata su un ambiente davvero isolato con gli stessi parametri di staging, permetterebbe di osservare il ruolo `current_user/session_user` **di una nuova connessione CLI**. Il report indica:

- `execution: ISOLATED_CLI_NOT_RUNNING_BACKEND`
- `isolated_cli_staging_session_observed: true|false`
- `in_process_staging_session_observed: false`
- `least_privilege_catalog_match: true|false` (**soltanto** per la sessione CLI)
- `sql_writer_attested: false`
- `live_render_pool_verified: false`
- `live_production_pool_verified: false`
- `recoveryReady: false`

Il nuovo controllo confronta `current_user` e `session_user` con il solo ruolo previsto **`demos_staging_runtime`**; richiede assenza di BYPASSRLS, owner non privilegiato, RLS+FORCE e ACL minime del ledger. Con `postgres`, `supabase_admin`, `service_role`, un worker read-only o grant inattesi il report è `NO_GO_STAGING_SQL_ROLE_OR_LEDGER_PRIVILEGES_MISMATCH`, anche se la SELECT ha avuto successo. La corrispondenza produce soltanto `READONLY_EXPECTED_STAGING_ROLE_NOT_RUNTIME` e mantiene `recoveryReady:false`. Evidenza di catalogo staging: `api/docs/gdpr-staging-ledger-live-catalog-audit-20261029.md`.

Non attribuire mai il ruolo della CLI alle connessioni già aperte nell'app web, né al servizio `demos-backend` di produzione. **La prova del ruolo delle connessioni del backend Render live resta ancora mancante.** I metadati catalogo/RLS non provano che si possano salvare o cancellare dati attraverso gli ingressi consentiti; non provano la revoca di sessioni precedenti.

## Vincoli per una eventuale prova esterna

- **NON** aggiungere i marker all'environment del servizio web e **NON** utilizzare `trigger_deploy` del servizio per eseguire il programma: il web si rifiuterebbe di avviarsi oppure il processo one-shot non risponderebbe ai controlli HTTP, interrompendo il servizio.
- Per una prova futura serve una modalità **indipendente, effettivamente supportata e autorizzata** di eseguire il comando one-shot nel perimetro dello staging (eventuale shell/exec disponibile o processo isolato approvato), con configurazione e secrets verificati, senza creare servizi a pagamento e senza toccare Render di produzione. I connettori Render attualmente disponibili in questa chat **non hanno un'azione di shell/exec** e non è stato autorizzato un nuovo job/servizio: il passo reale è quindi bloccato.
- Prima di qualsiasi esecuzione, verificare indipendentemente il reale isolamento dei secret SQL, Supavisor, Supabase HTTPS, Firebase Admin, Axiom e B2, mantenendo il gate `stagingBoot` separato. Nessun `NODE_ENV` modificato in modo cieco e nessuna migrazione.
- `api/tests/gdprRenderIsolatedStagingCli.test.js` usa pool SQL **fittizio** e verifica rifiuti pre-import, assenza di listener/provider, singola SELECT, nessun log dei secrets, shutdown e report sempre NO-GO; `api/tests/gdprRenderInProcessStagingAttestation.test.js` verifica che l'avvio web rifiuti i marker.

## Che cosa resta a GH-296

Per un ripristino reale restano necessari un taglio esterno verificato del data-plane su PostgreSQL diretto/Supavisor **e** sulle API HTTPS PostgREST/Auth/Storage/Realtime, compresi writer estranei, ruoli privilegiati e sessioni pregresse; isolamento credenziali/snapshot, evidenza duratura di journal Backblaze B2 con replay e autorizzazioni DPO/DPIA, RP-10/F5-17. Tutti questi vincoli rimangono **NO-GO**. Il nuovo comando è una riduzione del rischio diagnostico, non un passo eseguito su provider né una soluzione di recovery.
