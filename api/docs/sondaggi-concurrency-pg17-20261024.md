# DOC-072 — Concorrenza HTTP Sondaggi e limite del pool, solo CI sintetica

24 ottobre 2026 · [PR #258](https://github.com/Nictolas/DemosApp/pull/258) ancora DRAFT. Nessuna modifica alla produzione. **Non è un benchmark Render/Supabase**.

## Ambito e isolamento

Lo script `api/scripts/benchmark-sondaggi-concurrency-ci.js`, eseguito nel workflow [GitHub Actions #40134250719](https://github.com/Nictolas/DemosApp/actions/runs/40134250719), crea un database **separato e temporaneo** `sondaggi_concurrency_ci` sul PostgreSQL 17 del runner GitHub Actions. Le guardie rifiutano credenziali e host che non corrispondano all'istanza CI `127.0.0.1:5432`, e rifiutano variabili di produzione o Render/Supabase. I 10.000 account, 94 colonne di risposte TEXT e preferenze geografiche sono interamente inventati.

La prova impiega le vere route Express di `api/routes/sondaggi.js` sui quattro ambiti geografici. Usa un pool locale con **max 3 connessioni**, una query catalogo + una metadata + una aggregazione per richiesta, con prove della SQL standard `lateral_default` e della variante `direct_filter_opt_in`. Quest'ultima viene abilitata **soltanto dentro il processo CI** e poi ripristinata. Su DEMOS e Render la variante continua a essere **spenta per impostazione predefinita**.

## Risultato verificato: richieste concorrenti

Workflow [#40134250719](https://github.com/Nictolas/DemosApp/actions/runs/40134250719) **SUCCESS**, marcatore `SONDAGGI_CONCURRENCY_PG17_PASS`, 80 richieste misurate per strategia, più 16 richieste per strategia dopo una revoca di consenso (192 GET misurate in totale, oltre ai warm-up). In ciascuna risposta la struttura JSON completa corrisponde al riferimento corretto; non compaiono cellule sotto la soglia di 10 risposte. Nessun errore HTTP; **3 query SQL per GET**.

| Client contemporanei | GET per variante | SQL predefinita p50 / p95 (ms) | SQL opt-in p50 / p95 (ms) | Max pool in attesa |
|---:|---:|---:|---:|---:|
| 1 | 12 | 26,17 / 69,88 | 24,30 / 45,97 | 0 |
| 4 | 12 | 57,45 / 102,83 | 43,73 / 85,97 | 1 |
| 8 | 24 | 119,36 / 172,31 | 95,96 / 136,95 | 5 |
| 16 | 32 | 214,70 / 284,00 | 190,64 / 232,26 | 13 |

`maxPoolConnections` non supera **3** e i tempi aumentano quando le connessioni sono occupate. `maxPoolWaiting` descrive il numero massimo di operazioni DB in coda, **non** il numero di utenti che DEMOS può supportare.

### CPU e RAM osservate

Queste metriche sono ricavate **solo dal processo Node di GitHub Actions**, non dal processo PostgreSQL o da Supabase. Sono campioni brevi, con variazioni dovute a JIT/GC e ordine di esecuzione, quindi non costituiscono stime di spesa né previsioni di saturazione.

| Client | Nodo SQL standard: picco RSS / CPU di processo | Nodo SQL opt-in: picco RSS / CPU di processo |
|---:|---:|---:|
| 1 | 86,52 MiB / 130,79 ms | 88,15 MiB / 44,89 ms |
| 4 | 78,90 MiB / 67,73 ms | 88,65 MiB / 46,77 ms |
| 8 | 83,53 MiB / 130,68 ms | 89,28 MiB / 111,72 ms |
| 16 | 87,15 MiB / 134,56 ms | 94,65 MiB / 118,99 ms |

Il fatto che alcuni picchi scendano passando da 1 a 4 client è **variabilità di campionamento**, non un reale calo di memoria necessario. La CPU del database PostgreSQL **non è stata misurata** in questo test. Non confondere tempi Node, CPU Postgres e limiti dei piani Free.

## Privacy dopo la concorrenza

Una delle opinioni sintetiche ha esattamente dieci consenzienti PERSON in tutti i territori testati. Dopo aver scritto **solo nella fixture CI** una revoca di uno di loro, 16 GET concorrenti per ciascuna strategia (quattro aree, 32 GET complessive) hanno verificato che l'opinione con nove risposte non sia più pubblicata. Le risposte della query standard e di quella alternativa mantengono la soglia di 10 e i medesimi filtri di consenso.

## Interpretazione e decisione

- **Le due strategie sono corrette** nel campione e per i livelli 1/4/8/16 client; la strategia SQL alternativa è mediamente più rapida in questa esecuzione, ma si era dimostrata più lenta con un piccolo dataset in DOC-068. **Non abilitarla di default**.
- Un pool ristretto limita le connessioni, ma a concorrenza elevata aumenta l'attesa. Non aumentare arbitrariamente `max`: va confrontato con le connessioni e la CPU effettive dello staging e le esigenze delle altre API.
- Il test non comprende autenticazione, RLS di produzione, proxy TLS Render↔Supabase, WAN da mobile, utenti simultanei su dispositivi reali, risposte reali, costi o capacità di 1 milione di utenti.
- Il precedente benchmark DOC-071 Render↔Supabase staging (12 campioni × quattro ambiti) è stato completato **senza carico concorrente**, poi il ruolo è stato riportato a `NOLOGIN PASSWORD NULL` e Render a `setup-only`. **Non riattivare automaticamente password o servizi**.
- PR #258 ancora **DRAFT**, nessun merge, nessun rilascio produzione o Android, nessuna migrazione 2-bit.

**Stato:** OP-37 chiusi gli esperimenti HTTP sequenziali e concorrenti su ambienti diversi; KPI-20 latenza HTTP staging sequenziale misurata ma non ancora con carico reale, OP-39 privacy e revisione pre-rilascio non dichiarate complete.
