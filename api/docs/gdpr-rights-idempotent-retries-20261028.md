# DEMOS — retry idempotente delle richieste GDPR (28 ottobre 2026)

**Stato: DRAFT / NO-GO.** Ramo derivato direttamente dalla PR #375, separato dalle PR B2/ledger #366–#374. Nessun merge, deploy, migrazione, schema reale o credenziale. Soltanto test sintetici.

## Contratto

La route autenticata `POST /api/user/gdpr-requests` accetta **facoltativamente** l'header:

```http
Idempotency-Key: ee500c1a-b5a7-4c0a-9de2-d0e60e5a1a31
```

L'header deve essere un UUID v4 generato dal **client** usando una sorgente crittografica. Il client deve riutilizzare **lo stesso valore e lo stesso identico payload** per ogni retry del medesimo tentativo, anche dopo una risposta HTTP incerta. Per una **nuova** richiesta, anche dello stesso tipo, il client deve usare un **nuovo UUID**. Non usare timestamp, ID di sessione o il nome/email dell'utente come chiave.

Si sfrutta la PK UUID `id` già presente su `public.user_rights_requests`, senza aggiungere indici o colonne. Il backend:

1. Controlla autenticazione, categoria, lunghezza del payload e UUID prima di interpellare PostgreSQL.
2. Esegue `INSERT (id,user_id,request_type,request_data,status) ... ON CONFLICT(id) DO NOTHING RETURNING...`. L'unicità del database serializza anche i tentativi contemporanei.
3. Se riceve una riga da `RETURNING`, la richiesta è nuova: HTTP **201** con ID reale.
4. Altrimenti effettua una SELECT **successiva**, in un nuovo snapshot `READ COMMITTED`, vincolata contemporaneamente a **id, utente autenticato, tipo e JSONB del payload**. Solo una corrispondenza completa restituisce HTTP **200** con l'ID originale e lo **stato attuale** della richiesta (anche `processing`/`completed`).
5. Se la chiave esiste ma appartiene a un altro utente o a un payload differente, oppure la SELECT non è autorizzata da RLS, risposta **409** senza divulgare se e a chi appartenga un eventuale record. Un errore SQL/connessione produce 503, senza un successo inventato.
6. UUID malformati producono HTTP **400**, prima di ogni query.

I chiamanti **legacy senza header** continuano a produrre una nuova richiesta a ogni invio. Questo è intenzionale per retrocompatibilità: **senza una chiave persistente client-side, non c'è garanzia di idempotenza tra retry**.

## Prove

