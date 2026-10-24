# DEMOS — DOC-066: snapshot coerente tra gruppi Sondaggi TEXT

Data 24 ottobre 2026. PR [#258](https://github.com/Nictolas/DemosApp/pull/258) ancora **DRAFT**; modifica non pubblicata in produzione.

## Problema

DOC-065 ha diviso in blocchi di massimo 256 domande i cataloghi TEXT più grandi. Con `pool.query()` ogni istruzione PostgreSQL usava una transazione separata in `READ COMMITTED`. Una modifica del consenso o delle risposte tra la prima e la seconda aggregazione poteva pertanto produrre una singola risposta Sondaggi calcolata su **istantanee differenti** del database.

## Intervento

`api/utils/sondaggiTextBulk.js` acquisisce una **sola connessione dal pool** e avvia:

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
```

solo per cataloghi con più di 256 identificatori validi. La lettura della whitelist delle colonne e le successive query aggregate (256 elementi per blocco) usano la **medesima connessione e snapshot**. Il codice esegue `COMMIT` a lettura riuscita, `ROLLBACK` in caso di errore e rilascia la connessione in ogni caso. Se non è disponibile il checkout transazionale, l'operazione fallisce invece di mescolare snapshot.

Per le 94 opinioni correnti **non cambia la via nominale né il numero di query**: rimangono una lettura catalogo, una lettura metadata e una aggregazione. Per 300 opinioni sono **quattro SELECT**, più `BEGIN` e `COMMIT` (sei istruzioni di protocollo, se si conta anche il catalogo della route). In caso di errore a metà, anche `ROLLBACK` sostituisce `COMMIT`.

## Test

I test unitari verificano apertura/chiusura della transazione, rollback alla seconda aggregazione, propagazione di errori e rifiuto di un pool privo di `connect()`.

La prova su PostgreSQL 17 *effimero e interamente sintetico* `api/scripts/verify-sondaggi-large-catalog-pg17.js` verifica 300 colonne TEXT in quattro ambiti (nazionale, regionale, provinciale, comunale). Interrompe una richiesta dopo il primo blocco; un secondo client **revoca realmente** il consenso di uno dei dieci soggetti, poi riprende il secondo blocco. Ci si aspetta che la richiesta già avviata legga i due blocchi sullo stesso snapshot precedente e che la **nuova richiesta successiva alla revoca** non mostri nessuna statistica sotto la soglia di dieci.

## Limite privacy essenziale

`REPEATABLE READ` assicura coerenza **all'interno della richiesta**, ma **non garantisce che una richiesta avviata prima della revoca si interrompa alla revoca**: può concludersi leggendo lo snapshot precedente anche se la revoca si è nel frattempo conclusa. Per una garanzia assoluta di soppressione immediata delle risposte già in corso servirebbe un protocollo di coordinamento ammissione/revoca più rigoroso; non dichiarare tale garanzia sulla base di questo test. Nuove richieste avviate dopo il commit della revoca vedono la condizione aggiornata.

Queste sono prove sulla correttezza e sull'isolamento transazionale in ambiente sintetico. Non equivalgono a un collaudo RLS/Android/HTTP su Render e Supabase collegati, non stimano throughput di un milione di utenti e non costituiscono un'approvazione GDPR.

## Stato

OP-37 **In corso**, OP-36 / KPI-20 prestazioni HTTP effettive **da verificare**. Servizio Render staging ancora `setup-only` senza credenziali DB; il ruolo staging rimane `NOLOGIN`. Nessuna migrazione dello schema reale, nessun merge o deploy di DEMOS produzione; la PR #247 (2 bit) rimane separata.
