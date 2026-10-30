# DEMOS GDPR — vincolo della versione restituita nell'esportatore B2 Draft

Data: 30 ottobre 2026 · PR #374 · issue #296 · **NO-GO recovery**

## Rischio individuato

L'esportatore `api/services/privacyErasureB2Journal.js` rilegge un evento usando un preciso `VersionId` indicato nella ricevuta e verifica SHA-256, contenuto e Object Lock COMPLIANCE. La logica però non confrontava `GetObject.VersionId` con quello richiesto: una risposta proxy/provider incoerente con lo stesso contenuto poteva passare il test dei byte, senza provare che la copia fosse proprio quella versione immutabile.

Anche un `ContentLength` non dichiarato o differente dalla lunghezza effettiva veniva accettato se SHA-256 corrispondeva.

## Modifica esclusivamente al codice Draft

La verifica `readVerified` ora rifiuta prima di consumare il body quando:
- `GetObject.VersionId` manca o differisce da quello richiesto;
- è presente un delete marker; Object Lock mode restituito è incompatibile con COMPLIANCE o la data Object Lock fornita contraddice `GetObjectRetention`;
- `ContentLength` manca, è invalido, negativo o supera il limite. Al termine dello streaming, la lunghezza dichiarata deve corrispondere esattamente a quella letta.

Se la verifica preliminare fallisce, viene distrutto lo stream ricevuto, senza download correttivo o PUT. Rimangono obbligatori il controllo `GetObjectRetention` COMPLIANCE della versione, SHA-256 dei byte e confronto evento canonico.

## Prove e limiti

`api/tests/gdprB2JournalVersionBindingIsolated.test.js` testa il **servizio Draft effettivo**, ma iniettando solo un client S3 fittizio. Nessun vero bucket/SDK network call, database, account o credenziale coinvolti. Casi: versione inattesa o mancante con stessi byte, delete marker e intestazioni incompatibili, lunghezza sbagliata/assente, body alterato, retention scaduta, hash ricevuta errato senza accesso, assenza di scritture. La suite è eseguita dal workflow B2 PG17.

Un test mock positivo non prova che Backblaze B2 invii realmente le intestazioni richieste, né che i suoi dati siano immutabili; nessun bucket, journal completo, checkpoint indipendente, writer fence, isolamento o restore è stato attestato. È necessario testare il comportamento provider in un ambiente autorizzato con credenziale dedicata prima di considerare l'integrazione.

**Nessun merge/deploy. PR Draft. Issue #296 OPEN. Recovery NO-GO.**
