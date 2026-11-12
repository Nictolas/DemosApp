# DEMOS — Ultimo voto parlamentare verificato e notifiche (DRAFT / NO-GO)

**Stato 03/11/2026:** PR #576, non distribuita. Staging condiviso ancora bootstrap.
**Nessun invio push reale, migrazione SQL su Supabase, deploy o generazione AI effettuato.** Test consentiti esclusivamente in CI PostgreSQL temporaneo e Firebase simulato.

## Scelta di prodotto
- Notifica interna nella pagina Notifiche, con dettaglio a schermo intero.
- Una riga di notifiche_voti_parlamento per (ID del rappresentante, Camera/Senato), condivisa da tutti i suoi follower.
- Il nuovo voto finale verificato sostituisce l'ultimo senza generare copie per ogni utente.
- Identificatore immutabile openpolis_id; voto e assenza non inferiti dal gruppo.
- Fonte Camera istituzionale, fonte Senato Openpolis chiaramente attribuita.
- Vecchi push: banner nella pagina Notifiche e accesso all'archivio delle votazioni finali recenti (finestra di 120 giorni).
- Nessuna votazione intermedia/legge inventata; missione o assenza non sono voti contrari.

## Modifiche in bozza
1. parliamentLatestVoteNotificationsService.js: cerca l'ultima votazione finale verificata **per ogni rappresentante scelto** (non una sola per Camera/Senato); carica da PostgreSQL fino a 50 scrutini recenti **per Camera** usando ROW_NUMBER e ordinamento numerico del voto, verifica la fonte nominale e il mandato attivo; UPSERT con confronto data+numero, senza ereditare reazioni precedenti.
2. 20261103_latest_parliament_votes.sql: migrazione da approvare; rileva duplicati/NULL senza cancellarli, aggiunge identificatore, ordinamento, stati e indice univoco. Non applicata alla produzione.
3. API Notifiche: ramo legacy invariato quando feature OFF; con feature ON usa soltanto la scelta corrente nella tabella canonica political_selections e controlla la Camera esatta, così una vecchia selezione non riceve il voto di un altro politico.
4. Frontend: popup in Notifiche; Android e web link /notifiche?final_vote=ID; vecchio push con voto sostituito rimanda alle finali recenti.
5. parliamentFinalBallotPushService.js: trasporto FCM separatamente disabilitato. Se attivato, filtra per scelta canonica corrente, stato attivo, consenso esplicito deputato/senatore e dispositivo attivo; per ogni gruppo di 250 token riesamina questi dati dentro una transazione PostgreSQL con FOR SHARE fino al termine dell'invio. Cap prudenziale 5000 destinatari per evento. Best-effort: una volta accettato da FCM il messaggio non può essere richiamato.

6. Ingestione Openpolis: `fetchVotazioniFinaliPerCamera(50)` visita al massimo 10 pagine HTML e conserva fino a 50 finali per Camera e 50 per Senato. Evita che molte votazioni della Camera escludano interamente quelle del Senato dalla finestra. È un **limite protettivo**, non una prova di copertura completa oltre 10 pagine; parser e fonte restano fall-closed.

## Caso reale verificato — 03/11/2026 (solo dati pubblici)
- Deputato **Nicola Fratoianni**, Camera, scrutinio finale `vs19_735_017`, 28/10/2026: l'elenco **istituzionale Camera** lo registra **"Non ha partecipato"**. Openpolis usa "Assente": **la fonte ufficiale prevale**.
- Senatore **Peppe De Cristofaro**, Senato, scrutinio finale `19-469-6`, 28/10/2026: Openpolis lo registra come **"De Cristofaro Giuseppe"**, con stato **"Favorevole"**. Il codice ammette questa sola corrispondenza nominativa documentata; tutti gli altri nomi rimangono confronti esatti.
- Lo smoke CI `api/scripts/verifySelectedParliamentRepresentativeSources.js` rilegge pubblicamente entrambe le schede e fallisce se nome, data, Camera, fonte o stato divergono.
- Non pubblicare comunicazioni o push senza avere verificato la fonte in quel momento. Uno stato di assenza è un'informazione di partecipazione, NON un voto favorevole/contrario.
- Fonte primaria Camera: `https://documenti.camera.it/apps/votazioni/votazionitutte/schedaVotazione.asp?CDDNATURA=FINALE&Legislatura=19&RifVotazione=735_17&tipo=dettaglio`
- Fonte Senato tramite Openpolis: `https://parlamento19.openpolis.it/votazioni/19-469-6` (etichettare come Openpolis, non fonte diretta Senato).

## Interruttori OFF per default
- PARLIAMENT_FINAL_NOTIFICATIONS_ENABLED=true: dopo la migrazione, consente UPSERT ultima notifica nel job sync Openpolis.
- PARLIAMENT_FINAL_PUSH_ENABLED=true: invio FCM dopo commit solo se il primo interruttore è attivo.

## Gate prima del rollout
- [x] Migrazione ripetibile e UPSERT monotono, revoca FCM, FK, unicità, cancellazione reazioni e idempotenza collaudati su PostgreSQL 16 effimero GitHub Actions (nessun contatto con staging/produzione).
- [ ] Convalidare CI definitiva per importazione bilanciata Camera/Senato e limite di 50 votazioni per Camera su PostgreSQL 16 isolato; anche dopo il test rimangono da verificare la copertura della fonte e l'effettiva puntualità delle notifiche.
- [ ] Staging condiviso GO per OPS-STG-001; quindi migrazione e rollback sullo schema effettivo, autorizzazione DPO, E2E sessione autenticata e QA release.
- [ ] E2E autenticazione, titolarità scelta rappresentante, Camera/Senato, date, fonte, voti segreti e dati non disponibili.
- [ ] QA Android/Chrome su scroll e modali, push corrente e push sostituito.
- [x] Race di revoca nel trasporto FCM affrontata con SELECT FOR SHARE su utente, scelta canonica, preferenze e device mantenuto fino a riscontro Firebase; verificata in PostgreSQL 16 temporaneo. Un messaggio già accettato da FCM non è richiamabile. Restano test HTTP con sessioni reali e revisione DPO.
- [x] Firebase Cloud Messaging (FCM) è ufficialmente un prodotto senza costi anche nel piano Spark e con milioni di utenti: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans . Non implica che il progetto Firebase sia su Spark, né che Render/Supabase/GitHub Actions siano a costo zero.
- [ ] Verifica del piano e dei consumi del progetto Firebase effettivamente collegato, più Render/Supabase/GitHub Actions; cap 5000 = NO-GO per rollout a un milione: progettare consegna durabile e sicura senza costi aggiuntivi.
- [ ] Coordinamento PR #568/#569/#575/#576, backend effettivamente distribuito e autorizzazione esplicita al merge/deploy.
- [ ] Spiegazione basata su testo ufficiale separata: issue #578. Nessuna chiamata Groq automatica.

## Rollback
Disabilitare entrambi gli interruttori, senza cancellare colonne, tabelle o notifiche storiche. La scrittura e l'invio non partono con la funzione OFF.
