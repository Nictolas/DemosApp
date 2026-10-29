# DEMOS — GH-296 / ruolo SQL del processo Render: probe su staging (29 ottobre 2026)

**Stato: SOLO CODICE IN PR DRAFT #374. Nessuna attivazione su Render, nessun nuovo deploy o credenziale, nessuna interrogazione SQL live. GH-296 OPEN / NO-GO.**

## Perché serve

Le query `current_user` e `session_user` eseguite nella Supabase Management API identificano la sessione della Management API, **non** il pool SQL già esistente nel processo `demos-backend`. Anche `pg_stat_activity` e i log di uno staging indipendente sono indizi, non attribuzioni univoche alla connessione del runtime live. Per questo è predisposto un **probe dentro il medesimo processo Node del backend**, con `getPool()` dal modulo canonico.

Il probe **non è una chiusura del data-plane**: non impedisce l'accesso a PostgreSQL, Supavisor, PostgREST, Auth, Storage, script o altri processi. Non autorizza restore, modifica di grant, GO, cancellazioni, operazioni B2 o nuove credenziali.

## Implementazione, disabilitata per impostazione predefinita

- `api/server.js`: attiva il codice soltanto se `GDPR_RENDER_INPROCESS_ATTESTATION` è **presente** e lo richiama **una sola volta, dopo l'evento `listening`**. Senza variabile, nessun import del servizio e nessuna query di attestazione; non esiste un endpoint HTTP.
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

## Decisione successiva, non autorizzata da questa PR

Se si vorrà produrre una **prova reale** su `demos-functional-staging`, occorrerà autorizzare **separatamente**: verifica dell'effettivo avvio da branch/commit isolato e dell'assenza di connessioni/worker di produzione, un deploy controllato soltanto dello staging già esistente, configurazione fuori banda dei due marker e dell'URL di connessione staging con credenziali minime, lettura di un unico output sanitario e successiva rimozione dei marker. La PR Draft non introduce né effettua questi passi e non fa uso delle credenziali di alcun provider.

**Per chiudere GH-296 servono comunque** un cut-off reale e indipendente che neghi tutte le superfici SQL e HTTPS anche con vecchie sessioni e ruoli, un restore completamente isolato con journal Backblaze B2 e prova di replay durevole, più le verifiche DPO/DPIA e RP-10/F5-17. `GH-296 = NO-GO`.
