# GDPR B2 — cursore SQL e completezza del journal (solo test sintetico, 30/10/2026)

## Problema distinto da RLS e snapshot coerente

Il metodo `PrivacyErasureB2Journal.archiveBatch` legge pagine ordinate per
`(occurred_at,event_key)` e riparte con `WHERE (occurred_at,event_key)>cursor`.
Anche se ogni pagina ha visibilità SQL completa e il timestamp conserva
i microsecondi, un evento che viene **committato dopo la prima pagina** con
`occurred_at` precedente al cursore non sarà mai visto dalle pagine seguenti.
Un ultimo batch vuoto **non dimostra** che tutti gli eventi siano stati
archiviati. La stessa lacuna si manifesta dopo restore di snapshot vecchi.

## Mitigazione sul ramo Draft

`archiveBatch` restituisce esplicitamente `complete:false` e
`recoveryReady:false` per ogni risposta, anche con `exported:0`.
Non è una correzione della perdita del cursore, ma impedisce al chiamante
di trattare il risultato come attestazione positiva fornita dall'API.
Nessun nuovo permesso di PUT e nessuna riattivazione del worker.

La regressione `api/tests/gdprB2CursorGapPg17Synthetic.test.js` usa
PostgreSQL 17 effimero e tre eventi inventati: legge il primo evento,
committa un evento più vecchio, verifica che la pagina successiva lo
salti, e dimostra che un conteggio uguale non prova identità/completezza
di un insieme. La suite `gdprB2DirectWriteGateIsolated.test.js` verifica
che anche una pagina SQL vuota riporti i due flag negativi senza I/O B2.

## Gate che restano aperti

Servono un protocollo di cut e high-watermark con sequenza monotona
verificabile, prove di commit e completezza **indipendenti** dal database
che si potrebbe perdere, inventario delle versioni B2 e retention Object
Lock attestati da fonte indipendente, isolamento dei writer e restore
quarantinato prima di qualsiasi traffico. `pg_export_snapshot` da solo
garantisce coerenza fra lettori, **non** freschezza o completezza esterna.
Non sostituire questi gate con un semplice COUNT(*) o con un digest
calcolato dal medesimo database.

Questa modifica è soltanto su PR Draft. Nessuna credenziale, dato
personale, bucket reale, Supabase/Render produzione, merge, deploy o
restore. **Issue #296 OPEN; recovery NO-GO.**
