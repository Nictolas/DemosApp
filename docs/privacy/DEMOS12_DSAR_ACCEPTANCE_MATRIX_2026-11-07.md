# DEMOS 12 — Protocollo verificabile DSAR e rilascio Grazia/Nomine (07/11/2026)

Stato: **procedura proposta, NON prova di esecuzione dei gate ancora aperti**. Ambito: PR Draft #502, senza accesso a record reali, senza nuovi invii email e senza modifiche allo staging unico DEMOS 10. Una prova storica di recapito tecnico DSAR-01, già autorizzata e verificata il 06/11/2026, è documentata nel runbook dedicato.

## Dati minimi del registro DSAR (senza dati sensibili nel repository)
- ID casuale della pratica; data/ora ricezione; canale; categoria richiesta; operatore responsabile; stato; data limite e motivazione di eventuale proroga; esito e data chiusura.
- Mai riportare nei log GitHub nomi, email, documenti, voti, reati, allegati o contenuti delle richieste.
- Le evidenze con dati personali restano nel canale riservato autorizzato, non negli Sheet pubblici.

## Matrice di accettazione: usare esclusivamente identità e nominativi sintetici
| Caso | Stimolo | Esito verificabile | Stato |
|---|---|---|---|
| DSAR-01 ricezione | Prova sintetica Outlook → alias Porkbun → Gmail già effettuata il 06/11/2026 con autorizzazione | INBOX del destinatario e header RFC822 con percorso di inoltro verificato; non equivale a presa in carico umana | **PASS SOLO RECAPITO TECNICO**; presa in carico da testare |
| DSAR-02 riscontro | Simulare apertura pratica e primo riscontro su canale autorizzato, senza nuovi invii fino ad autorizzazione | Operatore umano designato, prova di ricezione/risposta e nessuna diffusione di dati terzi | **NON ESEGUITO** |
| DSAR-03 identità | Simulare richiesta da account proponente, persona nominata e soggetto estraneo | Verifica di legittimazione proporzionata; nessuna divulgazione a non aventi diritto | **NON ESEGUITO** |
| DSAR-04 rettifica / ritiro | Segnalare nominativo sintetico inesatto o pubblicazione contestata | Decisione umana motivata; ritiro o rettifica sulla coda corretta; esclusione da API, UI e cache; audit minimo | **SOLO PROVE DI CODICE PARZIALI**, workflow umano non eseguito |
| DSAR-05 termini | Registrare una pratica fittizia con data, scadenza e possibile proroga motivata | Monitorare il mese ordinario, notificare eventuale proroga entro il primo mese, documentare il riscontro finale | **SOLO TEST SINTETICI DI CALCOLO**, flusso umano non eseguito |
| DSAR-06 conservazione | Chiusura pratica e allegati di prova interamente fittizi | Durate RP-18/19/20 approvate dal titolare, cancellazione documentata di materiale eccedente e backup valutati | **NON APPROVATO / NON ESEGUITO** |
| RP-18/19/20 retention | Voci sintetiche in stati pending/approved/withdrawn | Durate approvate per stato, trigger, cancellazione e non-riemersione | NON ESEGUITO |

## Gate legali separati dai test software
1. **Art. 5/6**: matrice finalità × campi × base giuridica, necessità, minimizzazione e limiti di conservazione approvati dal titolare.
2. **Art. 9**: valutazione motivata se nomine e contesto permettano inferenze politiche; condizione applicabile documentata prima della pubblicazione.
3. **Art. 10**: per Grazia, verifica giuridica italiana specifica; fonte giornalistica pubblica non basta di per sé.
4. **Art. 14**: informativa per dati non raccolti presso l'interessato; tempi, destinatari ed eventuali eccezioni motivate caso per caso.
5. **Art. 35**: screening DPIA firmato, DPIA completa se emerge rischio elevato.
6. **Rilascio**: solo dopo prove DSAR, retention, staging coordinato con DEMOS 10 e Android fisico; nessuna CI verde sostituisce questi gate.

## Sequenza di esecuzione autorizzata
Prima: approvare base giuridica, informative, durata e screening. Poi: eseguire DSAR-02..06 e RP-18..20 su fixture isolate; conservare solo conteggi, hash commit, ID run e PASS/FAIL. Infine: richiedere coordinamento staging DEMOS 10 e test Android reale. Il recapito tecnico DSAR-01 è già verificato nel runbook del 06/11; non ripetere l'invio senza una nuova necessità e autorizzazione specifica. Il riscontro operativo DSAR-02 resta da provare separatamente. In caso di fallimento, mantenere **NO-GO**.

## Evidenza tecnica corrente
Verifica di riconciliazione 07/11/2026: DSAR-01 **PASS solo recapito tecnico** sulla prova già registrata nel documento `docs/privacy/DEMOS12_GRAZIA_DSAR_RUNBOOK_2026-11-05.md` (sezione 06/11 Outlook→Porkbun→Gmail). Le attività DSAR-02..06 restano aperte: le prove sintetiche di codice non sono prova della procedura umana. La CI e il numero di commit vanno verificati sul nuovo HEAD della PR; questo documento non autorizza trattamento o rilascio.
