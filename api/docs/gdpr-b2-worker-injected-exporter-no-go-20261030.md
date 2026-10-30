# DEMOS GDPR/B2 — blocco exporter personalizzati nel worker Draft (30/10/2026)

**PR #374 Draft · issue #296 · Recovery NO-GO**

## Lacuna

Il metodo `PrivacyErasureOutboxWorker.validate()` rifiutava una istanza di `PrivacyErasureB2Journal` finché mancava il claim durabile pre-PUT, ma continuava ad accettare un oggetto personalizzato che implementasse `config()` e `archiveEvent()`. Un wrapper poteva quindi chiamare un vero client Backblaze S3 evitando il controllo `instanceof` del worker. Il gate di `archiveEvent` non protegge un exporter diverso che non lo invochi affatto.

## Modifica solo nella branch Draft

Il worker **nega tutte le esecuzioni operative** con `GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED`, anche per exporter personalizzati. L'unico percorso conservato, esclusivamente per i test sintetici esistenti, richiede contemporaneamente:

- `GITHUB_ACTIONS=true` e `GDPR_OUTBOX_WORKER_CI=isolated` del processo;
- URL del DB di test esattamente `postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci`;
- un file di ingresso del tipo `api/tests/*.test.js` (percorso e suffisso verificati);
- per l'ulteriore prova del pool backend PG17, alternativa limitata al ruolo `gdpr_runtime_ci_worker` e al database effimero `gdpr_runtime_pool_ci` su `127.0.0.1:5432`, con URL completo e `GDPR_BACKEND_POOL_CI=isolated` esatti; qualunque altra `DATABASE_URL` blocca il worker;
- assenza delle comuni variabili di accesso alla produzione (`SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RENDER`, `RENDER_SERVICE_ID`);
- exporter fittizio che **non** sia `PrivacyErasureB2Journal`.

Il controllo avviene **prima** di `exporter.config()`, `pool.connect()` e `archiveEvent()`; le protezioni di manutenzione e flag disabilitati restano più restrittive. Nessuna migrazione né nuova dipendenza.

## Test ripetibili

`api/tests/gdprB2WorkerInjectedExporterNoGoIsolated.test.js` verifica: wrapper attorno a SDK S3 simulato; custom exporter in app; CLI/sorgenti non-test; file test fuori CI; marker di isolamento mancante, URL errato e variabili di produzione; rifiuto dell'esportatore reale anche in CI; normale fake CI; manutenzione e feature flag disabilitati. Il workflow B2 con PostgreSQL 17 esegue la nuova suite e i test esistenti. Una prima esecuzione ha rilevato che il test del backend pool usa una seconda istanza PG17 locale: è stata aggiunta una sola eccezione *esatta* per quella fixture, senza consentire URL remoti o un vero exporter.

## Limiti reali

**Non è una barriera contro codice malevolo nello stesso processo.** `process.argv` e `process.env` possono essere alterati dal programma, e un adapter dentro una CI falsificata potrebbe emettere traffico reale. Il blocco evita errori operativi involontari nella branch Draft, non autorizza installazione, deploy, bucket reali né restore. Non esiste ancora un claim single-use durabile integrato e attestato dal provider, indipendente dal DB originale; rimangono da verificare completezza del journal, versioni Object Lock, fencing di tutti i writer e isolamento del restore.

**Decisione invariata: PR Draft, GH-296 OPEN e recovery NO-GO.** Nessun dato personale, credenziale, bucket reale, Supabase/Render produzione, deploy, merge o restore è stato toccato.
