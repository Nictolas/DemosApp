# DOC-075 — Verifica privacy end-to-end: revoca consenso e cache delle opinioni

**Data:** 25 ottobre 2026. **Stato:** correzioni proposte su [PR #264](https://github.com/Nictolas/DemosApp/pull/264), DRAFT; **non ancora rilasciate**. Nessuna scrittura o revoca effettuata su account reali.

## Risultato dell'analisi

La PR backend Sondaggi #258 è già stata distribuita. Sull'itinerario da schermata Opinioni → API di salvataggio → PostgreSQL → endpoint GDPR di revoca, è emersa una finestra di concorrenza: il consenso politico era verificato **fuori** dalla transazione di scrittura. Se un'altra richiesta revocava il consenso fra controllo e scrittura, la risposta poteva essere registrata **dopo** la cancellazione delle opinioni preesistenti. Lo stesso rischio interessava la modifica delle opinioni dell'utente tramite Admin.

Al contempo, le quattro schermate Opinioni usavano chiavi React Query del tipo `['opinioniQuestions', 'Nazionale']` mentre il relativo endpoint include `userAnswer` e quindi risposte politiche individuali. La cache non distingueva l'account; il componente GDPR aggiornava i dati del consenso ma non eliminava la cache delle risposte alla revoca.

## Mitigazioni nella PR

1. **Salvataggio personale** `POST /api/opinioni/salva`: validazione del payload, poi transazione con `SELECT id FROM users WHERE id=$1 FOR UPDATE`, **seconda istruzione** `SELECT COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false)` per ottenere un nuovo snapshot READ COMMITTED, poi `SELECT ... opinioni_risposte FOR UPDATE` e INSERT/UPDATE, COMMIT. La revoca aggiorna la stessa riga users e poi cancella gli inserimenti politici nella stessa transazione. Senza consenso, `403` e ROLLBACK; utente mancante `404`.
2. **Salvataggio Admin** `PUT /api/users/:userId/opinioni`: il controllo definitivo è identico, all'interno della stessa transazione del salvataggio, anche se rimane il pre-controllo per una risposta veloce agli utenti non consenzienti.
3. **Cache per account e revoca**: le quattro schermate distinguono l'ID utente nelle chiavi. Il selettore statistico usa `statsOpinionQuestions` e può anch'esso conservare risposte personali. Dopo revoca GDPR, si annullano le richieste in corso e vengono eliminate entrambe le famiglie di cache (`opinioniQuestions` e `statsOpinionQuestions`). Le cinque letture ora passano il `signal` React Query all'API client, che lo collega al vero `fetch` HTTP con `AbortController` e mantiene un timeout indipendente compatibile con le WebView Android. Corretto inoltre il selettore statistiche affinché estragga `response.data` anziché l'involucro della risposta.
4. **Minimizzazione dei log web**: rimossi 68 debug log dalle pagine Nazionali/Regionali/Europee, compresi payload e valori personali; eliminato il logging del corpo JSON e dei risultati della decodifica dal client API condiviso. Test di regressione dedicati.
5. **DPIA** `DPIA_DemosApp.md`: nuovo Allegato H, etichettato **BOZZA TECNICA DA VALIDARE COL DPO**, che documenta rischi di inferenza fra aggregati (anche sopra soglia 10), scelta del consenso nella registrazione, cache e conservazione dati. Le sezioni originali e firme non sono presentate come approvate.

## Test e perimetro

Workflow CI `.github/workflows/political-consent-save-revoke-ci.yml` con PostgreSQL 17 **usa solo `127.0.0.1` e database usa-e-getta `political_consent_race_ci`**, e rifiuta connessioni Supabase/Render/produzione. Test con route Express reali e dati sintetici:
- **Salva → revoca:** il salvataggio mantiene il lock dell'utente; la revoca deve raggiungere l'UPDATE SQL concorrente *prima* dello sblocco e cancella atomicamente la risposta. Consenso finale false, nessuna risposta.
- **Revoca → salva:** il salvataggio attende il lock e poi nega la scrittura con 403. Nessuna risposta.
- **Admin → revoca / revoca → Admin:** stessi due ordini anche per l'endpoint amministrativo.
- **Concessione valida → salva:** preservata l'operatività normale, nessun obbligo CIE aggiuntivo.
- Test unitari del contratto API; test statici cache GDPR, test eseguibili sul vero client HTTP TypeScript transpilato e su TanStack Query con richieste `fetch` sintetiche, build frontend. Il test dell'annullamento verifica anche l'assenza di timer residui e che una cancellazione non venga presentata come un timeout.

**Non equiparare CI verde a certificazione GDPR**: non sono ancora stati testati account reali Android, push notifiche, logout multi-account su dispositivo fisico, differencing degli aggregati geografici, completezza DPO e DPIA ufficiale.

## Rilascio e rollback

**Non effettuare merge automatico di PR #264 finché tutti i controlli non siano verdi e il rilascio backend+frontend non sia pronto.** La modifica coinvolge il server, la UI e una DPIA in bozza; deve essere verificata anche nel deploy del frontend. La PR #258 in produzione resta invariata fino a eventuale merge separato. In caso di problema, revert della sola PR #264, senza manipolare utenti o voti, e monitoraggio HTTP 403/500, tempi di salvataggio, errori di pool e revoca.

## Ulteriore minimizzazione della risposta — PR stacked 2026-10-25

La route autenticata `GET /api/user/political-opinions-consent` invia alla UI soltanto `consent.granted` e `consent.timestamp`. L'indirizzo IP e lo user-agent raccolti come prova del consenso non vengono più letti per questa risposta né inseriti nella cache React Query. Restano invariati il salvataggio della prova lato server, la revoca atomica, il registro di cancellazione e i percorsi separati di accesso GDPR.

Test HTTP sul router Express con database sintetico verifica la lista precisa dei campi del JSON e l'assenza di query SQL sui campi IP/user-agent. Un test client impedisce che il contratto della UI li reintroduca. Il cambiamento è in bozza, non rilasciato; la DPIA richiede ancora la validazione del DPO. Eventuali consumatori API esterni devono verificare la compatibilità con la risposta minimizzata.

## Lettura risposte protetta dal consenso — PR successiva in bozza

La route legacy autenticata `GET /api/opinioni-list` applica ora il consenso Art. 9 **nella stessa SELECT** che recupera la riga di `opinioni_risposte`, tramite `users` e l'eventuale override `user_consents`. Se il consenso manca o risulta revocato, la risposta mantiene le domande pubbliche ma restituisce `userAnswer: null` anche se esistesse una riga residua. La politica HTTP `private, no-store` rimane invariata. Sono aggiunti test sintetici per consenso assente, revocato e override esplicitamente concesso.

**Limite:** questa verifica è atomica rispetto allo snapshot della singola SELECT, ma **non serializza** la lettura con una revoca concorrente: una lettura già partita potrebbe terminare dopo la revoca. L'eventuale requisito di serializzazione forte delle letture richiede valutazione dedicata (costi DB, lock e prove concorrenti). Nessuna modifica a dati reali o produzione; DPIA ancora da validare con il DPO.

Il workflow CI della PR esegue inoltre il vero router Express su PostgreSQL 17 locale con tabelle TEMP e soli dati sintetici: risposta concessa, override revocato con risposta residua, consenso assente, override concesso e autenticazione mancante. Il test rifiuta esplicitamente URL e variabili di produzione/Supabase/Render.


## Lettura opinioni dai profili: proposta su ramo successivo (non rilasciata)

Anche il GET autenticato \`/api/users/:userId/opinioni\` leggeva risposte e \`fonti_opinioni\` residue senza verificare il consenso politico. Il ramo successivo aggiunge nella SELECT delle risposte lo stesso filtro Art. 9 di \`/api/opinioni-list\`, preservando l'accesso alle domande senza esporre risposte/fonti dopo revoca. L'intestazione \`Cache-Control: private, no-store, max-age=0\` viene impostata prima dell'autenticazione. Test sintetici verificano le risposte, le fonti, l'override del consenso, gli accessi autorizzati e gli errori senza cache. Non serializza le letture già avviate con la revoca concorrente. Richiede CI, review e verifica Android prima di qualsiasi merge/rilascio; DPIA ancora da validare con DPO.

## Matching politico e consenso di ogni partecipante — PR successiva in bozza

Il motore condiviso `politicalMatchingService.getOpinionMapsByUserId`, usato dai suggerimenti di candidati e rappresentanti e dai controlli di completamento, leggeva tutte le righe `opinioni_risposte` richieste senza applicare il consenso del singolo soggetto. Una riga residua dopo revoca poteva influenzare percentuali, copertura e punteggi anche senza esporre direttamente la risposta.

La SELECT batch ora filtra **ciascun utente** con `COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE`, mantenendo il confronto in una sola query e l'assenza di risposte come `{}`. Il richiedente revocato non risulta più completo; le risposte residue di un candidato revocato non contribuiscono al punteggio. Le posizioni istituzionali importate restano fuori da questo intervento. Il test unitario verifica la presenza del predicato nella SELECT e i casi revocati, mentre il test CI PostgreSQL 17 con sole tabelle TEMP verifica i risultati effettivi su dati sintetici. Nessun dato reale è letto o modificato.

**Limiti:** la SELECT non serializza una lettura già iniziata con la revoca concorrente; la verifica di cache/logout Android e la DPIA con il DPO restano aperte. Le PR concatenate rimangono bozze, senza merge o rilascio.
