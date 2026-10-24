# DEMOS · Sondaggi, verifica PostgreSQL su Demos-Staging — DOC-058

Data: 24 ottobre 2026. **PR #258 ancora DRAFT e non distribuita.**

## Ambito e isolamento

- Database interessato: progetto Supabase **Demos-Staging** (`fkeayjzvtuvzesljhjbc`, PostgreSQL 17, UE); **NON** il progetto `Demos` di produzione (`wxnblcqoyjqxktwkcqok`).
- Schema creato **soltanto nello staging**: `op37_sondaggi_ci`, con 1.200 account inventati, 1.200 righe di risposte TEXT e 94 quesiti, di cui uno non pubblicato (93 valutati).
- Le quattro tabelle hanno RLS attivata senza policy di lettura pubbliche. I ruoli `anon`, `authenticated` e `service_role` non hanno `USAGE` sullo schema; il test ha confermato il rifiuto dei permessi anche sulla funzione di benchmark. Lo schema `public` dello staging rimane vuoto.
- Nessun utente DEMOS, account reale, servizio Render, endpoint HTTP o credenziale di produzione coinvolto.
- Script riproducibili nella PR: [schema e seed](../staging/op37_sondaggi_private_synthetic.sql) e [funzione di confronto](../staging/op37_compare_staging_sql.sql). Sono stati applicati **esclusivamente** al progetto staging; non rieseguirli in produzione.

## Risultato su Supabase staging

Il confronto `SELECT * FROM op37_sondaggi_ci.compare_sql_modes_ci(8)`
è stato eseguito con otto ripetizioni misurate per modalità e ambito, precedute dal warm-up; esecuzione alternata delle due modalità.

| Ambito | Query vecchio → nuovo | Mediana vecchio | Mediana nuovo | p95 vecchio | p95 nuovo |
| --- | --- | ---: | ---: | ---: | ---: |
| Nazionale | 187 → 3 | 110,503 ms | 21,771 ms | 110,931 ms | 22,828 ms |
| Regionale | 187 → 3 | 110,408 ms | 12,279 ms | 112,802 ms | 12,347 ms |
| Provinciale | 187 → 3 | 116,959 ms | 22,751 ms | 117,233 ms | 22,944 ms |
| Comunale | 187 → 3 | 166,558 ms | 22,965 ms | 166,888 ms | 23,306 ms |

Le statistiche pubblicabili (`f/c/i`) erano identiche nelle due modalità per ciascuno dei quattro ambiti. Lo slot sintetico con 10 consenzienti diventa non pubblicabile dopo una **revoca simulata in SELECT** che lo riduce a 9; non sono stati modificati voti o consensi per questa prova.

**Cosa rappresentano i tempi:** il benchmark gira come funzione sul server PostgreSQL di Demos-Staging e cronometra le istruzioni SQL, compresa la logica PL/pgSQL della procedura sperimentale. Non misura la latenza fra Render e Supabase, l'HTTP dell'app, rete mobile, login, cache, RLS di produzione, esecuzione delle route JavaScript, cold start né concorrenza con utenti reali. È quindi una conferma sul **database staging reale con dati sintetici**, non un benchmark della versione completa di DEMOS.

La replica nella CI GitHub Actions con client Node e PostgreSQL17 locali rimane disponibile al run [40110585695](https://github.com/Nictolas/DemosApp/actions/runs/40110585695); è una misurazione diversa e non va confusa con i tempi sopra.

## Stato rispetto all'eventuale rilascio

Sono verificati: aggregazione SQL su quattro ambiti, parità degli aggregati, riduzione delle interrogazioni, schema staging privato e soglia 10→9 simulata. **Non** sono verificati: deploy del ramo della PR #258 su un servizio Render isolato con credenziali esclusivamente staging, misure end-to-end p50/p95 via HTTP, comportamento con dati realistici sotto carico, privacy e autenticazione in ambiente applicativo staging, rollback.

Non collegare il servizio già esistente `demos-functional-staging` a database differenti né creare un servizio Render che possa ereditare variabili d'ambiente di produzione senza averne verificato le credenziali. Non introdurre un nuovo servizio a pagamento, non modificare production e non mergiare automaticamente.

**Tracciamento:** OP-37 *In corso*; OP-36 in verifica **solo per la componente DB staging**; OP-39 *Da fare* per l'applicazione staging; KPI-19 valore 187→3 verificato anche su DB staging, KPI-20 latenza **SQL DB** misurata e latenza **HTTP end-to-end** non verificata. PR #247 (codifica 2 bit) resta separata e DRAFT.
