# DEMOS — GH-296 / piano di isolamento a due superfici (29 ottobre 2026)

**Documento di progettazione e prove CI sintetiche, NON runbook eseguibile su produzione.** Nessun provider è stato configurato, sospeso o riconfigurato e nessun servizio è stato distribuito. La issue #296 resta **OPEN / NO-GO**. Non copiare le operazioni del modello PostgreSQL CI in produzione.

## Problema osservato su provider e nel codice

- Supabase **Demos** produzione esegue PostgreSQL 17. Una lettura aggregata di `pg_stat_activity` ha mostrato sessioni `Supavisor` come `postgres` e sessioni `postgrest` come `authenticator` (fotografie istantanee, **non** attribuibili automaticamente a Render).
- Il ruolo SQL `postgres` della connessione di **gestione Supabase** ha `BYPASSRLS`; questo NON attesta `session_user/current_user` del processo live Render. **Non definire come verificata l'identità runtime.**
- Render `demos-backend` pubblica su `main` con auto-deploy attivo. La diagnostica legacy con pool autonomo è ancora montata nel commit LIVE identificato; la correzione di mount sta solo nella PR Draft #374.
- Ricerca limitata al codice `main`: non sono emersi riferimenti diretti a `supabase-js` e i file `client/package.json` e `api/package.json` esaminati non dichiarano il pacchetto. **Questo non prova** che tutti i client, le automazioni esterne o un'altra distribuzione non usino HTTPS Supabase.
- [Supabase Network Restrictions](https://supabase.com/docs/guides/platform/network-restrictions): si applicano a **PostgreSQL diretto e Supavisor/pooler**, NON alle API HTTPS quali PostgREST, Storage e Auth.
- [Supabase Securing Your API](https://supabase.com/docs/guides/api/securing-your-api): **la Data API può essere disattivata dall'integrazione nel Dashboard**, impedendo le REST API autogenerate. **Non disabilitare senza aver dimostrato l'assenza di dipendenze**. Lo spegnimento della Data API NON va trattato come blocco generale di Storage, Auth, Realtime, RPC provenienti da altri percorsi o connessioni SQL.
- L'assenza di Edge Functions distribuite nel progetto Demos osservata dalla Management API non dimostra l'assenza di job SQL, estensioni, connessioni esterne, altre API o trigger.

## Matrice di isolamento — TUTTI i gate necessari, nessuno verificato end-to-end

| Superficie | Esempio di ingresso | Rimedio da progettare / attestare | Prova di rifiuto necessaria |
| --- | --- | --- | --- |
| HTTP Render | `demos-backend`, frontend, admin, job esposti | Modalità manutenzione prima di routing e letture; interdizione dei client con token precedenti, senza dipendere dal solo DB recuperato | Login/GET/POST sensibili respinti anche con sessione valida precedente; nessuna risposta con dati resuscitati |
| SQL diretto | `pg`, script, Admin SQL, importazioni | Barriera di rete/provider indipendente dal snapshot e dal ruolo PostgreSQL, credenziali precedenti non riutilizzabili | Connessioni nuove falliscono per ogni ruolo/provenienza; transazioni pregresse concluse o terminate |
| SQL pooler | Supavisor, pool persistent e sessioni riciclate | Drenaggio e chiusura pool/sessioni, test pre/post restore di tutte le porte e identità | Sessione preesistente non può leggere/scrivere e credenziali vecchie non rientrano |
| HTTPS Data API | PostgREST REST, GraphQL, RPC visibili | Verificare per tutti i client se Data API è necessaria; definire chiusura a livello di progetto/provider o revoca indipendente dallo snapshot; audit su ruoli/funzioni | REST/GraphQL/RPC realmente negati con vecchi token per tutti gli schemi in scope |
| HTTPS Auth, Storage, Realtime | Endpoints Supabase separati | Isolare separatamente dove possono esporre/scrivere dati o emettere token, senza presupporre che SQL IP restrictions li blocchino | Ogni canale che può leggere dati recuperati o creare identità/scritture è negato |
| Processi autonomi | Jobs Render, staging, script, trigger, worker outbox e provider | Censimento delle identità e delle esecuzioni, stop/fencing operator-led e verifica su log senza dati personali | Nessun writer o reader resta attivo o riconnette dopo la sospensione |
| Snapshot/backup | PITR, restore di intero cluster o singolo DB | Autorità esterna non retrocedibile, nuova epoca e identità, journal B2 durevole/completezza | Vecchio DB non può riaprire alcuna superficie; replay GDPR corretto prima dell'apertura |

## Prova automatizzata nuova: failure-mode SQL vs HTTP

`api/tests/gdprDualPlaneQuarantinePg17Synthetic.test.js` esegue sotto **GitHub Actions con database PostgreSQL17 fittizio `127.0.0.1/gdpr_outbox_worker_ci` e server HTTP `127.0.0.1` su porta effimera**. Il test si rifiuta di partire se non sono presenti tutti i guard rigorosi già previsti per le fixture CI. Non importa l'app, non chiama Supabase, Render o B2 e usa un'identità fittizia.

Quattro controlli reali del **solo ambiente temporaneo**:
1. Verifica che esistano una lettura SQL di dati inventati e una distinta risposta HTTP locale (200).
2. Blocca l'HTTP (503) e dimostra che SQL **continua a leggere**: non basta isolare il frontend/API.
3. Imposta `ALTER ROLE NOLOGIN PASSWORD NULL` **solo sul ruolo PostgreSQL inventato**: nuove connessioni falliscono, ma una sessione SQL già aperta e l'HTTP rimangono funzionanti.
4. Termina la sessione SQL inventata, osserva zero connessioni di quel ruolo e chiude l'HTTP locale (503). Questa è solo una **simulazione** di doppia chiusura, non una dimostrazione di enforcement del provider né di protezione dai restore dei ruoli globali PostgreSQL.

**Esito isolato:** [workflow GH Actions che esegue la nuova suite](https://github.com/Nictolas/DemosApp/actions/workflows/gdpr-b2-worker-retry-isolated-ci.yml), con **4/4 test PASS** nel primo [run 40924901982](https://github.com/Nictolas/DemosApp/actions/runs/40924901982). Conservare anche l'evidenza del test negativo: NOLOGIN non chiude una sessione già aperta e non blocca HTTPS.

## Sequenza futura da approvare — non eseguita

**Gate 0 — Censimento:** individuare a livello di runtime Render il ruolo/target SQL effettivo e tutte le connessioni (anche storage/auth/api e ambienti di staging); niente password/token negli output. Censire ogni API client, anche esterno, che usi Supabase. Confermare se `Enable Data API` sia attivato nel Dashboard e se qualcuno lo utilizzi.

**Gate 1 — Freeze indipendente:** prima di ripristinare backup, negare nuove richieste e sessioni tramite controlli di provider/IAM/rete che non possano retrocedere con snapshot, per TUTTE le superfici. Congelare code e task, gestire i processi amministrativi. Non fare affidamento sul solo `ALTER ROLE`, sul codice Render precedente o sul flag DB `gate.open`.

**Gate 2 — Drenaggio e prova negativa:** revocare/ruotare identità solo su autorizzazione separata e terminare le sessioni pregresse; verificare il fallimento di query e richieste HTTP sia con credenziali nuove sia con vecchi token, su tutte le vie attestate. Nessuna connessione residua verso database in quarantena.

**Gate 3 — Restore e riconciliazione:** ripristinare la copia soltanto in spazio isolato, attestare la generazione indipendente, verificare integrità e completezza di B2/outbox/ledger e operazioni ambigue; riprodurre cancellazioni e revoche senza dati personali riemersi. Nessuna riapertura se la catena delle prove non è completa.

**Gate 4 — Eventuale rilascio:** autorizzazione titolare/DPO e retention RP-10/F5-17/DPIA; probe end-to-end su staging esistente senza costi/provisioning nuovi; preferire nuova identità runtime e nuova epoca, solo dopo approvazione e piano di rollback sicuro. Una simulazione CI non può promuovere `recoveryReady` a `true`.

**Blocco da rispettare:** con gli strumenti collegati, le query eseguite via Supabase Management API identificano il proprio ruolo `postgres`, NON quello della connessione `pg` già aperta in Render. L'app Render non espone un comando remoto di sola lettura per eseguire `SELECT current_user,session_user` dentro il processo live; non indovinare l'identità e **non avviare deploy** per ottenerla senza una autorizzazione specifica.
