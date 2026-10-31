# DEMOS GDPR/B2 — fotografia PostgreSQL 17 consistente su più tabelle (30 ottobre 2026)

**Ambito:** PR Draft #374, issue #296. Esecuzione esclusivamente sul database PostgreSQL 17 **temporaneo della CI** `gdpr_outbox_worker_ci`; nessuna connessione a Supabase/Render produzione, B2, API, dati personali, credenziali, deploy, merge o restore reale.

## Rischio individuato

La suite di recovery aveva già un controllo in-memory di **lineage dei marker** e un modello SQL PG17 di replay, ma non mostrava direttamente che una fotografia SQL letta con query distinte può avere una **frattura temporale**: in `READ COMMITTED`, una query può leggere l'account prima di una cancellazione e la successiva può leggere il journal/ledger **dopo** il commit della cancellazione. Questi dati rappresentano due tempi diversi e non possono essere trattati come un backup transazionalmente consistente.

## Prova aggiunta

`api/tests/gdprRecoverySnapshotAtomicCutPg17Synthetic.test.js` opera in uno schema isolato creato e distrutto a ogni test, con soli account fittizi.

1. In `READ COMMITTED READ ONLY`, legge gli account, esegue una cancellazione reale **solo nel DB temporaneo** da una seconda connessione con aggiornamento account+ledger atomico, poi legge il ledger dalla prima connessione: la coppia account vecchio/ledger nuovo viene rifiutata con `GDPR_MODEL_TORN_SNAPSHOT`.
2. In `REPEATABLE READ READ ONLY`, la prima transazione mantiene lo stesso `pg_current_snapshot()` tra le query. Anche mentre una seconda connessione committa una cancellazione, vede una coppia account/ledger coerente. **È comunque una fotografia potenzialmente vecchia**: fuori dalla transazione il commit successivo è visibile e serve un journal esterno indipendente per il replay.
3. Una revoca già committata prima dello snapshot appare coerentemente nello stato e nel ledger.
4. Il verificatore sintetico rifiuta transazioni `READ COMMITTED` e `REPEATABLE READ` scrivibili come fonti ammissibili del cut.
5. Prova negativa: una fotografia localmente coerente con zero eventi non dimostra l'assenza di modifiche non registrate, né la completezza del journal GDPR.

Sei gruppi di test integrati nel workflow B2/PG17 e con guardia di connessione che richiede il preciso URL `127.0.0.1`, marker CI e assenza di variabili di produzione. Nessun `pg_dump`, `pg_restore`, backup reale o LSN produttivo.

## Limiti espliciti / prove residue

La consistenza transazionale fra tabelle è **necessaria ma non sufficiente**. Questo test non certifica:
- l'identità del backup effettivo, l'LSN/WAL di partenza, la sua provenienza e il cut temporale rispetto al checkpoint B2;
- che tutte le operazioni GDPR abbiano un evento in journal e un pin di versione Object Lock verificato;
- la conservazione dell'anchor anti-rollback dopo perdita SQL e il claim pre-PUT durabile reale;
- la barriera contro tutte le API/writer esterne, l'isolamento dei fornitori, il restore PostgreSQL in quarantena e il controllo DPO.

**Decisione invariata:** `productionRecoveryReady=false`, PR #374 **Draft**, issue #296 **OPEN**, recovery **NO-GO**.
