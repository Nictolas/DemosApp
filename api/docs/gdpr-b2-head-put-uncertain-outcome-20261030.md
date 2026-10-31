# DEMOS GDPR / B2 — HEAD/PUT bounded e risultato PUT incerto (30/10/2026)

**Ambito:** PR Draft #374, issue #296, recovery **NO-GO**. Intervento esclusivamente su codice e test sintetici. Nessun contatto con bucket B2 reali, credenziali, Supabase, Render, dati personali o ambienti di produzione.

## Lacuna confermata sul codice Draft

Il controllo Object Lock del bucket e il readback di una versione avevano già una scadenza. In `PrivacyErasureB2Journal.archiveEvent`, invece, `HeadObject` e `PutObject` attendevano indefinitamente una risposta. Il client SDK aveva inoltre `maxAttempts: 2`: dopo un ACK perso, un retry automatico di PUT può creare più versioni COMPLIANCE dello stesso oggetto. Una versione immutabile eventualmente caricata **non può essere considerata inesistente** solo perché la risposta è andata persa.

## Contromisure implementate nel Draft

- `sendBounded` impone un `AbortSignal` e una deadline locale (1–15.000 ms, default 15.000) a HEAD e PUT; rifiuta anche risposte arrivate dopo la scadenza. HEAD scaduto: `GDPR_B2_HEAD_TIMEOUT`, **nessun PUT successivo**.
- PUT scaduto: `GDPR_B2_PUT_OUTCOME_UNKNOWN`, **non** «upload fallito»; il risultato remoto è indeterminato.
- Prima di emettere PUT si attiva un blocco `uncertainWrite` sull'istanza dell'esportatore; si libera **solo dopo** un readback di versione e retention COMPLIANCE concluso correttamente. Dopo errore PUT o readback, la stessa istanza rifiuta ulteriori `archiveEvent` con `GDPR_B2_PUT_OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION`.
- `maxAttempts: 1` disabilita i retry automatici SDK, soprattutto di PUT. L'outbox non deve marcare l'evento come consegnato senza ricevuta verificata.

## Verifiche sintetiche

`api/tests/gdprB2ArchiveHeadPutDeadlineIsolated.test.js` usa il **servizio reale Draft**, ma con un client AWS simulato. Testa HEAD che non risponde, HEAD 404 tardivo, PUT senza ACK, ACK PUT tardivo, errore provider dopo PUT, errore readback dopo PUT, upload e riuso regolari, limite temporale e assenza di retry SDK. La suite è collegata al workflow B2/PG17. Queste prove non verificano il comportamento di Backblaze.

## Limite critico: non è ancora una garanzia distribuita

Il latch è **solo in memoria**: riavvio del processo, altro worker, altra istanza Render o retry schedulato possono non conoscerlo. Il semplice `HeadObject` successivo non è una prova indipendente che il PUT precedente non sia avvenuto, specialmente con eventuali ritardi di visibilità o versioni multiple. Non è implementato un protocollo durabile di riconciliazione delle scritture incerte. Un meccanismo sicuro richiederà stato persistente `UNKNOWN`, blocco cross-worker, inventario delle versioni e verifica read-only di ogni versione contro hash, retention e ricevute indipendenti; nessuna ritrasmissione automatica prima della riconciliazione. Non assumere che `If-None-Match` o altre condizioni S3 siano supportate da B2 senza prova provider autorizzata.

**Non usare l'esportatore Draft per un recovery di produzione.** Restano inoltre senza prova completa la provenienza e completezza esterna del journal, il writer fence, l'isolamento e il restore in quarantena. **PR Draft, GH-296 OPEN, recovery NO-GO.**
