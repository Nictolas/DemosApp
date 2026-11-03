# DEMOS — Ultimo voto parlamentare verificato e notifiche (DRAFT / NO-GO)

**Stato 03/11/2026:** PR #576, non distribuita. Staging condiviso ancora bootstrap.
**Nessun invio push, migrazione SQL, deploy o generazione AI effettuato.**

## Scelta di prodotto
- Notifica interna nella pagina Notifiche, con dettaglio a schermo intero.
- Una riga di notifiche_voti_parlamento per (ID del rappresentante, Camera/Senato), condivisa da tutti i suoi follower.
- Il nuovo voto finale verificato sostituisce l'ultimo senza generare copie per ogni utente.
- Identificatore immutabile openpolis_id; voto e assenza non inferiti dal gruppo.
- Fonte Camera istituzionale, fonte Senato Openpolis chiaramente attribuita.
- Vecchi push: banner nella pagina Notifiche e accesso all'archivio delle votazioni finali recenti (finestra di 120 giorni).
- Nessuna votazione intermedia/legge inventata; missione o assenza non sono voti contrari.

## Modifiche in bozza
1. parliamentLatestVoteNotificationsService.js: sceglie l'ultima finale recente per Camera e Senato; verifica la fonte nominale, abbina il rappresentante in modo univoco, verifica mandato attivo e presenza follower; UPSERT con confronto data+numero votazione. Reazioni di un voto precedente non ereditate.
2. 20261103_latest_parliament_votes.sql: migrazione da approvare; rileva duplicati/NULL senza cancellarli, aggiunge identificatore, ordinamento, stati e indice univoco. Non applicata alla produzione.
3. API Notifiche: ramo legacy invariato quando feature OFF, nuovi ID ed esito disponibili soltanto quando feature ON.
4. Frontend: popup in Notifiche; Android e web link /notifiche?final_vote=ID; vecchio push con voto sostituito rimanda alle finali recenti.
5. parliamentFinalBallotPushService.js: trasporto FCM separatamente disabilitato. Se abilitato, invio solo a dispositivi attivi degli utenti attivi che seguono il rappresentante e hanno consentito espressamente deputato/senatore nelle preferenze. Nessun record per follower; cap prudenziale 5000 destinatari per rappresentante. Best-effort, non garantito.

## Interruttori OFF per default
- PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED=true: dopo la migrazione, consente UPSERT ultima notifica nel job sync Openpolis.
- PARLIAMENT_FINAL_PUSH_ENABLED=true: invio FCM dopo commit solo se il primo interruttore è attivo.

## Gate prima del rollout
- [ ] Staging condiviso GO per OPS-STG-001, poi migrazione testata, SQL reale, reazioni e rollback.
- [ ] E2E autenticazione, titolarità scelta rappresentante, Camera/Senato, date, fonte, voti segreti e dati non disponibili.
- [ ] QA Android/Chrome su scroll e modali, push corrente e push sostituito.
- [ ] DPO/privacy: race di revoca preferenze durante dispatch FCM da risolvere; verifica permessi e token.
- [ ] Costo zero documentato per Firebase/FCM, Render e Supabase. Cap 5000 implica NO-GO per un rollout a un milione: progettare un delivery sicuro a blocchi/outbox senza costi aggiuntivi.
- [ ] Coordinamento PR #568/#569/#575/#576, backend effettivamente distribuito e autorizzazione esplicita al merge/deploy.
- [ ] Spiegazione basata su testo ufficiale separata: issue #578. Nessuna chiamata Groq automatica.

## Rollback
Disabilitare entrambi gli interruttori, senza cancellare colonne, tabelle o notifiche storiche. La scrittura e l'invio non partono con la funzione OFF.
