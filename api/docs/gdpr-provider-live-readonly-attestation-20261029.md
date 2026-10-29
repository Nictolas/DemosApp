# DEMOS — GH-296 / attestazione parziale dei percorsi dati sui provider (29 ottobre 2026)

**Ambito rigoroso:** ispezione collegata in **sola lettura** del metadata Render, dei progetti Supabase e dei cataloghi SQL PostgreSQL di **Demos**. Non sono stati consultati record personali, segreti, valori di variabili d'ambiente, token, dump o backup; nessuna impostazione/proprietà di produzione o staging è stata modificata. La connessione SQL dell'editor Management API non coincide necessariamente con quella del backend Render.

## Inventario direttamente verificato

| Componente | Osservazione verificata | Implicazione e limite |
| --- | --- | --- |
| Supabase progetto **Demos** | Stato `ACTIVE_HEALTHY`, PostgreSQL 17, regione `eu-central-1` | Backend dati produzione confermato; **non** certifica regole di network isolation, accesso tramite pooler o Data API |
| Supabase **Demos-Staging** | Progetto diverso, `ACTIVE_HEALTHY`, PostgreSQL 17 | Ambiente separato esistente; nessun restore, creazione di branch o nuovo provisioning |
| Supabase **DemosReplit** | Altro progetto, stato `INACTIVE` | Non assumere che sia l'archivio corrente o che sia collegato al runtime |
| Supabase Edge Functions del progetto Demos | La lista restituita dalla Management API è vuota | Nessuna Edge Function distribuita è emersa; non esclude cron SQL, trigger, webhooks, REST/RPC, pooler o altri client |
| Render **demos-backend** | Web service su `main`, avvio `node index.js` nella cartella `api`, una istanza configurata, plan free, `autoDeploy=yes` | Qualsiasi merge effettivamente pubblicato su `main` può innescare deploy: mantenere le PR Draft. L'istanza/il piano non attestano l'effettiva identità del ruolo DB |
| Render **demos-frontend** | Static site su `main`, `autoDeploy=yes` | Non è un proxy che blocca per sé gli accessi diretti alla Data API |
| Render altri servizi DEMOS | Presenti diversi servizi di staging/readonly/sandbox, con deploy automatico disattivato nelle relative schede | Servono verifica separata degli eventuali pool, processi e token; il nome `readonly` o `staging` non è prova di assenza di privilegi o dati di produzione |

### Identità e sessioni SQL (fotografia, NON censimento esaustivo)

Una query `SELECT` con l'app collegata Supabase sul **progetto produzione** ha riportato `current_user=postgres` e `session_user=postgres`: **questa è soltanto l'identità della connessione Management API**. Non dimostra che l'API DEMOS/Render usi un ruolo sicuro, né che usi proprio `postgres`.

Una fotografia `pg_stat_activity` **aggregata senza query/indirizzi/valori di dati** ha osservato sei sessioni client, tra cui:
- PostgREST: **2**, ruolo `authenticator`.
- Supavisor: **1**, ruolo `postgres`; Supavisor auth query: **1**, ruolo `pgbouncer`.
- Altre **2**: connessione `mgmt-api` della query corrente e monitoraggio/amministrazione Supabase.

È **un singolo istante**, non campionamento continuo, non prova di assenza di client Render, né attestazione di tutte le sessioni/porte. Le sessioni possono aprirsi e chiudersi tra osservazioni.

### Superficie SQL e HTTP

