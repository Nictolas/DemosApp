# DEMOS GDPR / Backblaze B2 — bypass del worker e race pre-PUT (30 ottobre 2026)

**Scope:** PR Draft #374, issue #296; nessuna modifica a bucket B2, Supabase/Render produzione, credenziali, dati personali, deploy, merge o restore.

## Rischio non risolto dalle protezioni precedenti

Il vero worker `PrivacyErasureOutboxWorker` era già bloccato da `GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED`, dato che non esiste ancora un claim durabile pre-PUT. Ma il metodo pubblico `PrivacyErasureB2Journal.archiveEvent` e la chiamata diretta `archiveBatch` potevano bypassare tale protezione tramite uso operator-only. Il latch `uncertainWrite` scattava soltanto **dopo** HEAD: due richieste concorrenti sulla stessa istanza potevano entrambe osservare HEAD=404 prima che iniziasse la prima PUT, con il rischio di due versioni immutabili.

## Mitigazioni nella branch Draft

1. `archiveEvent` rifiuta il client SDK S3 reale, sia creato implicitamente sia iniettato come `S3Client`, con `GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED`, prima di qualsiasi contatto provider. `archiveBatch` usa lo stesso gate **prima** di interrogare SQL. La lettura `verifyArchivedReceipt` rimane read-only e separata.
2. Un gate sincrono `writeInProgress` copre l'intero percorso da prima del preflight Object Lock e HEAD fino al readback. Una seconda chiamata, anche per un'altra chiave, viene rifiutata con `GDPR_B2_CONCURRENT_ARCHIVE_NOT_ALLOWED`, prima di creare altri comandi di rete. Il gate è liberato in `finally`, incluso quando fallisce un controllo **prima** di PUT.
3. Il latch `uncertainWrite` resta **sticky** se un PUT viene avviato ma non viene letto e attestato in modo verificabile; `finally` non lo cancella. La protezione non produce una riconciliazione e non permette ritentativi.

`api/tests/gdprB2DirectWriteGateIsolated.test.js` contiene sei gruppi: default SDK bloccato, SDK iniettato bloccato, nessuna query SQL nel batch di scrittura non abilitato, due chiamate simultanee sullo stesso exporter, recupero solo da errore pre-PUT, e mantenimento del divieto dopo PUT incerto. Test con client in memoria; non sono inviate richieste AWS/B2.

## Limitazione di sicurezza importante

**Un adapter `client.send` personalizzato potrebbe incapsulare un SDK vero** e non essere identificato da `instanceof S3Client`. Per questo il gate del servizio Draft non rappresenta una barriera di produzione non aggirabile. Il codice **non deve essere distribuito o invocato con un adapter reale**, né usato per aggirare la barriera del worker. Occorre una review di tutti i caller e, per un rilascio futuro, una capacità di scrittura verificabile su claim indipendente e durabile, non un flag o un `instanceof`.

Il gate in-process non si estende ad altri processi, host, riavvii o chiamate che bypassino questo exporter. La tabella claim PostgreSQL 17 è soltanto una fixture e non prova continuità dopo perdita SQL. Resta necessaria prova indipendente di inventario versioni B2, Object Lock e storico completo, fencing di tutti gli ingress e writer, più restore isolato validato dal DPO.

**Decisione: NO-GO per recovery, PR #374 Draft e issue #296 OPEN.** I test sintetici non dimostrano integrità, completezza o conservazione reali.
