# DEMOS — staging unificato (OPS-STG-001)

Decisione del 2 novembre 2026: un solo ambiente di staging permanente e condiviso tra tutti i filoni DEMOS. Non creare servizi Render o database nuovi per ogni chat, PR o funzione. Eccezioni solo per test distruttivi o incompatibili, preferibilmente temporanee e isolate, con motivo, costo, durata e cleanup documentati.

## Infrastruttura di destinazione

- Backend: RIUTILIZZARE il web service Render Free demos-functional-staging, id srv-db52l1g473hc739ld250, come futuro demos-staging. Non creare una nuova istanza permanente.
- Database: Supabase Demos-Staging, project ref fkeayjzvtuvzesljhjbc, PostgreSQL 17. Il suo schema non è ancora equivalente a quello necessario per tutta l'app.
- Redis/Key Value: valutare il riuso di demos-security-staging-kv; il piano gratuito è volatile.
- Produzione: NON riconfigurare demos-backend, frontend pubblico e Supabase Demos, project ref wxnblcqoyjqxktwkcqok.
- Tenere i servizi staging preesistenti fino a prova riuscita di parità, integrazione e rollback.

## Fase iniziale: bootstrap, NON staging applicativo pronto

Il programma api/staging/unified_staging_bootstrap.js non importa la app, PostgreSQL, Redis, Firebase, job o provider esterni e non legge credenziali. Serve esclusivamente come bootstrap sicuro del servizio condiviso.

Avvio: NODE_ENV=staging e DEMOS_UNIFIED_STAGING_MODE=bootstrap, con comando cd api && node staging/unified_staging_bootstrap.js.

Endpoint: /health risponde 200 con status bootstrap_only e ready_for_app_tests false. /health/ready risponde 503. Ogni API applicativa risponde 404. Un 200 sul liveness NON equivale a un collaudo applicativo. Non usarlo per login, notifiche, Opinioni, GDPR o release.

## Gate necessari prima del cutover operativo

1. Backup esterno con pg_dump del vecchio Render Postgres demos-civic-staging-db, che scade l'8 novembre 2026. Verificare dump, hash e restore in destinazione vuota/isolata. Non importare ciecamente nel progetto Supabase già popolato. Il backup non è stato ancora eseguito.
2. Inventariare le connessioni dei 10 servizi staging e verificare che nessuno usi segreti di produzione in modo indesiderato. Non esporre password, token o URL completi nei log, Sheet o PR.
3. Preparare lo schema dell'app in Supabase Demos-Staging senza alterare i dati di produzione e senza distruggere i test GDPR, OP37 e altri schemi staging. Mancano ancora alcune tabelle essenziali nello schema public, incluse eventi e programmi.
4. NON eseguire direttamente il runner storico api/scripts/stagingMigrate.js contro Supabase: al momento accetta solo il nome database demos_civic_staging_db. Occorre adattamento revisionato, con gate sul progetto di destinazione e migrazioni idempotenti.
5. Impedire invii FCM, email, cron, cleanup, writer GDPR e chiamate a sistemi reali durante test non autorizzati. Solo utenze e fixture sintetiche; isolamento multiutente e privacy.
6. Riunire in un solo servizio le suite di sondaggi, sicurezza, notifiche, autenticazione, iniziative e recovery, usando job on-demand o test effimeri isolati per quelli distruttivi.
7. Eseguire E2E contro lo staging realmente configurato: autorizzazioni, voti/consensi, notifiche, uscite internet, nessun effetto in produzione, rollback. Documentare esiti.
8. Solo dopo i gate qualificare demos-staging, comunicarlo alle chat e dismettere i vecchi 9 servizi ridondanti, Render PG e l'eventuale KV superfluo. Non anticipare le cancellazioni.

## Regola di coordinamento

La fonte canonica dello stato è il Google Sheet DEMOS – Roadmap – Tabella di Marcia, CHECKLIST MASTER, id OPS-STG-001 con peso zero. Le altre chat NON devono creare nuovi staging permanenti; fino al GO possono lavorare sul codice e su test locali/CI, senza usare il bootstrap come ambiente applicativo. Il filone di coordinamento è l'unico che cambia l'infrastruttura condivisa. Nessun merge o deploy di produzione è autorizzato da questa decisione.

Evidenza al 02/11/2026: Render CLI autenticata, demos-functional-staging autoDeploy OFF sul vecchio ramo e senza log applicativi recenti nel periodo controllato; Supabase produzione/staging attivi e separati; 17/17 test storici staging/TLS locali PASS; 2/2 test nuovi del bootstrap PASS. Backup, credenziali isolate, schema completo, E2E e dismissione non ancora eseguiti.


## Inventario consolidamento (10 servizi web → 1)

| Servizio Render esistente | Verifica da preservare | Destinazione dopo il collaudo |
| --- | --- | --- |
| demos-staging (già demos-functional-staging) | E2E funzionale condiviso | **Unico backend staging permanente** |
| demos-civic-deploy-probe-staging | Iniziative civiche, notifiche opt-in | Test su shared staging senza invio reale e suite CI |
| demos-sondaggi-op37-http-staging | Sondaggi HTTP e OP37 | Suite CI + E2E senza distruggere fixture altrui |
| demos-b2-readonly-restore-staging | Recupero B2 in sola lettura | Job isolato con credenziali ridotte; mai restore sul DB condiviso |
| demos-outbox-readonly-staging | Audit outbox in sola lettura | Suite CI + smoke read-only |
| demos-p07-rollback-dryrun-staging | Pianificazione rollback P07 | Test offline/CI, nessuna operazione sul provider di produzione |
| demos-first-four-playbooks-staging | Playbook P01-P04 | Sandbox sintetica isolata, non sul DB condiviso |
| demos-action-runner-sandbox-staging | Action-runner con client finti | Sandbox effimera senza credenziali reali |
| demos-security-gates-staging | Quality/security gates | Suite CI + test staging non distruttivi |
| demos-security-staging | Integrazioni security-agent | Suite di staging separata per namespace, solo dopo audit segreti |

