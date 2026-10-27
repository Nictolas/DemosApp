# DEMOS — Worker GDPR B2: retry e ricevute, soltanto Draft (27 ottobre 2026)

**Catena PR:** #366 → #371 → #372 → #373 → worker (questa tranche). **NO-GO recovery.**

Questa tranche isola il consumer operatore della coda `privacy_erasure_delivery_outbox` dal vecchio stack #365, senza migrare automaticamente in produzione le sue centinaia di commit. Non registra cron/job, import in `app.js`, route HTTP o inizializzazione automatica. **Non viene attivato B2.**

## Controlli aggiunti al worker

- Due abilitationi esplicite e distinte: `GDPR_ERASURE_OUTBOX_ENABLED=true` e `GDPR_ERASURE_OUTBOX_WORKER_ENABLED=true`. Ogni altro stato rimane bloccato. B2 deve inoltre superare `exporter.config()` **prima di ottenere una connessione SQL**.
- Blocco conservativo con `DEMOS_PRIVACY_RECOVERY_MAINTENANCE`: solo valore assente/`false` consente l'esecuzione; durante recovery o con valori sconosciuti abort prima e dopo i trasferimenti.
- Solo `runOnce(pool, {limit})` su chiamata esplicita dell'operatore (limit 1–20); rifiuta pool o limit errati. **Il modulo non crea connessioni in proprio.**
- La connessione deve identificarsi come **non-superuser, senza BYPASSRLS e non proprietaria** né del ledger né dell'outbox. Verifica `assertProtectedLedger` e `assertProtectedOutbox` su RLS, `FORCE RLS` e grant Data API. Nessun DDL automatico.
- Selezione degli eventi pending con `FOR UPDATE ... SKIP LOCKED`, sorgenti SQL prefissate `public`, ordinamento di coda e lock per evento. Ricevute con `eventKey`, chiave B2, SHA-256 della rappresentazione canonica, ID versione e scadenza COMPLIANCE validata; **se una ricevuta non coincide, non esegue ACK**.
- Il trasporto B2 può riuscire e il commit SQL fallire: l'evento resta pending e il prossimo tentativo può **riusare la stessa versione immutabile**, anziché creare un secondo evento.
- La funzione `status` è un riassunto SQL locale e **non** dichiara l'archivio esterno completo se esistono eventi senza outbox, orfani o ricevute inconsistenti. La lettura dei quattro contatori usa **una sola query e snapshot SQL**, evitando contatori incompatibili durante nuove scritture. Inoltre un ruolo soggetto a RLS riceve `ready=false`, `completeVisibility=false` e contatori globali `null`: non può attestare uno stato completo sulla base delle sole righe visibili. Anche `status.ready=true` con visibilità completa **non** autorizza un recovery: servono checkpoint di completezza indipendenti e confronto dei singoli oggetti B2.

## Prove isolate

`api/tests/gdprOutboxWorkerIsolated.pg17.test.js` utilizza esclusivamente PostgreSQL 17 di un servizio temporaneo GitHub Actions, database `gdpr_outbox_worker_ci`, dati inventati e `FakeB2` in memoria. La guardia richiede gli identificativi locali e rifiuta env/provider di produzione.

Il test prevede: blocco default/recovery senza SQL e rete; identità least-privilege reale; amministratore rifiutato; una consegna valida con ACK; retry a coda vuota; timeout **dopo** un PUT simulato con conservazione della coda; hash/chiave manomessi rifiutati; recovery intervenuto **dopo** l'upload e prima dell'ACK; UPDATE negato; inventario con evento senza outbox che produce `ready=false`.

La suite B2 della #372 copre separatamente Object Lock COMPLIANCE e readback per versione tramite un client S3 in memoria. **Nessuna delle due suite prova un provider B2 reale**.

## Bloccanti non risolti

1. Ruolo worker SQL separato ed ACL/policy minime installati su **staging isolato** solo con piano approvato. Lo schema attuale di Demos-Staging non ha ancora l'outbox; produzione invariata.
2. Runtime backend privato con credenziali gestite e ruoli verificati realmente in connessione. Non usare servizi web Free esposti come staging isolato.
3. Bucket GDPR B2 dedicato con Object Lock COMPLIANCE, cifratura, retention approvata, readback e checkpoint di completezza/freschezza firmato e conservato in canale esterno.
4. Prova end-to-end di perdita/restore in ambiente in quarantena, riconciliazione bidirezionale con outbox e approvazione del DPO/titolare prima della messa in esercizio.

**Nessun merge, deploy, nuovo segreto o accesso a dati personali.** Issue #296 resta OPEN/NO-GO.
