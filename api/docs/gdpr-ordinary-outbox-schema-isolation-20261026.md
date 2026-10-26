# DEMOS — schema public per worker ordinario e stato outbox GDPR

**26 ottobre 2026 · PR DRAFT dipendente da #329 → #328 → #327 → #326 → #302. Nessun ambiente reale modificato.**

## Rischio verificato nel codice

`PrivacyErasureOutboxWorker.runOnce` eseguiva una transazione con `SELECT` e `UPDATE` non qualificati su `privacy_erasure_delivery_outbox` e `privacy_erasure_ledger`. Un client del pool che conservi `search_path=pg_temp,public` potrebbe selezionare eventi da tabelle temporanee omonime, inviarli al B2 e registrare ACK sulla relazione sbagliata.

`PrivacyErasureOutboxWorker.status` controllava l'esistenza di `public.privacy_erasure_delivery_outbox`, ma poi eseguiva più query non qualificate con un client o pool: oltre al rischio shadow, una modifica di `search_path` tra le query poteva produrre uno stato locale incoerente. Il suo `ready` **non è mai** un'attestazione di recovery: non verifica il B2 né un checkpoint esterno indipendente.

## Intervento

- `runOnce`: subito dopo `BEGIN`, esegue `SET LOCAL search_path = pg_catalog, public, pg_temp`. Prima del pin non vengono selezionate righe né chiamato B2; errore di pin → rollback, nessun archivio. La transazione continua a usare `FOR UPDATE SKIP LOCKED` e a controllare il flag di manutenzione.
- `status`: qualifica **esplicitamente** tutte le relazioni come `public.privacy_erasure_ledger` e `public.privacy_erasure_delivery_outbox`. Non introduce una transazione implicita né modifica sessioni o configurazioni; è sicuro anche con `pool.query` e connessioni diverse.
- Nessuna modifica a DDL, policy di retention, log, credenziali o permessi.

## Regressioni

- Unit test: `BEGIN → SET LOCAL → SELECT pending → B2`; errore sintetico in `SET LOCAL` impone `ROLLBACK` e zero chiamate B2.
- PostgreSQL 17 disposable con B2 fittizio: genera un evento GDPR fittizio nella outbox `public`, crea shadow temporanee omonime senza colonne di consegna, imposta `search_path=pg_temp,public`, controlla che lo stato mostri il pending reale, che il worker esporti solo quell'evento e che lo stato passi a zero pending. Shadow ancora vuote, sessione ripristinata, nessuna rete o produzione.

## Limiti e priorità successive

L'isolamento dello schema di questi componenti non prova che **tutti** i writer e le funzioni SQL usino lo schema corretto. In particolare, `PrivacyErasureLedgerService.recordEvent` e alcune operazioni di pulizia/DDL/backfill continuano a usare nomi di relazioni non qualificati: richiedono audit e regressioni dedicate, preservando la semantica transazionale e senza DDL sulle richieste live.

Rimangono aperti: checkpoint indipendente completo e fresco fino al freeze, isolamento infrastrutturale Render/Supabase/Data API/worker, prove B2 Object Lock e versioni reali in staging separato, DPIA/decisioni del titolare e DPO, costi/retention. Non è consentito usare `status.ready` per riaprire il traffico.

**Nessun merge, deploy, migrazione, credenziale, attivazione servizi, accesso a dati reali o intervento in produzione.**
