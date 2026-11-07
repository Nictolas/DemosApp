# DEMOS 12 — Protocollo verificabile DSAR e rilascio Grazia/Nomine (07/11/2026)

Stato: **procedura proposta, NON prova di esecuzione**. Ambito: PR Draft #502, senza accesso a record reali, senza invio email e senza modifiche allo staging unico DEMOS 10.

## Dati minimi del registro DSAR (senza dati sensibili nel repository)
- ID casuale della pratica; data/ora ricezione; canale; categoria richiesta; operatore responsabile; stato; data limite e motivazione di eventuale proroga; esito e data chiusura.
- Mai riportare nei log GitHub nomi, email, documenti, voti, reati, allegati o contenuti delle richieste.
- Le evidenze con dati personali restano nel canale riservato autorizzato, non negli Sheet pubblici.

## Matrice di accettazione: usare esclusivamente identità e nominativi sintetici
| Caso | Stimolo | Esito verificabile | Stato |
|---|---|---|---|
| DSAR-01 ricezione | Messaggio di test alla casella privacy@demos.community, **solo previa autorizzazione specifica** | Ricezione effettiva, inoltro, timestamp e presa in carico da umano | NON ESEGUITO |
| DSAR-02 identità | Richiesta sintetica da account noto e da terzo non autenticato | Verifica proporzionata, nessuna divulgazione al terzo, tracciamento decisione | NON ESEGUITO |
| DSAR-03 accesso | Istanza sintetica di accesso | Risposta limitata ai dati dell'interessato, senza voti o nominativi di altri | NON ESEGUITO |
| DSAR-04 rettifica | Nominativo sintetico errato nella directory | Rettifica approvata, propagata a API, UI e cache; nessuna riemersione | NON ESEGUITO |
| DSAR-05 opposizione/cancellazione | Richiesta sintetica per voce pubblicata | Sospensione visibilità ove dovuta, decisione motivata, gestione copie e backup | NON ESEGUITO |
| DSAR-06 chiusura | Pratica sintetica completa | Comunicazione finale umana, scadenze e registro minimo verificati | NON ESEGUITO |
| RP-18/19/20 retention | Voci sintetiche in stati pending/approved/withdrawn | Durate approvate per stato, trigger, cancellazione e non-riemersione | NON ESEGUITO |

## Gate legali separati dai test software
1. **Art. 5/6**: matrice finalità × campi × base giuridica, necessità, minimizzazione e limiti di conservazione approvati dal titolare.
2. **Art. 9**: valutazione motivata se nomine e contesto permettano inferenze politiche; condizione applicabile documentata prima della pubblicazione.
3. **Art. 10**: per Grazia, verifica giuridica italiana specifica; fonte giornalistica pubblica non basta di per sé.
4. **Art. 14**: informativa per dati non raccolti presso l'interessato; tempi, destinatari ed eventuali eccezioni motivate caso per caso.
5. **Art. 35**: screening DPIA firmato, DPIA completa se emerge rischio elevato.
6. **Rilascio**: solo dopo prove DSAR, retention, staging coordinato con DEMOS 10 e Android fisico; nessuna CI verde sostituisce questi gate.

## Sequenza di esecuzione autorizzata
Prima: approvare base giuridica, informative, durata e screening. Poi: eseguire DSAR-02..06 e RP-18..20 su fixture isolate; conservare solo conteggi, hash commit, ID run e PASS/FAIL. Infine: richiedere coordinamento staging DEMOS 10 e test Android reale. DSAR-01 richiede autorizzazione specifica all'invio e verifica umana della consegna. In caso di fallimento, mantenere **NO-GO**.

## Evidenza tecnica corrente
Al controllo del 07/11/2026: PR #502 OPEN/DRAFT, HEAD `51ce704c03f0246e4ce939f6d36016aa71ac1ca8`, 15/15 workflow GitHub Actions conclusi con successo. Questo documento è una specifica operativa, non una validazione dei gate.
