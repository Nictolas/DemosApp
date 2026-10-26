# DEMOS — salvataggio delta delle opinioni: verifica SQL (26 ottobre 2026)

## Decisione tecnica

**Confermare l'ottimizzazione proposta nella PR #293, mantenendola DRAFT finché la catena privacy #264–#291 e il gate DPIA/release non siano approvati.**

La PR #293 sostituisce la #216, chiusa perché la versione originale non incorporava la transazione del consenso e conteneva placeholder SQL errati negli UPDATE parziali. Lo schema PostgreSQL rimane TEXT, nessuna migrazione BYTEA/2-bit e nessuna modifica local-first.

### Semantica preservata

- Gli input restano f/c/i; NULL non può essere usato per ritirare una risposta.
- Il percorso acquisisce il lock `users FOR UPDATE`, **poi** rilegge il consenso nella stessa transazione, prima di consultare o modificare `opinioni_risposte`.
- Un payload con risposte identiche non produce UPDATE. Un payload con una modifica aggiorna solo la colonna corrispondente.
- `savedCount` indica ancora le risposte accettate, non il numero di campi fisicamente modificati.
- Le notifiche ai sostenitori richiedono il cambio effettivo di una risposta precedentemente non NULL; non si inviano per un primo valore o un salvataggio identico.
- Compatibilità contratti API esistenti. Il backend continua a ricevere risposte e ad effettuare verifiche del consenso anche quando non viene eseguito UPDATE.

## 1. CI PostgreSQL 17 isolata

Workflow: [Opinion delta-write benchmark](https://github.com/Nictolas/DemosApp/actions/runs/40247000605) — **SUCCESS** al commit `95e3f46`.

Script ripetibile: `api/scripts/benchmark-opinion-delta-writes-ci.js`. Guardia esplicita: funziona soltanto in GitHub Actions con host locale, database e credenziali sintetiche vincolate. Nessuna connessione a Supabase o credenziali reali.

Ogni variante è stata eseguita 35 volte dopo 8 warm-up, alternando l'ordine dei percorsi. Il confronto usa transazioni SQL con lock, ricontrollo del consenso, lettura di risposte e aggiornamento (o no-op), poi rollback. Il WAL riportato riguarda solo il comando UPDATE misurato con `EXPLAIN (ANALYZE, WAL, FORMAT JSON)`.

| Scenario | Legacy p50/p95 ms | Delta p50/p95 ms | WAL UPDATE legacy → delta (media bytes) |
|---|---:|---:|---:|
| 8 risposte, nessun cambio | 1,569 / 2,663 | 1,196 / 1,814 | 84 → 0 |
| 8 risposte, una variazione | 1,509 / 2,829 | 1,521 / 3,121 | 87 → 87 |
| 94 risposte, nessun cambio | 1,903 / 2,923 | 1,362 / 2,419 | 68 → 0 |
| 94 risposte, una variazione | 1,718 / 2,910 | 1,540 / 2,304 | 71 → 71 |

**Lettura:** nel caso no-op elimina gli UPDATE; nel caso con una sola variazione non garantisce un beneficio di latenza. La WAL dell'UPDATE parziale non è automaticamente proporzionale al numero di colonne nominate.

## 2. Verifica indipendente su Demos-Staging (Supabase)

Progetto **Demos-Staging**, Postgres **17.11**, e non il progetto di produzione.

- Verifica preliminare: schema `public` con 0 tabelle; database testato senza accesso a `public.users`, `public.opinioni_risposte` o ad altri dati di persone.
- Benchmark esclusivamente SQL, in transazione, con schema e righe sintetiche isolate. 40 campioni per variante dopo 5 warm-up; percorso legacy e delta alternati.
- `EXPLAIN (ANALYZE, WAL, FORMAT JSON)` per i soli UPDATE; tempi da `clock_timestamp()` attorno al percorso nel server PostgreSQL, **senza trasporto HTTP né frontend**.
- `ROLLBACK` finale. Controllo successivo: `op_delta_bench_20261026` assente, `public` invariato e ancora con 0 tabelle. Il rollback non cancella il WAL transitorio generato durante il test.

| Scenario | Legacy p50/p95 ms | Delta p50/p95 ms | WAL UPDATE legacy → delta (media bytes) |
|---|---:|---:|---:|
| 8 risposte, nessun cambio | 0,479 / 0,598 | 0,155 / 0,213 | 102 → 0 |
| 8 risposte, una variazione | 0,486 / 0,557 | 0,436 / 0,505 | 102 → 108,6 |
| 94 risposte, nessun cambio | 1,040 / 1,331 | 0,376 / 0,411 | 261,2 → 0 |
| 94 risposte, una variazione | 1,009 / 1,130 | 0,669 / 0,718 | 261,2 → 261,2 |

**Lettura:** il percorso senza cambi produce 0 WAL imputabile all'UPDATE, ma la transazione di consenso e il lock possono continuare a produrre altre scritture/WAL; non è un'operazione a costo zero. In ogni caso la mediana del test staging interno migliora, ma il campione è piccolo e i dati sono inventati.

## 3. Cosa i risultati NON dimostrano

1. Non sono misure del tempo percepito sull'app Android/iOS, né p95 completo dell'API Render.
2. Non stimano direttamente i consumi fatturati Supabase, la capienza del piano gratuito o il raggiungimento di un milione di utenti.
3. Non mostrano il costo dei backup, indici, statistiche e workload concorrenti reali.
4. Non dimostrano che le risposte sparse beneficino sempre di una scrittura parziale: PostgreSQL crea nuove versioni delle tuple anche aggiornando una sola colonna, e il WAL può rimanere uguale o aumentare.
5. Le differenze tra CI e staging non sono confrontabili come un esperimento unico: la prima misura anche il roundtrip al database dalla stessa VM, la seconda i tempi interni al server.
6. Le regressioni confermano comportamento con fixture e PostgreSQL sintetico, non sostituiscono una revisione DPIA o un test E2E completo su client precedente.

## Gate prima del merge e deploy

- [x] Correzione SQL e compatibilità con la catena consenso transazionale.
- [x] Test per no-op, una variazione, primo salvataggio, notifiche, revoca e utente mancante.
- [x] CI privacy, regressioni Opinioni, readiness e benchmark isolato tutti SUCCESS sul commit `95e3f46`.
- [x] Verifica SQL sintetica su Supabase staging con rollback e assenza di residui.
- [ ] Revisione e integrazione controllata della catena di PR #264–#291.
- [ ] Decisione documentata su cancellazione delle selezioni politiche legacy e DPIA validata.
- [ ] Test funzionali Android/browser con versioni pregresse e comparazione di latenza HTTP completa su staging.
- [ ] Verifica piano rollback/monitoraggio della produzione prima del rilascio.

## Lavori separati

- Cache del catalogo domande pubbliche: [issue #294](https://github.com/Nictolas/DemosApp/issues/294). Nessun caching delle risposte personali o del consenso.
- Codifica 2-bit/BYTEA e local-first: nessuna decisione di rilascio da questo benchmark, rimangono fuori da #293.
