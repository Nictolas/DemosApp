# Boundary del matching privacy-first lato client

## Stato

Questo scaffold **NON è collegato al flusso di produzione** e non modifica il matching attuale.

Il matching legacy continua oggi a leggere le risposte politiche del cittadino nel backend identificato. Questo rimane un debito architetturale esplicito e impedisce di considerare completata la separazione Identity/Research.

## Obiettivo del nuovo boundary

Il modulo `client/src/lib/privacy/clientMatching.js` è un motore puro in memoria:

- riceve soltanto il vettore politico già disponibile sul dispositivo;
- non accetta `userId`, account id, email o altri identificatori del cittadino;
- non esegue richieste di rete;
- non usa storage persistente;
- non scrive log;
- confronta il vettore del cittadino con vettori di figure pubbliche identificati solo da handle opachi e temporanei;
- restituisce soltanto gli handle dei migliori match e punteggi aggregati, mai ID stabili della figura pubblica.

Il backend identificato **non deve ricevere il vettore politico** del cittadino per eseguire questo calcolo.

## Feature flag

La futura integrazione è protetta dal flag:

```
VITE_PRIVACY_CLIENT_MATCHING=false
```

L'assenza del flag equivale a `false`. Il flag non è ancora letto da alcun hook di matching live.

## Condizioni prima dell'attivazione

Prima di impostare il flag a `true` devono essere soddisfatte e verificate tutte queste condizioni:

1. il vettore politico del cittadino non è più recuperato dal backend Identity mediante `userId`;
2. il dispositivo può ottenere le proprie risposte tramite il boundary Research/credenziale unlinkable o altro meccanismo equivalente non identificante;
3. i dati politici delle figure pubbliche necessari al confronto arrivano da una superficie che non riapre una directory generica di politici/candidati agli utenti;
4. nessuna richiesta di matching invia al backend identificato le risposte del cittadino;
5. i risultati mostrati all'utente restano limitati al flusso di matching;
6. i test di regressione privacy e il Security gate sono verdi.

## Non-obiettivi di questo checkpoint

Questo checkpoint non migra dati, non applica SQL, non modifica RLS/grants, non crea servizi, non cambia endpoint di produzione e non rimuove ancora il matching legacy.


## Boundary figure pubbliche: bundle opaco

Il servizio `api/services/publicFigureMatchBundlePolicy.js` definisce il contratto per una futura superficie di matching senza directory:

- il server parte dagli ID reali delle figure pubbliche ma li trasforma in `matchHandle` HMAC dipendenti dal contesto;
- lo stesso ID produce un handle diverso in un contesto diverso;
- il bundle destinato al client contiene solo `matchHandle` e vettore politico;
- nome, cognome, email, slug e ID stabile non vengono inclusi nel bundle;
- il client usa solo gli handle per il ranking;
- la futura richiesta di reveal può contenere al massimo 4 handle unici e non può contenere il vettore del cittadino.

Questo riduce il rischio che la superficie usata per il matching diventi una directory direttamente navigabile. Prima della produzione resta necessario implementare un contesto one-shot/anti-enumerazione: il server dovrà impedire reveal ripetuti dello stesso contesto per risolvere progressivamente tutti gli handle.

Lo scaffold non espone ancora alcuna route HTTP per bundle o reveal.


## Boundary vettore cittadino Research

Lo scaffold Research definisce anche il contratto di lettura del vettore politico del partecipante senza account Identity.

Il servizio `researchOpinionVectorService`:

- accetta una chiave pubblica pseudonima Ed25519 già registrata in `research.participants`;
- richiede una firma su una challenge fresca con purpose fisso `read-opinions-v1`;
- fallisce prima di interrogare il database se la prova non è valida o la challenge non è fresca;
- rifiuta output del verifier che contengano riferimenti Identity;
- legge soltanto `research.current_opinion_responses` tramite la chiave partecipante;
- restituisce al chiamante esclusivamente la mappa `question_id -> answer_code`;
- non restituisce `participant_id`, chiave pubblica, account, email o altri identificatori;
- non usa JWT Demos, il database Identity, Firebase o callback verso Identity.

Questo checkpoint non espone ancora una route HTTP. Prima di esporla serve un challenge store Research one-shot con scadenza breve e consumo atomico; il verifier reale dovrà marcare `challengeFresh=true` solo dopo tale consumo.


## Challenge Research one-shot

Lo scaffold definisce ora anche la freshness concreta della prova partecipante:

- il client riceve 32 byte casuali codificati base64url;
- nel database Research viene salvato solo SHA-256 della challenge, mai il valore raw;
- TTL consentito: 30–300 secondi, default 120;
- la challenge non contiene e non è associata a participant id, chiave pubblica, account o email;
- dopo una firma valida, il verifier esegue un singolo `DELETE ... WHERE challenge_digest = ... AND expires_at > NOW() RETURNING`;
- il primo consumo valido ottiene `challengeFresh=true`; ogni replay successivo ottiene `false`;
- una firma non valida non consuma la challenge, evitando che un attaccante possa bruciarla senza possedere la chiave.

La tabella `research.proof_challenges` è stata aggiunta soltanto allo schema shadow di progetto. **Non è stata applicata a Supabase/produzione** e nessuna route HTTP di challenge o lettura opinioni è ancora montata.
