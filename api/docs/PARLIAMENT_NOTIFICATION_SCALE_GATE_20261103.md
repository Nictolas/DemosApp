# DEMOS — Gate sintetico di scala notifiche parlamentari

**Dipendenza:** PR #576 (canonica); PR #577 chiusa senza merge per duplicazione. Questa modifica non abilita funzionalità né distribuisce codice.

## Verifica isolata
- PostgreSQL 16 effimero GitHub Actions, DSN vincolato a `127.0.0.1:55432/demos_test` e account `demos_test`; mai connettere Supabase, Render o staging.
- 25.000 follower sintetici selezionano un solo deputato. Il servizio canonico produce **una riga condivisa** in `notifiche_voti_parlamento`, non 25.000 copie personali.
- La ripetizione identica dello scrutinio non cambia nessuna riga (idempotenza).
- Con 25.000 token FCM sintetici, il cap prudenziale di 5.000 deve impedire ogni chiamata a Firebase, anche con feature abilitata **solo nel processo di test**.
- La prova non verifica latenza HTTP, throughput o SLA di un milione di utenti. Non estrapolare tempi o costi.

## Architettura raccomandata per il rilascio minimo
La notifica **interna on-demand** e la pagina condivisa `/notifiche?final_vote=<id>` devono essere il percorso principale. La chiave condivisa è rappresentante + Camera; il dettaglio usa `openpolis_id`. Non sono necessarie scritture individuali per ogni follower. La notifica non deve cambiare la scelta politica memorizzata, né attribuire un voto a chi risulta assente.

Il trasporto push FCM di #576 resta OFF. Il blocco oltre 5.000 destinatari è un controllo di sicurezza, **non** una soluzione di recapito a un milione di utenti. Per push massivi occorre un progetto separato di outbox persistente, invio differito con checkpoint e rate limit, retry idempotente e ricontrollo delle preferenze al momento della consegna. Topic FCM per rappresentante solo dopo valutazione DPO della revoca e della visibilità delle preferenze politiche.

## Gate ancora aperti
E2E autenticata + schema effettivo, QA Android/Chrome, migrazione e rollback autorizzati, fonti definitive recenti e copertura, costi reali provider, revoca contemporanea al dispatch, persistenza/cache multiistanza, performance da 1M utenti e consegna FCM reale. Vietati merge, deploy, cancellazioni reali, DDL/DML produzione e invio massivo senza autorizzazione.
