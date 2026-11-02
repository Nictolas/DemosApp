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
