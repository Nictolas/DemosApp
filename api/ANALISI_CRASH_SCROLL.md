# Analisi crash allo scroll – report

## Sintomo
L’app crasha quando l’utente scrolla, su più pagine (es. Notifiche, e altre). Il problema si manifesta “in tutta l’app” quando si usa lo scroll.

## Cause individuate

### 1. **Backend: troppe query per richiesta (N+1 e query di debug)**

Quando una pagina con lista (Notifiche, Iniziative, Referendum, ecc.) viene caricata o aggiornata, il backend esegue molte query. In presenza di N+1 o di query di debug ripetute, ogni richiesta può arrivare a decine di query. Con più utenti o refetch frequenti (polling, refetch al focus, al mount), il **pool di connessioni** si satura → timeout → crash.

- **GET /api/notifiche** (già corretto): c’era un ciclo che faceva una query per ogni notifica per i dati del politico (N+1). È stato sostituito con 1–2 query batch.
- **GET /api/iniziative-popolari**:  
  - Per ogni “voto utente” non presente in lista (max 1) viene fatto un loop con **fino a 6 query** (ministero per id, per id senza trattini, popolari per id, per id senza trattini, per uuid, per nome).  
  - In più ci sono **query di debug** eseguite a ogni richiesta (es. quando `votaOnly` e risultati vuoti: 2 query extra; query “voti totali” e voti utente anche quando non servono).  
  - Effetto: molte query per singola richiesta; con scroll/refetch si moltiplicano.
- **GET /api/referendum-abrogativi**: in un ramo (classifica da `normalizedData`) viene usato `Promise.all(normalizedData.map(async ref => pool.query(...)))`: **una query per ogni referendum**. Con 20–50 referendum sono 20–50 query in parallelo per una sola risposta → saturazione del pool.
- **Altre route con loop + query** (meno critiche per lo scroll ma da tenere d’occhio):  
  - `comunicazioni.js`: POST con `for (voto of voti)` e 2–3 query per voto.  
  - `sondaggi.js`: `for (opinione of opinioni)` con query per opinione.  
  - `candidati.js`: `Promise.all(candidati.map(...))` con una query per candidato.

### 2. **Frontend: refetch frequenti e poca cache**

- **Notifiche**: `refetchInterval: 60000` (1 min) + nessun `staleTime` → refetch ogni minuto e dati considerati subito “stale”.
- **Notification badge**: `refetchInterval: 30000`, `staleTime: 15000` → refetch ogni 30 s.
- **Utenti / GestisciUtenti**: `refetchOnMount: true`, `staleTime: 0`, `refetchInterval: 30 * 1000` → refetch ad ogni mount e ogni 30 s.
- **VotiParlamento**: `staleTime: 0` → dati sempre considerati stale, più refetch del necessario.

Lo scroll in sé **non** chiama API (il layout usa solo `setIsNavbarVisible` con throttling). Però:
- Se lo scroll causa ri-mount di componenti (es. lista virtuale, cambio route), le query con `refetchOnMount: true` o `staleTime: 0` rifanno subito una richiesta.
- Con `refetchInterval` corti, più tab/pagine aperte moltiplicano le richieste.
- Ogni richiesta, se lato backend è pesante (N+1, debug), consuma connessioni e CPU → rischio crash quando ci sono picchi (es. molti utenti che scrollano e ricevono refetch).

### 3. **Pool database e connessioni**

- Pool configurato con `max: 100`, `min: 10`.  
- Se ogni richiesta “pesante” tiene occupata una connessione a lungo (molte query in sequenza) o se ci sono N+1 che aprono molte query in parallelo, le connessioni si esauriscono.  
- In `database.js` c’è già un avviso se utilizzo > 90%.  
- `pool.connect()` usato in varie route: dove non c’è `finally { client.release() }` si possono avere leak. In `iniziative-popolari` POST/PUT/vota/delete il `finally` con `client.release()` è presente.

### 4. **Eventi non gestiti (unhandledRejection)**

In produzione, `server.js` fa `process.exit(1)` su `unhandledRejection`. Se una promise async (es. dentro un `setInterval` o una route) fallisce senza `.catch()`, il processo termina → crash “a caso”, che l’utente può associare allo scroll perché è quando interagisce di più.

---

## Interventi consigliati (in ordine di priorità)

1. **Backend**
   - **GET /api/iniziative-popolari**:  
     - Sostituire il loop su `mieiVoti` con 1–2 query batch (es. tutti gli id in `mieiVoti` in un’unica `WHERE id = ANY($1)` per ministero e popolari).  
     - Ridurre o eliminare le query di debug eseguite a ogni richiesta (o limitarle a `NODE_ENV !== 'production'`).
   - **GET /api/referendum-abrogativi**:  
     - Sostituire `Promise.all(normalizedData.map(...))` con una singola query che restituisce i conteggi per tutti gli id (es. `WHERE referendum_id = ANY($1)` + `GROUP BY referendum_id`) e costruire la classifica in memoria.
   - Mantenere le correzioni già fatte su **GET /api/notifiche** (batch politici).
   - Verificare che tutte le route che usano `pool.connect()` abbiano `try/finally` con `client.release()`.

2. **Frontend**
   - Aumentare `staleTime` per le query “liste” (notifiche, iniziative, referendum) per ridurre refetch inutili (es. 1–2 minuti).
   - Valutare di aumentare leggermente `refetchInterval` per notifiche/badge (es. 60 s invece di 30 s) dove accettabile per l’UX.
   - Evitare `refetchOnMount: true` + `staleTime: 0` sulle liste grandi; usare almeno un breve `staleTime` o `refetchOnMount: false` quando i dati sono già in cache.

3. **Monitoraggio**
   - Tenere attivo l’avviso di saturazione pool in `getPoolStats()`.
   - In produzione, loggare (senza riempire i log) errori di tipo “timeout” o “connection” per individuare endpoint che saturano il pool.

---

## Riepilogo

I crash “quando si scrolla” sono spiegati da:
- **Backend**: troppe query per richiesta (N+1 e debug) → pool saturo e timeout.
- **Frontend**: refetch frequenti e poca cache → più richieste quando l’utente è attivo (scroll, cambio tab, ritorno alla pagina).
- **unhandledRejection** in produzione che fa terminare il processo.

Riducendo N+1 e query di debug e moderando i refetch lato client, i crash allo scroll dovrebbero ridursi o scomparire.