- `api/tests/gdprLegacyRequestsRoute.test.js`: mock dei due percorsi di risposta (201 nuovo; 200 retry che conserva l'ID originale e lo stato eventualmente avanzato); rifiuto di chiavi riutilizzate con utente/payload diverso e di UUID malformati prima delle query.
- `api/tests/gdprLegacyRequestsPg17.test.js`: PostgreSQL 17 **usa-e-getta** di GitHub Actions, nessuna Supabase/Render/B2. **Tre POST paralleli** con la stessa chiave devono creare **una sola riga** (un 201 + due 200); tentativi con utente o payload diverso ricevono 409; una riga inserita e committata da PostgreSQL senza ricevuta HTTP viene recuperata da una nuova POST con la stessa chiave e riceve HTTP 200.
- Restano attivi tutti i test precedenti su TLS, pool canonico, RLS negata e storico non presentato come completo.

## Cosa manca ancora

- Non abbiamo individuato sul frontend attuale un invio di `POST /api/user/gdpr-requests`. La pagina `client/src/pages/GDPRRights.tsx` consulta **`GET /api/user/rights-requests`**, esposto dal diverso modulo `api/routes/user/gdpr-rights.js`; la pagina mostra solo uno storico. **Questa PR corregge anche questo percorso di sola lettura**, ma non promette idempotenza di endpoint differenti.
- Un futuro client che invia domande GDPR tramite questa route dovrà generare e riutilizzare la stessa `Idempotency-Key` senza memorizzare testo sensibile più a lungo del necessario. Gli utenti non devono essere istruiti a provare chiamate HTTP a mano.
- La successiva verifica dell'identità SQL **effettivamente usata da Render**, delle policy RLS compatibili e della presa in carico DPO rimane obbligatoria.
- Questo meccanismo non rende automaticamente idempotenti le cancellazioni dell'account o le esportazioni che utilizzano `/api/user/gdpr-rights`; richiedono analisi dedicata.
- Recupero GDPR #296 **NO-GO**: il journal B2 esterno non è stato attestato e manca la prova completa di restore in quarantena.

**Nessun rilascio automatico.**

## Verifica del vero percorso utente per lo storico GDPR

Durante la ricognizione è emerso che la pagina corrente usa un endpoint diverso dalla nuova POST idempotente. Prima della correzione:

- `GET /api/user/rights-requests` poteva restituire un insieme **RLS-filtrato** apparentemente completo; il browser non aveva modo di distinguere zero righe visibili da zero richieste reali;
- `client/src/pages/GDPRRights.tsx` non impostava un messaggio d'errore quando HTTP falliva, mantenendo `requests=[]` e quindi mostrando «Nessuna richiesta presente» anche se il database non era accessibile.

La PR include ora un controllo conservativo con `pg_catalog.row_security_active` nel **vero** handler `gdpr-rights.js`. Un ruolo SQL con visibilità filtrata produce **HTTP 503** anziché uno storico parziale. La pagina React verifica status HTTP, `success=true` e `data` array; solo dopo una risposta verificata rende «Nessuna richiesta presente». Per un errore o risposta non valida visualizza «Storico non disponibile» con un avviso, senza scrivere payload personali in console.

Questo comportamento **non fornisce una policy RLS nuova** né autorizza un bypass: finché Render non dispone di una modalità di lettura sicura e verificata, l'utente può vedere uno stato di indisponibilità anziché uno storico. Questo è un gate operativo aperto, non una funzione dichiarabile GO.

**Verifiche CI:** sul commit `72d8b3f`, [workflow #40604819354](https://github.com/Nictolas/DemosApp/actions/runs/40604819354) **SUCCESS**, **16/16 test backend unitari, 1/1 integrazione PostgreSQL 17**, build Vite `client` **SUCCESS**; [Legacy Menu #40604819292](https://github.com/Nictolas/DemosApp/actions/runs/40604819292) **SUCCESS**; Snyk **SUCCESS**. Nessuna chiamata a database o storage di produzione.

**Rimane da validare prima del rilascio** la navigazione/login Android/iOS, il contratto del frontend di invio delle richieste con `Idempotency-Key` stabile, il ruolo SQL reale usato da Render, le policy approvate per storico e INSERT, la presa in carico DPO e l'archivio/recovery B2 indipendente. Issue #296 resta **NO-GO**.

## CORS e retry browser (correzione su ramo Draft)

Il contratto `POST /api/user/gdpr-requests` accetta `Idempotency-Key`, ma il server usa una lista CORS esplicita degli header autorizzati. Senza l'header nella risposta al preflight `OPTIONS`, un browser cross-origin blocca la richiesta prima di raggiungere la route (anche con un UUID valido).

Su questa PR Draft, `api/app.js` ammette `Idempotency-Key` nella configurazione `cors()` e in entrambi i percorsi espliciti `Access-Control-Allow-Headers`. La lista delle **origini** consentite e la politica `credentials` restano invariate; non è introdotto alcun wildcard. La regressione riusa `api/tests/corsRenderFrontend.test.js` e viene richiamata dal workflow GDPR, che si attiva anche quando il target della PR stacked è diverso da `main`.

Questa correzione **non** equivale a implementare un client di invio delle richieste: quello richiede ancora la generazione e il riutilizzo affidabile del medesimo UUID per lo stesso tentativo.

## Retry della limitazione del trattamento (PUT)

Per `PUT /api/user/limit-processing` vale ora lo stesso header facoltativo `Idempotency-Key` UUID v4. Il server esegue modifica e ricevuta nella **stessa transazione**; se la PK della ricevuta esiste già, annulla **tutta** la modifica prima di verificare la ricevuta originale dello stesso utente e identico payload (escludendo la sola data tecnica della richiesta).

- Richiesta nuova confermata: HTTP 200 e ricevuta persistita.
- Retry con stessa chiave e stesso payload: HTTP 200, `replayed:true`, stesso `request_id` e `data:null`. La risposta **non** afferma che la vecchia limitazione sia ancora lo stato attuale dopo eventuali modifiche successive.
- Chiave già utilizzata per altro utente/payload: HTTP 409, rollback, nessuna ricevuta nuova né modifica allo stato.
- Errore SQL o ricevuta non verificabile: HTTP 503 senza falsa conferma; chiave non valida: HTTP 400 prima del DB.
- Client legacy senza header: comportamento precedente, ogni PUT è una nuova richiesta.

Il test PostgreSQL 17 sintetico copre risposta perduta, retry dopo una scelta successiva opposta, conflitto fra utenti/payload, tre chiamate concorrenti con una sola ricevuta e rifiuto di UUID malformati. Non è una verifica di ACL/RLS del vero writer Render.

## Retry dell'opposizione al trattamento (POST)

Anche `POST /api/user/object` supporta `Idempotency-Key` UUID v4 facoltativa, riusata soltanto per il medesimo tentativo. Una `INSERT ... ON CONFLICT (id) DO NOTHING` sfrutta la PK esistente, senza DDL. Un conflitto viene riconosciuto con una seconda SELECT nello snapshot successivo, vincolata a **ID, utente, tipo di richiesta e contenuto JSONB** (esclusa la data tecnica). Un duplicato verificato restituisce HTTP 200, `replayed:true` e la ricevuta originale; collisioni diverse producono 409 senza rivelare altri utenti. Errori del database non producono falsi successi. Un replay non produce un secondo audit log.

La prova PostgreSQL 17 sintetica include tre richieste simultanee con una sola ricevuta persistita, retry dopo risposta HTTP incerta, rifiuto di UUID malformati e collisioni tra utente/payload diversi. La gestione DPO effettiva e le policy SQL reali rimangono NO-GO senza attestazioni.
