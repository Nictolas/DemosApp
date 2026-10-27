# DEMOS — staging unificato: controllo di avvio isolato (Draft, 27 ottobre 2026)

## Scopo e confini

Questa modifica introduce un **preflight sincrono e senza rete** destinato
esclusivamente al futuro staging funzionale. È basata sul `main` corrente,
non sul vecchio ramo Render `staging/functional-integration-v0`.
Non configura, provisiona, migra, prova o modifica alcun database Render,
Supabase, B2 o servizio di produzione. Il recovery GDPR #296 resta **NO-GO**.

**Non avviare la nuova entrypoint su Render** finché le condizioni sottostanti
non sono state verificate e il relativo cambiamento infrastrutturale
separatamente autorizzato. Il test in GitHub Actions usa solo URL, ruoli
e credenziali **fittizi**; non apre connessioni esterne.

## Avvio previsto, soltanto dopo approvazione operativa

L'eventuale servizio da riutilizzare è Render `demos-functional-staging`
(`srv-db52l1g473hc739ld250`), mantenendo **lo stesso servizio** ma non
il ramo storico. La futura revisione dovrà partire dal codice aggiornato e
usare esplicitamente `cd api && node staging/isolatedStagingServer.js`.
Il comando di produzione `node index.js` non viene modificato da questa PR.

Prima dell'avvio è necessario predisporre, con atti separatamente approvati:

- `NODE_ENV=production` per bloccare le route API di sviluppo/migrazione;
  `DEMOS_DEPLOYMENT_SCOPE=isolated-staging` e
  `DEMOS_STAGING_PROJECT_ID=fkeayjzvtuvzesljhjbc`.
- `DEMOS_STAGING_CONFIRMATION=synthetic-only-no-prod-providers`.
  Il valore **non è un token di sicurezza**: è soltanto un opt-in esplicito.
- `DATABASE_URL` verso **Demos-Staging** su endpoint Supabase diretto
  `db.<id>.supabase.co:5432/postgres` con ruolo
  `demos_staging_runtime`, oppure pooler di Frankfurt `aws-N-eu-central-1.pooler.supabase.com`
  e username `demos_staging_runtime.<id>`, con `<id>` uguale esattamente
  al progetto staging. La password va custodita **soltanto nel provider**.
  Nessuna connessione o credenziale di produzione può essere riutilizzata.
- `DATABASE_POOL_MAX=2` (mai oltre 5);
  `DATABASE_POOL_MIN=0`;
  `PERFORMANCE_MONITOR_ENABLED=false`;
  `ALLOW_DEV_API_SURFACE=false`.
- Nessuna variabile aggiuntiva con token per Firebase/FCM, Axiom, B2,
  Supabase API, SMTP, Redis, JWT, Google o altri provider. Il nuovo guard
  usa una **allowlist stretta** anche per chiavi env non sensibili. Nuove
  chiavi (comprese quelle injected da Render) richiedono review esplicita:
  la mancata inclusione blocca l'avvio, non dà diritto a eludere il guard.

Il pooler è condiviso fra progetti Supabase: controllare **sia**
il nome utente qualificato dal project reference, **sia** la destinazione
DNS. L'URI deve avere database `postgres`, host ammesso, password presente,
porta 5432/6543 adeguata e nessun `options`, `search_path` o parametro
di instradamento non previsto. Il processo non registra URI, password o
username, nemmeno in caso di errore.

Il controllo parte prima di qualunque importazione di route/pool Firebase
nel wrapper e viene **ripetuto all'inizio di `api/app.js` dopo dotenv**,
per rifiutare eventuali segreti caricati da un file locale. In modalità
`isolated-staging`, `app.js` evita di lanciare
`auditManager.start()`, `performanceMonitor.start()` e
`performanceOptimizer.start()`. Anche `api/server.js` evita
esplicitamente di inizializzare Firebase Admin in questo modo.
Ogni `ENABLE_*` sconosciuto viene
rifiutato dall'allowlist; i job espliciti non devono essere abilitati.

## Condizioni ancora NON soddisfatte

1. **Schema**: `Demos-Staging` attualmente ha zero tabelle `public`
   e soltanto le quattro tabelle sintetiche sotto `op37_sondaggi_ci`.
   Il ruolo `demos_staging_runtime` non è stato attestato né creato;
   i test accettano solo la *forma* del relativo login. Non lanciare
   migrazioni con il ruolo runtime. Richiede una procedura DDL separata,
   un bootstrap minimo con dati sintetici e ledger protetto con RLS/ACL.
2. **Isolamento esterno**: la validazione di URL/env non prova da sola
   isolamento della rete, degli altri worker/cron, dei webhook,
   dell'ingress Render pubblico, dei bucket/provider Axiom/B2,
   delle notifiche push o delle route che chiamano servizi senza
   credenziali. Servono inventario e attestazione di provider, egress
   e allowlist ingress prima di qualunque deploy.
3. **Identità SQL effettiva**: dopo il provisioning e solo nel nuovo
   staging isolato, testare attraverso **lo stesso pool del backend**
   `current_user`, `session_user`, `current_database()`,
   RLS e privilegi di tabella/colonna, con query ai soli cataloghi e
   senza righe utente. Non inferire il writer dal SQL Editor Supabase.
4. **Codice**: il vecchio ramo `staging/functional-integration-v0` è
   divergente; non riutilizzarne ciecamente bootstrap e migrations, che
   ammettono il solo database `demos_civic_staging_db` (Render).
   Questa PR non modifica il vecchio ramo, non cambia `DATABASE_URL`
   e non dichiara il backend di staging pronto alle prove E2E.
5. **Rilascio**: rivedere la diff della PR e la CI sull'HEAD.
   Un eventuale merge su `main` può attivare un auto-deploy Render
   anche se il guard resta inattivo in produzione. Richiede il consenso
   **specifico** al merge e un piano di verifica. L'attivazione su staging
   richiede **un'altra autorizzazione**, con dettagli di servizio, ramo,
   runtime, destinatario DB, job disabilitati, rollback e criteri GO/NO-GO.

## Invarianti verificati nei test sintetici

- Un URL pooler verso produzione o altro progetto/ruolo, una destinazione
  diretta errata, un parametro d'override o password mancante ⇒ **reject**.
- Env con credenziali provider, `JWT_SECRET`, `ENABLE_*`,
  `DATABASE_POOL_MAX` troppo alto o debug endpoint abilitati ⇒ **reject**.
- Un preflight negativo non esegue `require('../server')`, né connessioni.
- Il ramo normale di produzione non viene alterato da questa protezione
  senza la selezione esplicita `isolated-staging`.

**Non considerare questi test prova di isolamento reale.**
Nessun merge, DDL/GRANT, scrittura su Supabase, cambio Render, secret read,
ripristino o dismissione di staging è incluso nella presente modifica.
