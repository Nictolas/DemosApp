# DOC-075 — Verifica privacy end-to-end: revoca consenso e cache delle opinioni

**Data:** 25 ottobre 2026. **Stato:** correzioni proposte su [PR #264](https://github.com/Nictolas/DemosApp/pull/264), DRAFT; **non ancora rilasciate**. Nessuna scrittura o revoca effettuata su account reali.

## Risultato dell'analisi

La PR backend Sondaggi #258 è già stata distribuita. Sull'itinerario da schermata Opinioni → API di salvataggio → PostgreSQL → endpoint GDPR di revoca, è emersa una finestra di concorrenza: il consenso politico era verificato **fuori** dalla transazione di scrittura. Se un'altra richiesta revocava il consenso fra controllo e scrittura, la risposta poteva essere registrata **dopo** la cancellazione delle opinioni preesistenti. Lo stesso rischio interessava la modifica delle opinioni dell'utente tramite Admin.

Al contempo, le quattro schermate Opinioni usavano chiavi React Query del tipo `['opinioniQuestions', 'Nazionale']` mentre il relativo endpoint include `userAnswer` e quindi risposte politiche individuali. La cache non distingueva l'account; il componente GDPR aggiornava i dati del consenso ma non eliminava la cache delle risposte alla revoca.

## Mitigazioni nella PR

1. **Salvataggio personale** `POST /api/opinioni/salva`: validazione del payload, poi transazione con `SELECT id FROM users WHERE id=$1 FOR UPDATE`, **seconda istruzione** `SELECT COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false)` per ottenere un nuovo snapshot READ COMMITTED, poi `SELECT ... opinioni_risposte FOR UPDATE` e INSERT/UPDATE, COMMIT. La revoca aggiorna la stessa riga users e poi cancella gli inserimenti politici nella stessa transazione. Senza consenso, `403` e ROLLBACK; utente mancante `404`.
2. **Salvataggio Admin** `PUT /api/users/:userId/opinioni`: il controllo definitivo è identico, all'interno della stessa transazione del salvataggio, anche se rimane il pre-controllo per una risposta veloce agli utenti non consenzienti.
3. **Cache per account e revoca**: le quattro schermate distinguono l'ID utente nelle chiavi. Il selettore statistico usa `statsOpinionQuestions` e può anch'esso conservare risposte personali. Dopo revoca GDPR, le richieste in corso sono annullate e vengono eliminate entrambe le famiglie di cache (`opinioniQuestions` e `statsOpinionQuestions`), prima di aggiornare il consenso visibile.
4. **Minimizzazione dei log web**: rimossi 68 debug log dalle pagine Nazionali/Regionali/Europee, compresi payload e valori personali; eliminato il logging del corpo JSON e dei risultati della decodifica dal client API condiviso. Test di regressione dedicati.
5. **DPIA** `DPIA_DemosApp.md`: nuovo Allegato H, etichettato **BOZZA TECNICA DA VALIDARE COL DPO**, che documenta rischi di inferenza fra aggregati (anche sopra soglia 10), scelta del consenso nella registrazione, cache e conservazione dati. Le sezioni originali e firme non sono presentate come approvate.

## Test e perimetro

Workflow CI `.github/workflows/political-consent-save-revoke-ci.yml` con PostgreSQL 17 **usa solo `127.0.0.1` e database usa-e-getta `political_consent_race_ci`**, e rifiuta connessioni Supabase/Render/produzione. Test con route Express reali e dati sintetici:
- **Salva → revoca:** il salvataggio mantiene il lock dell'utente; la revoca deve raggiungere l'UPDATE SQL concorrente *prima* dello sblocco e cancella atomicamente la risposta. Consenso finale false, nessuna risposta.
- **Revoca → salva:** il salvataggio attende il lock e poi nega la scrittura con 403. Nessuna risposta.
- **Admin → revoca / revoca → Admin:** stessi due ordini anche per l'endpoint amministrativo.
- **Concessione valida → salva:** preservata l'operatività normale, nessun obbligo CIE aggiuntivo.
- Test unitari del contratto API; test statici cache GDPR e build frontend.

**Non equiparare CI verde a certificazione GDPR**: non sono ancora stati testati account reali Android, push notifiche, logout multi-account su dispositivo fisico, differencing degli aggregati geografici, completezza DPO e DPIA ufficiale.

## Rilascio e rollback

**Non effettuare merge automatico di PR #264 finché tutti i controlli non siano verdi e il rilascio backend+frontend non sia pronto.** La modifica coinvolge il server, la UI e una DPIA in bozza; deve essere verificata anche nel deploy del frontend. La PR #258 in produzione resta invariata fino a eventuale merge separato. In caso di problema, revert della sola PR #264, senza manipolare utenti o voti, e monitoraggio HTTP 403/500, tempi di salvataggio, errori di pool e revoca.
