# DEMOS GDPR/B2 — timeout preflight Object Lock (30 ottobre 2026)

**Ambito:** PR Draft #374, issue #296. Solo modifiche codice nella branch Draft e test con client B2 **iniettato e simulato**. Nessuna richiesta a Backblaze, Supabase, Render, o dati personali; nessun merge o deploy.

## Rischio separato dal timeout della singola versione

Il servizio `PrivacyErasureB2Journal.readVerified` già applicava il timeout alla lettura di `GetObjectRetention`, `GetObject` e allo streaming. Tuttavia `verifyArchivedReceipt` e `archiveEvent` chiamano prima `assertBucketCompliance` (`GetObjectLockConfiguration`), che poteva rimanere in attesa indefinitamente **prima** del readback. Una rete non responsiva non deve bloccare una verifica manuale né essere scambiata per prova valida del lock.

## Modifica

La chiamata `GetObjectLockConfiguration` dell'esportatore Draft usa un `AbortController` e una scadenza locale limitata da `readbackTimeoutMs` (1–15.000 ms; default 15.000 ms). Dopo la scadenza viene emesso `GDPR_B2_BUCKET_COMPLIANCE_TIMEOUT`, il segnale viene annullato e un eventuale ACK tardivo non può proseguire il flusso verso `GetObjectRetention` o `GetObject`. Anche dopo successo/fallimento viene liberato il timer; la verifica obbligatoria di `ObjectLockEnabled=Enabled` e `DefaultRetention.Mode=COMPLIANCE` resta intatta.

Una simulazione non può garantire che il provider remoto interrompa subito una richiesta già inviata. Il timeout blocca **l'ammissione locale** della risposta, non fornisce un attestato di cancellazione di operazioni esterne. Questo è particolarmente importante per eventuali PUT future, che richiedono un protocollo per esiti incerti.

## Test e confini

`api/tests/gdprB2BucketComplianceDeadlineIsolated.test.js`: sette prove con trasporto interamente fittizio — richiesta senza risposta, risposta dopo deadline, preflight valido, lock errato o mancante, errore provider, assenza di escalation a GET/PUT dopo timeout, configurazione timeout invalida. La suite è collegata al workflow B2/PostgreSQL 17.

**Rimangono aperti**: provider B2 reale e permessi dedicati, provenienza/completezza indipendente dello storico, durata reale della retention per ciascuna versione, possibile attesa non limitata per `HeadObject` o `PutObject` dell'esportazione (da trattare separatamente con esito remoto incerto), stato dei writer e delle API, ripristino in quarantena e validazione GDPR/DPO.

**Recovery NO-GO. PR #374 Draft; issue #296 OPEN.**
