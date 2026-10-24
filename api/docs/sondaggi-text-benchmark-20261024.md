# DEMOS / Sondaggi TEXT — OP-36/37 benchmark e limite staging

Data: 24 ottobre 2026. **PR #258 DRAFT, nessun deploy.**

## Situazione dell'ambiente staging

Con accesso di sola lettura agli ambienti esistenti:
- Render ha un servizio `demos-functional-staging` basato sul ramo `staging/functional-integration-v0`, non sulla PR #258.
- Supabase **Demos-Staging** (progetto `fkeayjzvtuvzesljhjbc`, PostgreSQL 17) è attivo, ma una verifica in sola lettura ha trovato **zero relazioni nello schema `public`**.
- Il database non contiene quindi lo schema Sondaggi da confrontare. Non sono stati creati dati, tabelle, progetti, rami, servizi o distribuzioni di staging. Nessun risultato del benchmark seguente va presentato come una misura del servizio Render/Supabase.

## CI comparativa controllata

Il workflow `Sondaggi TEXT aggregation regression`, run
[40110585695](https://github.com/Nictolas/DemosApp/actions/runs/40110585695),
è riuscito. Dopo le regressioni HTTP e di consenso da 10 a 9,
`api/scripts/benchmark-sondaggi-text-paired.js` confronta le stesse
query del percorso legacy e quelle aggregate, sullo **stesso insieme
inventato di 612 account, 94 colonne e 93 domande pubblicate** in
PostgreSQL 17 isolato.

Ogni condizione comprende warm-up e 12 ripetizioni per modalità
intercalate per diminuire la distorsione del riscaldamento della cache.
Tutte le risposte JSON e i filtri del benchmark sono confrontati per
uguaglianza, su quattro ambiti geografici.

| Ambito | Query legacy | Query nuovo | Mediana legacy | Mediana nuovo | p95 legacy | p95 nuovo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Nazionale | 187 | 3 | 200,231 ms | 15,776 ms | 211,938 ms | 18,606 ms |
| Regionale | 187 | 3 | 205,336 ms | 8,894 ms | 241,611 ms | 9,163 ms |
| Provinciale | 187 | 3 | 202,015 ms | 8,699 ms | 209,255 ms | 9,506 ms |
| Comunale | 187 | 3 | 204,277 ms | 8,800 ms | 259,222 ms | 11,076 ms |

È un confronto sulla stessa macchina CI con connessioni locali e
query eseguite in sequenza, **non** include HTTP WAN, cold start,
Render, autenticazione reale, Supabase/RLS o carichi elevati; non
costituisce uno SLA né una previsione del milione di utenti.

Per 94 domande *tutte* pubblicate, il massimo legacy dedotto dal
codice sarebbe 189 query (una catalogo + due per domanda). Questo
benchmark ha 93 domande pubblicate e dunque misura **187 → 3**.

## Passi prima dell'eventuale merge

1. Predisporre un ambiente **effettivamente separato e sicuro** con lo
   schema Sondaggi e dati sintetici rappresentativi; identificare una
   configurazione Render che ospiti esplicitamente il ramo della PR
   senza puntare inavvertitamente al database di produzione.
2. Misurare p50/p95, carico, query e risultati di vecchia e nuova
   implementazione sullo stesso staging. Annotare metodo di misura,
   build/commit, volumi, condizioni di cache e limiti.
3. Ripetere la verifica delle quattro route e della soglia privacy
   dopo revoca del consenso, eliminazione utente e cambi geografici.
4. Soltanto dopo, valutare merge e rollout su Render con smoke test.
   Non modificare Supabase, Android o dati reali durante la prova.

OP-37 **In corso**; OP-36 **Da fare** per staging rappresentativo;
KPI-19 **verificato in CI sintetica soltanto**; KPI-20 **staging da
misurare**; OP-39 **non chiuso**. La PR #247 (2 bit) resta separata
e congelata.
