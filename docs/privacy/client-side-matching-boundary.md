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
- confronta il vettore del cittadino con vettori di figure pubbliche e restituisce solo id pubblici e punteggi aggregati.

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