- Cataloghi di produzione `pg_class`: `public.users` e `public.privacy_erasure_ledger` sono tabelle reali con RLS attiva; `FORCE ROW LEVEL SECURITY` non risulta attivato. Il nome `public.privacy_erasure_delivery_outbox` **non è emerso sotto `public` in questa specifica verifica**; ciò non dimostra assenza dell'outbox da altri schemi.
- Cataloghi di grants delle **due tabelle**: `anon`, `authenticated` e `service_role` non risultavano disporre di privilegi diretti `SELECT/INSERT/UPDATE/DELETE` sulle due relazioni esaminate. Questo **non prova** il blocco universale di Data API/RPC, viste, funzioni o grants di altri ruoli. `service_role` ha attributo `BYPASSRLS`, pur non disponendo dei grants diretti suddetti.
- Il ruolo amministrativo `postgres` ha attributo `BYPASSRLS` e privilegi DML su entrambe le tabelle: è una via privilegiata che **deve essere esclusa dall'accesso runtime durante il ripristino**, indipendentemente dalle policy RLS.
- Nel solo schema `public`, il catalogo elenca **76 funzioni**, **0 `SECURITY DEFINER`**. È un controllo circoscritto: non prova l'assenza di RPC `SECURITY INVOKER` con effetti, funzioni in altri schemi, cron o trigger.
- Le [network restrictions di Supabase](https://supabase.com/docs/guides/platform/network-restrictions) sono documentate come protezione delle **connessioni PostgreSQL dirette e pooler**, ma **non** delle API HTTPS PostgREST/Data API, Storage e Auth. Un isolamento basato solo sulle restrizioni IP del database **non** soddisfa il requisito di GH-296.
- La [Data API Supabase](https://supabase.com/docs/guides/api) costituisce un percorso HTTP autonomo. Occorre verificare il controllo di accesso per ogni schema/ruolo/grant/RPC e imporre una quarantena che copra anche questa superficie.

### Collegamento con il codice distribuito

La scheda del deploy Render più recente verificata indicava il backend `LIVE` sul commit `572010d2a28ac79c60665b753e2bd5aceb55750d` (29/10). Nel file `api/app.js` di **quel commit live**, `app.use('/api', databaseRoutes)` è **ancora incondizionato**: la diagnostica `GET /check-table-structure` è dunque montata **a livello di codice distribuito**, non necessariamente utilizzata. La successiva correzione che rende il mount non-production è presente **soltanto nella PR Draft #374**, non nel deploy osservato.

Il file `api/scripts/attest-gdpr-writer-readonly.js` già presente nel Draft #374 è **limitato esplicitamente a Demos-Staging**, richiede un marker approvato ed esegue una query `SELECT`. Anche se eseguito manualmente con target staging, **non attesta l'identità della connessione già aperta nel processo Render produzione**. Non l'abbiamo eseguito in questa verifica.

## Gate ancora bloccanti — non derivare nessun GO dai dati osservati

1. **Identità runtime reale:** attestare da dentro il processo Render live, con autorizzazione separata e senza segreti, `current_user`, `session_user`, `role`, host di destinazione verificato, pooler usato e privilegi effettivi. Nessuna query tramite Management API è sostitutiva.
2. **Inventario completo:** identificare job, worker, importatori, ruoli privilegiati, Supavisor, pool diretti, HTTP Data API, RPC, Storage/Auth/trigger e sessioni fuori dalla semplice vista temporanea. Non assumere assenza di processi se `pg_stat_activity` non li mostra.
3. **Cut-off esterno e fail-closed:** ottenere prova provider di un isolamento che prevalga sulle **vecchie credenziali, i pool già aperti e il backup SQL** e blocchi **sia PostgreSQL/pooler sia HTTPS Data API**; misurare zero accessi e fallimento delle connessioni da ogni percorso, **senza disattivare servizi in produzione durante questa analisi**.
4. **Restore isolato e B2:** testare con approval separata restore sintetico/PITR, journal esterno completo, epoch/witness durevoli e riconciliazione delle operazioni incertamente committate.
5. **Privacy e costi:** staging gratuito, nessuna nuova infrastruttura/costo senza consenso, RP-10/F5-17 e DPIA/DPO prima di qualunque rilascio.

**Risultato:** vie PostgREST e Supavisor effettivamente osservate; assenza di Edge Functions distribuite rilevata; ruolo di gestione SQL separato e non attestante Render; mitigazione diagnostica ancora non rilasciata. Il controllo indipendente del data-plane non è stato eseguito. **GH-296 resta OPEN, NO-GO e `recoveryReady:false`.**

### Evidenze e tracciabilità

Fonte: metadati Render (`demos-backend`, `demos-frontend`, servizi staging e deploy live) e Supabase collegati, query esclusivamente `SELECT` su `pg_stat_activity`, `pg_class`, `pg_roles`, `pg_proc` e `has_table_privilege`. I risultati sono riassunti per minimizzazione e non contengono credenziali, host di connessione privata, IP o righe utente. Ultimo confronto codice: commit live Render `572010d2a28ac79c60665b753e2bd5aceb55750d` vs PR Draft #374. I link alla dashboard interna del progetto restano nell'account del titolare.


## Appendice Fase J — collegamento storico OP37 e diagnostica SQL legacy

**Controllo diretto, in sola lettura, effettuato il 29 ottobre 2026.** Sono stati letti i log Render esistenti, il codice di `api/staging/op37_render_http_probe.js`, e il catalogo privilegi/sessioni del progetto separato **Demos-Staging**. Nessun SQL DDL/DML, richiesta con dati personali, deploy, modifica di ruolo o creazione risorse.

- Nel servizio Render `demos-sondaggi-op37-http-staging` compare la riga `OP37_RENDER_STAGING_HTTP_PASS` alle **2026-10-24 21:09:24 UTC**, con 12 campioni per livello e 3 query a richiesta. Dal codice relativo al probe risulta che il log di successo può essere prodotto solo dopo aver eseguito `SELECT current_database(), current_user, current_setting('server_version_num')` attraverso **il suo pool di processo**, aver verificato `current_user === op37_http_staging_reader` e la versione PostgreSQL 17, ed effettuato letture **su schema sintetico**. È una prova storica più forte del solo `pg_stat_activity`, **limitata al servizio OP37 e a quel run**; non attesta il processo principale Render `demos-backend`.
- La schermata deploy Render mostrava un deploy di quel servizio con esito `live` del **24 ottobre 21:11 UTC**, successivo al log PASS, e nel periodo successivo log `OP37_RENDER_SETUP_ONLY_NO_DATABASE`. Quindi **non affermare che il servizio correntemente in esecuzione usi ancora il pool verificato**: la prova si riferisce alla precedente esecuzione e non alla nuova modalità setup-only.
- Il catalogo ruoli corrente su **Demos-Staging** indica `op37_http_staging_reader`: `rolcanlogin=false`, `rolbypassrls=false`, `rolsuper=false`. Si tratta di un controllo **posteriore** al PASS, non della prova che il ruolo fosse non-login mentre la connessione del 24 ottobre veniva aperta.
- Per le tabelle esaminate il ruolo conserva **sola SELECT** su `op37_sondaggi_ci.users`, `op37_sondaggi_ci.opinioni_domande` e `op37_sondaggi_ci.opinioni_risposte`; nessun privilegio SELECT/INSERT/UPDATE/DELETE rilevato su `public.users`, `public.opinioni_risposte`, `public.privacy_erasure_ledger`. Questo non prova l'assenza di privilegi su ogni possibile funzione o tabella non censita.
- `pg_stat_activity` su Demos-Staging in una fotografia non mostra sessioni di quel ruolo; sono presenti connessioni dei servizi Supabase. **Una fotografia non prova zero sessioni nel tempo, né assenza di credenziali altrove.**
- Audit ulteriore sul codice: `api/routes/health.js` rende disponibile una diagnostica `GET /api/test-db` che invoca `getPool()` e `SELECT NOW()`. Nella **sola PR Draft #374**, il route handler è ora registrato esclusivamente fuori da `NODE_ENV=production`; anche `ALLOW_DEV_API_SURFACE=true` non lo rimonta. La suite `api/tests/gdprLegacyHealthDbDiagnosticIsolated.test.js` usa Express/HTTP localhost e un pool completamente finto per verificare che in produzione l'endpoint sia 404 **senza alcuna chiamata al pool**, mantenendo `/api/health`. Nessuna modifica è distribuita sulla versione live.

**Conclusione Fase J:** il successo del probe OP37 attesta storicamente la **sua** identità SQL staging e la segregazione del dataset sintetico, ma manca la prova dell'identità del processo Render principale o del servizio `demos-functional-staging`. Il ruolo di gestione Supabase non sostituisce l'identità del pool nell'app. GH-296 rimane **OPEN / NO-GO**; la protezione effettiva del recovery richiede ancora la barriera esterna SQL/Supavisor **e** HTTP/API, il journal B2 esterno e le verifiche GDPR. Nessun GO implicito.
