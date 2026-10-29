# DEMOS — GH-296 / inventario iniziale accessi SQL per recovery (29 ottobre 2026)

**Stato: parziale, verificato sul codice della PR Draft #374; non è un censimento delle connessioni attive e non è un'autorizzazione al ripristino.** Nessuna connessione a provider o dato utente è stata richiesta per questo documento.

## Evidenze dai file verificati

| Percorso | Evidenza codice | Esposizione verificabile dal codice | Azione per il gate |
| --- | --- | --- | --- |
| `api/config/database.js` | Pool singleton `pg`, configurazione TLS centralizzata e `DATABASE_URL` | Utilizzato dal runtime backend e da più moduli; le credenziali SQL effettive non sono state attestate | Isolare il runtime Render, verificare `session_user/current_user`, chiudere pool e sessioni, impedire riconnessioni |
| `api/config/db.js` | Ulteriore `new Pool(config)`, anche con variabili DB_USER/DB_HOST/DB_PASSWORD; `ssl.rejectUnauthorized=false` | La presenza nel repository non prova che sia effettivamente importato dal processo attivo | Cercare tutti gli import, eliminare o segregare il pool legacy; vietare credenziali riutilizzabili dopo restore |
| `api/routes/database.js` + `api/app.js` | `GET /check-table-structure` istanzia `new Pool` con `DATABASE_URL` e `rejectUnauthorized:false` | Prima della Fase F `app.use('/api', databaseRoutes)` era incondizionato. Nel Draft #374 è stato corretto in `if (!isProductionApp) { app.use('/api', databaseRoutes) }`, senza deploy. Non è una route di scrittura, ma apre connessioni autonome e legge metadata | Mantenere la route esclusa in produzione, anche se `ALLOW_DEV_API_SURFACE=true`; il controllo CI deve fallire in caso di rimontaggio |
| `api/routes/cleanup.js` + `api/app.js` | Creazione di pool autonomi su richieste di eliminazione utenti | Nella PR Draft #374 i mount sono sotto `if (!isProductionApp)`, perciò **non** si riattivano in produzione nemmeno con `ALLOW_DEV_API_SURFACE=true`. Nel deploy live la modifica non è attestata. Include middleware amministrativo | Non considerarle coperte dal solo pool canonico, eliminare la possibilità di DML durante la quarantena; verificare configurazione Render autorizzata |
| `api/routes/migrations.js` + `api/app.js` | Creazione pool autonomo e DDL `ALTER TABLE` | Nella PR Draft #374 la route è montata solo sotto `if (!isProductionApp)`; nel deploy live non è stata verificata la chiusura | Bloccare migrazioni e DDL fuori da un processo di manutenzione approvato; verificare flag effettivo |
| `api/routes/categorie.js` | Pool indipendente con `DATABASE_URL` | Non è stato individuato un mount diretto nel file `api/app.js` esaminato: ciò **non dimostra** che nessun altro processo possa importarlo | Verificare raggiungibilità ed eventuali import; impedire letture/scritture in restore |
| `api/server.js` | Shutdown che arresta più job ed esegue `closePool()` del pool canonico | Le routine di chiusura nel codice non attestano che tutti i processi siano terminati in un incidente | Sospendere job, timer, poller e importatori; verificare zero connessioni live e impossibilità di nuove connessioni |

### Fase J — Riduzione della superficie di sviluppo nel Draft #374

Nel codice `api/app.js` della PR Draft #374, `mountDevApiSurface = !isProductionApp` e il flag `ALLOW_DEV_API_SURFACE=true` **non riabilita piu'** alcun gruppo di route legacy in `NODE_ENV=production`. La chiusura copre, tra gli altri, `/api/test-add-opinione`, `/api/test-db`, `/api/migrate`, `/api/test-performance`, `/api/fix-database`, `/api/debug-opinioni`, `/api/test-opinioni-endpoints`, e `/api/test`; le route SQL `/api/migrations` e `/api/cleanup` hanno anche una seconda guardia diretta `if (!isProductionApp)`. `/api/check-table-structure` e `/api/test-db` (health) restano esclusi in produzione con i rispettivi gate gia' aggiunti nel Draft.

**Limitazione di compatibilita':** staging distribuito con `NODE_ENV=production` non puo' usare il vecchio override per attivare le route di manutenzione. Questo e' intenzionale: qualsiasi manutenzione futura richiede flusso approvato/isolato invece di riabilitare endpoint SQL via variabile ambiente.

**Limitazione temporale:** questo comportamento esiste solo sul ramo Draft; il codice distribuito in produzione deve essere verificato separatamente prima di chiamare la protezione 'attiva'. `NODE_ENV` di un processo mal configurato potrebbe non essere `production`; non e' una barriera indipendente, ne' blocca script, processi o SQL fuori dall'app.

### Regola fail-closed

L'esclusione della diagnostica dalla produzione, il blocco in memoria delle API, `ALTER ROLE NOLOGIN`, la modifica di password, il blocco SQL locale o un'attestazione HMAC sono **tutti insufficienti da soli** per dichiarare un ripristino sicuro. Una sessione SQL già attiva può sopravvivere al `NOLOGIN`, un pooler può conservare altre sessioni, una connessione privilegiata può aggirare le funzioni SQL e un vecchio snapshot può ripristinare gate/epoch. Serve un **cut-off indipendente dalla generazione SQL** e attestato su ogni via di accesso.

## Evidenze ancora mancanti — impediscono GO

1. Identità del processo reale Render e di ogni ruolo PostgreSQL/connessione di importatori, jobs, pooler, SQL editor e account amministrativi; nessun segreto va riportato negli artefatti.
2. Superfici Supabase non coperte da una singola connessione `pg`: API REST/Data API, ruoli e grants, Auth/trigger, funzioni RPC, eventuali connessioni di servizi e chiavi provider. **Non è stata accertata né esclusa la loro disponibilità**.
3. Prova infrastrutturale, autorizzata e indipendente dal DB, di blocco delle nuove connessioni, chiusura delle sessioni esistenti, rotazione/revoca credenziali e assenza di ingressi alternativi dopo restore/PITR.
4. Continuità e completezza del journal GDPR esterno B2, versione/retention, checkpoint e recovery di operazioni incerte, quindi verifica di un vero ripristino di staging in quarantena.
5. Gate legali RP-10/F5-17 e DPIA/DPO, scelta di retention e trattamento degli identificativi di cancellazione.

## Controllo automatico aggiunto

`api/tests/gdprDataPlaneRouteSurface.test.js` verifica il sorgente e **esegue il blocco di montaggio in una VM isolata** nei casi produzione con e senza override e ambiente non-production. Verifica anche il gate globale che ignora `ALLOW_DEV_API_SURFACE` in produzione. Nessun import del server, nessuna connessione reale. **Questa prova di montaggio è più forte di una semplice ricerca testuale, ma non certifica né il runtime distribuito né il data-plane/provider**.

Issue [GH-296](https://github.com/Nictolas/DemosApp/issues/296): **OPEN / NO-GO**. Nessun deploy, merge, provisioning o intervento sui dati di produzione.
