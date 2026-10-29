# DOC-068 — SQL COUNT FILTER sperimentale, validato ma disattivato

**24 ottobre 2026 — PR [#258](https://github.com/Nictolas/DemosApp/pull/258), DRAFT.** Nessun merge o rilascio in produzione.

## Obiettivo

Valutare una query che aggrega direttamente gli stati `f/c/i` di ciascuna opinione **prima** di costruire le righe per opinione, evitando di espandere le risposte in `utente × opinione` prima del conteggio. Non cambia il formato TEXT, le risposte memorizzate o il contratto JSON.

La nuova funzione `buildDirectFilterTextAggregateQuery` è stata aggiunta a `api/utils/sondaggiTextBulk.js` con gli stessi controlli degli identificatori, whitelist contro le colonne effettive, parametri territoriali, esclusione degli account non PERSON, consenso politico e soglia di pubblicazione di almeno dieci. La selezione dipende **esclusivamente** dalla variabile server `SONDAGGI_EXPERIMENTAL_DIRECT_FILTER=true`.

**Default OFF:** se la variabile è assente o diversa da `true`, le quattro route Sondaggi continuano ad utilizzare la query precedente. Non impostarla su Render produzione. Il candidato è disponibile soltanto per una futura prova controllata in staging, dopo i requisiti di accesso.

## Confronto p50 SQL su PostgreSQL 17 isolato

Due modalità confrontate nella stessa esecuzione [GitHub Actions #40126315322](https://github.com/Nictolas/DemosApp/actions/runs/40126315322), con 94 colonne TEXT, 93 pubblicate, sette campioni alternati per variante dopo warm-up, account e geografie **sintetici**. Unità: millisecondi; misurazione SQL dalla stessa macchina CI, non HTTP Render/Supabase.

| Account sintetici | Area | Attuale p50 | Candidato p50 | Differenza |
| ---: | --- | ---: | ---: | ---: |
| 1.000 | Nazionale | 6,490 | 7,879 | +21,4% |
| 1.000 | Regionale | 3,111 | 5,828 | +87,3% |
| 1.000 | Provinciale | 3,186 | 5,814 | +82,5% |
| 1.000 | Comunale | 3,163 | 5,938 | +87,7% |
| 10.000 | Nazionale | 49,813 | 38,097 | −23,5% |
| 10.000 | Regionale | 16,856 | 15,107 | −10,4% |
| 10.000 | Provinciale | 16,795 | 15,303 | −8,9% |
| 10.000 | Comunale | 16,935 | 15,150 | −10,5% |
| 50.000 | Nazionale | 201,782 | 124,591 | −38,3% |
| 50.000 | Regionale | 78,374 | 57,319 | −26,9% |
| 50.000 | Provinciale | 78,525 | 57,617 | −26,6% |
| 50.000 | Comunale | 79,510 | 57,013 | −28,3% |

I conteggi `f/c/i` delle due query erano identici in **tutti e dodici gli scenari**. Questa seconda CI conferma la prima, ma non permette di definire una soglia di attivazione affidabile per gli account reali o un risparmio monetario. Con 1.000 account la nuova formula è decisamente più lenta: per questo **non è stata attivata come default**.

## Verifiche privacy e transazionali

Sono stati eseguiti i test automatici sia per la strategia attuale sia per la modalità opt-in:

- **300 colonne TEXT fisiche in PostgreSQL 17**, quattro ambiti, due query aggregate con limite di 256 colonne, un'unica transazione `REPEATABLE READ READ ONLY` per richiesta multi-batch.
- Revoca reale del consenso da **10 a 9** durante una richiesta: i due blocchi SQL di quella richiesta condividono lo snapshot iniziale; una **nuova richiesta** dopo la revoca non pubblica statistiche sotto soglia.
- Identificatori di opinione validati, geografia parametrizzata e filtro consenso anche nel candidato. Test di modifica ambientale garantisce che, senza opt-in, la SQL preesistente non venga sostituita.
- Le regressioni originali delle 94 opinioni, i test HTTP sintetici e il confronto p50/p95 storico continuano a riuscire.

**Limite della revoca:** una richiesta già avviata prima della revoca può completarsi sullo snapshot precedente. Non presentare ciò come blocco immediato di una richiesta in corso.

## Decisione operativa

1. Tenere `SONDAGGI_EXPERIMENTAL_DIRECT_FILTER` **non impostata** nella configurazione effettiva di DEMOS.
2. Non progettare ancora un'attivazione automatica sulla base del numero di utenti: servirebbero misure reali, non un'estrapolazione dai dati sintetici.
3. Prima di una possibile attivazione, misurare una A/B su database **Demos-Staging**, con scenario piccolo e grande, concurrency, CPU/query planner, traffico e tempi HTTP. Il servizio Render staging è ancora `setup-only`; il ruolo PostgreSQL apposito resta `NOLOGIN`, senza credenziali condivise.
4. Validare carico, privacy, error handling e rollback prima di decidere un eventuale rilascio. Nessuna azione su Supabase o Render produzione e nessuna migrazione del database.

**Stato:** OP-37 *in corso*; KPI-19 query nominali verificate su CI; KPI-20 HTTP end-to-end ancora *da misurare*. Non stimare la capacità da un milione di utenti né i risparmi nei limiti dei piani Free a partire da questa sola misura.
