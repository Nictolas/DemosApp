# DEMOS GDPR / B2 — adapter incapsulato e blocco delle scritture fuori dai test (30 ottobre 2026)

**Ambito:** PR #374 Draft, issue #296; modifiche solo al codice Draft e alle fixture. Nessun contatto con provider, credenziali vere, dati personali, SQL/Render/Supabase produzione, deploy, merge o restore.

## Rischio distinto e verificato nel codice

Il controllo precedente `instanceof S3Client` vietava un client SDK reale ma **non** un adapter che esponesse soltanto `send()` inoltrando le chiamate a un SDK reale. Di conseguenza `archiveEvent` e `archiveBatch` potevano ancora entrare in una sequenza che include `PutObject`, pur senza il claim pre-PUT durabile e indipendente. La protezione del worker rimaneva separata, e un chiamante diretto poteva ignorarla.

## Protezione aggiunta al codice Draft

`assertNoRealWriteTransport` nega ogni percorso di scrittura, anche con client personalizzato, quando il processo non è **simultaneamente**:
- eseguito con `GITHUB_ACTIONS=true`; **e**
- avviato come file `api/tests/<nome>.test.js` (controllo dei segmenti del percorso e del suffisso esatto).

La guardia mantiene il rifiuto quando manca il client o quando il client è un `S3Client` effettivo. È eseguita da `archiveEvent` prima di ogni comando SDK e da `archiveBatch` prima della lettura SQL. Per le fixture eseguite da GitHub Actions con client fittizi restano disponibili i controlli di comportamento e di sicurezza, incluso il gate in-process `writeInProgress` e il latch `uncertainWrite`.

## Test

`api/tests/gdprB2WrappedTransportNoGoIsolated.test.js`: cinque gruppi senza accesso alla rete, per SDK incapsulato in un adapter, client finto, applicazione, script CLI, percorso non-test, esecuzione non-CI, mancato accesso SQL e invariabilità dei latch. Incluso nel workflow B2/PG17.

## Limiti di questa guardia

Questo **non** è un'ACL né una prova criptografica: `process.argv` e le variabili d'ambiente sono controllabili dal processo. Non bisogna far passare un reale SDK tramite un client fittizio in CI, configurare ambienti di produzione per imitare test o distribuire questo ramo. Il controllo è una protezione temporanea contro invocazioni operative accidentali, non un confine contro codice che modifica deliberatamente l'esecuzione. Non autorizza produzione: il worker reale è ancora disabilitato, il claim durabile pre-PUT non è integrato e l'inventario B2 non è stato attestato.

Per un futuro GO servono un protocollo di autorizzazione tecnica verificabile e atomico, un witness realmente indipendente che sopravviva alla perdita SQL, prove di versioning/Object Lock e completezza del journal B2, isolamento di tutti i writer/ingress e restore in quarantena.

**Recovery NO-GO; PR #374 Draft, GH-296 OPEN.**