Questa tabella NON autorizza la cancellazione di alcun servizio: prima preservare equivalenza dei test, segreti minimi e rollback, poi dimettere uno alla volta verificando l'assenza di regressioni.

## Verifiche aggiuntive — 2 novembre 2026

- Nuovo script read-only api/scripts/unifiedStagingPreflight.js: richiede NODE_ENV=staging, DEMOS_UNIFIED_STAGING_MODE=preflight, riconosce **solo** progetto Supabase Demos-Staging tramite hostname o identificativo account pooler, e rifiuta progetto PROD e vecchio Render PG. Rimuove i parametri SSL dalla URI per applicare la policy TLS centralizzata. Non scrive dati e non invia notifiche.
- Test locali Node su commit PR #565: **7/7 PASS** (2 bootstrap + 5 preflight).
- Query diretta information_schema del progetto Supabase Demos-Staging: **6/9** tabelle applicative minime presenti. Mancano eventi, programmi e civic_processes. Il preflight non deve dichiarare pronto il backend finché non è risolta la divergenza.
- Backup PostgreSQL Render: primo pg_dump non riuscito perché mancava un certificato CA locale; regola firewall temporanea limitata a un IP e poi **deny-all ripristinato**. Documentazione PostgreSQL 17 prevede PGSSLROOTCERT=system per TLS verify-full. Esecuzione automatica successiva bloccata dal sistema di sicurezza: **nessun backup verificato**. Priorità assoluta prima dell'8 novembre.
- Stato: bootstrap Render LIVE; **non** app staging pronta. Produzione e gli altri servizi non modificati.


## Stato schema effettivo dopo migrazione — 02/11/2026

La migrazione additiva `ops_stg_001_core_tables_20261102` è stata **applicata soltanto** al progetto Supabase Demos-Staging (ref `fkeayjzvtuvzesljhjbc`).

- Nuove tabelle vuote: `eventi`, `programmi`, `civic_processes`, `civic_process_identifiers`, `civic_process_source_records`, `civic_process_reconciliation_candidates`.
- Verifica read-only 6/6 tabelle, RLS attiva 6/6, SELECT diretto per ruoli anon/authenticated negato 6/6. Nessun dato importato, nessuna modifica a produzione.
- Stato `public`: **115** tabelle nella produzione, **25** nello staging, **93** nomi della produzione non presenti nello staging. Lo scarto include oggetti legacy e tabelle forse non necessarie: NON replicare indiscriminatamente né usare dati reali.
- Il test del preflight che ora vede le nove tabelle minime NON costituisce un GO: lo script stampa esplicitamente `minimum_tables_present_not_app_ready`, mentre il bootstrap Render continua con `/health/ready = 503`.
- 15/15 test locali Node su bootstrap, preflight e contratto SQL superati; necessaria CI e QA integrata con utenze sintetiche.
- Prossima azione: classificare le 93 tabelle per necessità nelle route app attuali (P0), legacy di sola compatibilità (P1), archivi/strumenti indipendenti (P2). Portare in staging schema e vincoli necessari, ma NON righe della produzione.
- Il vecchio PostgreSQL Render rimane da esportare prima dell'8 novembre. Non eliminare né sovrascrivere fino a backup verificato.

Il bootstrap Render è quindi **operativo ma non è ancora staging applicativo**. Il numero di tabelle minime presenti non è una metrica di completamento dell'ambiente.


## Gate esecuzione SQL dopo consolidamento — controllo offline 02/11/2026

La definizione `api/database/staging/ops_stg_001_missing_tables.sql` è ora protetta da una singola transazione SQL (`BEGIN` → DDL / RLS / REVOKE → `COMMIT`) e da un controllo preventivo su **tutte e sei** le tabelle. Un errore impedisce di lasciare solo una parte dello schema, quando lo script viene eseguito come unità atomica. I test statici in `api/tests/unifiedStagingSchemaContract.test.js` e la CI `unified-staging-offline-safety.yml` verificano questo contratto, senza eseguire SQL contro provider esterni.

**Questa modifica è esclusivamente al file di migrazione nella PR #565.** Le sei tabelle risultano già presenti su `Demos-Staging` dalle verifiche documentate sopra: **non rieseguire** la migrazione su quel progetto. Il controllo sulle tabelle esistenti la bloccherebbe deliberatamente. Prima di qualsiasi ulteriore modifica schema serve una riconciliazione di stato, una procedura revisionata e autorizzazione esplicita del filone infrastrutturale. La presenza del marcatore `civic_runtime_identity` è una difesa aggiuntiva ma **non prova da sola l'identità del progetto**: confermarla esternamente, senza memorizzare credenziali o dati personali.

Il prossimo intervento senza autorizzazione infrastrutturale resta **solo** revisione statica, test locali e CI isolata. La direttiva staging unico continua a vietare test applicativi sul bootstrap, modifiche ai vecchi staging e nuove istanze permanenti. Il vecchio Render PostgreSQL con scadenza indicata dell'8 novembre 2026 richiede coordinamento per un backup verificato; questo aggiornamento non lo esegue né lo autorizza.
