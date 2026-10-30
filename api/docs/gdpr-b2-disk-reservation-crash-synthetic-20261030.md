# DEMOS GDPR/B2 — prenotazione monouso su disco locale sintetico (30/10/2026)

**PR #374 Draft · issue #296 · recovery NO-GO.**

## Perché aggiungere questa prova

Il modello dell'anchor monotono precedente usa esclusivamente oggetti in memoria: documenta il requisito di rifiuto del replay, ma non esercita una vera contesa tra processi o un nuovo processo dopo la prima prenotazione. Questa prova isola il comportamento di una *prenotazione locale* persistente, senza attribuirle garanzie di durabilità esterna.

## Implementazione di test

`api/tests/fixtures/gdprB2DiskReservationSynthetic.js` è una **fixture locale e non importata dall'app**. Opera esclusivamente in una sottocartella diretta creata con `fs.mkdtempSync` sotto `os.tmpdir()` con prefisso `gdpr-b2-claim-synthetic-`, mai in una cartella di produzione.

- Controlla formato e identità dell'intento SQL simulato `UNKNOWN`, chiave e SHA-256.
- Un solo processo può creare `claim-<key>.json` tramite `O_EXCL`/write-only; se il file esiste già, **non** tenta di sovrascriverlo, cancellarlo o considerarlo un retry valido.
- Scrive una ricevuta senza dati personali, esegue `fsync` del file e del directory entry prima di restituire **un permesso sintetico**, marcato sempre `realB2PutAuthorized:false`, `externalWitnessDurabilityVerified:false`, `productionRecoveryReady:false`.
- Se il processo fallisce tra `open`, `fsync` file e `fsync` directory, la ricevuta incompleta resta una **tomba ambigua**. Il processo successivo deve rifiutare una seconda prenotazione: nessuna riparazione o retry automatica.

`api/tests/gdprB2DiskReservationSynthetic.test.js` contiene **11 gruppi**: tentativo duplicato, secondo processo reale, concorrenza di cinque processi Node separati, crash in tre finestre diverse, collisioni di digest, input non valido, directory estranee e symlink, più chiavi distinte, e una **prova negativa esplicita** che rimuovere il marker permette un replay.

## Limite di prova e gate ancora aperti

Il filesystem temporaneo della CI **non è indipendente dal database, non è Backblaze e non è un witness anti-rollback**. `O_EXCL` e `fsync` su una macchina locale non provano resistenza a rollback di volume, perdita simultanea di journal/anchor, crash del nodo, replica o storage remoto. In particolare la prova negativa dimostra che un file cancellato/ripristinato consente una duplicazione simulata. Per questo la fixture non deve essere copiata in servizi reali.

Non sono state implementate scritture B2, integrazioni del claim nel worker reale, procedure restore, né attivazioni di deploy. Servono una sorgente esterna realmente durabile e monotona verificabile, prova indipendente della completezza del journal B2, fencing di tutti i writer/ingress e una prova di restore in quarantena.

**Decisione: recovery NO-GO; PR #374 Draft; issue #296 OPEN.**
