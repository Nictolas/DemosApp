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


## 03/11/2026 — Verifica selezioni ad alto fanout
- La query precedente usava `users → political_selections → follower` e poi `SELECT DISTINCT`, aumentando le righe intermedie in proporzione ai follower.
- Nel branch della PR #584 `selectedRepresentatives` parte dai **mandati attivi** e usa `EXISTS` su una selezione canonica con follower attivo. Ogni deputato è selezionato una sola volta e nessuna lista di follower esce dal database.
- L'indice `idx_political_selections_selected_subject` è **già previsto** da `20261009_political_selections.sql`; nessuna nuova migrazione o indice su produzione. La presenza reale nel database operativo deve essere controllata separatamente.
- Test con 25.000 follower sintetici: PostgreSQL 16, `EXPLAIN (ANALYZE, FORMAT JSON)` letto in CI senza soglie arbitrarie di latenza; risultato atteso 1 deputato. Disattivare tutti i follower sintetici deve restituire zero rappresentanti anche se mandato rimane attivo.
- Il test dimostra semantica e piano *solo nel dataset sintetico*. Non autorizza affermazioni di throughput 1M, SLA, spese nulle o invii FCM in massa.

## Privacy push in anteprima
Il testo della notifica FCM nella PR #584 è fisso e neutro: non contiene titolo dell'atto, voto, stato personale o esito. La pagina interna verificata mostra i dettagli dopo l'apertura dell'app. Test mock su Camera/Senato, senza invii reali.
