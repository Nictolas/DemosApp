# DOC-064 · Interruzione del fallback di Sondaggi a metà esecuzione

**Data:** 24 ottobre 2026. **Ambito:** PR [#258](https://github.com/Nictolas/DemosApp/pull/258) (DRAFT, nessun merge o deploy della nuova modifica).

## Problema residuo da DOC-063

Il precedente controllo fermava il passaggio iniziale alle query per-opinione in presenza di problemi di connessione, permessi, timeout e overload. Se la procedura legacy veniva avviata per un errore SQL statico compatibile e il guasto compariva **dopo il primo risultato**, il ciclo poteva ancora ignorare l'errore e continuare fino alla fine del catalogo, sottoponendo il database a molte richieste aggiuntive e rendendo possibile una risposta con statistiche parziali.

## Correzione

Il file `api/utils/sondaggiTextBulk.js` distingue ora due situazioni **all'interno** di entrambi i cicli di fallback (nazionale e territorio):

- SQLSTATE `42703` (*undefined_column*): una colonna di opinione può essere stata rimossa dopo la verifica dello schema. Si può proseguire con la prossima colonna, mantenendo la soglia di almeno 10 consenzienti per ciascuna statistica pubblicata.
- Ogni **altro** errore durante il fallback (inclusi `53300`, `57014`, `08006`, `42501`, `ECONNRESET`, e anche incompatibilità non risolvibili): **interrompere subito il ciclo** e propagare l'errore. I gestori HTTP esistenti restituiscono `500` senza il corpo `data.stats`; le statistiche accumulate in memoria non vengono pubblicate.

Questo evita la tempesta di query *dopo un guasto* durante il fallback, senza modificare le normali richieste SQL aggregate, il formato TEXT, le API e la logica di consenso.

## Prove aggiunte

`api/tests/sondaggiTextBulk.test.js` verifica:

1. Interruzioni per cinque categorie di errori a metà fallback, sia nella lettura dei metadati sia nell'aggregazione per-colonna, sui quattro ambiti (**40 combinazioni**): nessuna nuova query per le opinioni successive.
2. Colonna rimossa con SQLSTATE `42703`: il catalogo continua, la cella mancante non è pubblicata e le celle sotto soglia restano nascoste.
3. GET HTTP reale tramite Express e fake pool, per nazionale, regionale, provinciale e comunale: un errore `08006` dopo un primo risultato del fallback produce HTTP `500` senza statistiche parziali.

Tutti i dati e gli errori dei test sono inventati. Non effettuano query verso Supabase reale o Render e non modificano dati utenti.

## Limitazioni

La lista di SQLSTATE che **autorizza ad avviare** il fallback rimane quella di DOC-063, e la modalità legacy può essere costosa se il database è disponibile ma una funzionalità SQL aggregata è davvero incompatibile. Questi test non stimano throughput al milione di utenti, costi Free, p50/p95 HTTP su Render collegato a Supabase né conformità privacy complessiva.

Lo staging Render resta in modalità `setup-only` e il ruolo PostgreSQL è `NOLOGIN`. Per il benchmark HTTP collegato rimane necessario configurare in modo autorizzato le credenziali temporanee direttamente nei provider (mai in chat), come indicato in `sondaggi-render-http-staging-handoff-20261024.md`.

**Stato:** OP-37 in corso; OP-36 e KPI-20 completi solo per benchmark SQL isolati, non HTTP end-to-end. PR #258 DRAFT; PR #247 sul formato 2-bit non coinvolta. Nessun deploy produzione.
