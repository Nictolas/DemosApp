# DEMOS GDPR — paginazione reale S3 ListObjectVersions (modello sintetico)

**30 ottobre 2026 · PR #374 Draft · GH-296 · recovery NO-GO.**

## Lacuna rispetto all'inventario sintetico precedente

Il precedente `gdprB2VersionInventorySynthetic.js` inventava pagine `{cursor,nextCursor,objects}` con il body completo e tutte le versioni `IsLatest:true`. **Non corrisponde alla struttura di `ListObjectVersions` di Backblaze B2**, che restituisce metadati in liste `Versions` e `DeleteMarkers`, `IsTruncated` e una coppia `KeyMarker`/`VersionIdMarker`, poi `NextKeyMarker`/`NextVersionIdMarker`. Un'integrazione che dimenticasse un marcatore di pagina, una vecchia versione o un delete marker potrebbe scambiare un elenco incompleto per un archivio completo.

Documentazione provider e S3 di riferimento:
- https://www.backblaze.com/apidocs/s3-list-object-versions
- https://www.backblaze.com/docs/cloud-storage-s3-compatible-app-keys
- https://docs.aws.amazon.com/cli/latest/reference/s3api/list-object-versions.html

## Nuovo validatore di metadati fittizi

`api/tests/fixtures/gdprB2S3VersionPaginationSynthetic.js` accetta **soltanto pagine S3-shaped normalizzate in memoria**, non esegue SDK o chiamate di rete. Richiede:
- bucket autorizzato, `Prefix` specifico del journal, `MaxKeys` limitato; enumerazione terminata in modo esplicito, senza più di 64 pagine/512 versioni;
- marcatori di avanzamento *entrambi presenti*, esattamente trasferiti alla pagina successiva, senza cicli, omissioni o riutilizzo; `IsTruncated=false` soltanto nell'ultima pagina e senza ulteriori token;
- `Versions` con `Key`, `VersionId`, `Size` e `IsLatest` conformi e in ordine, un record per ogni pin già sigillato in un'autorità simulata separata; **nessun** delete marker, vecchia versione `IsLatest=false`, nuova versione non pinned o file estraneo sotto il prefisso;
- checkpoint del witness del journal sigillato corrispondente al numero di versioni attese.

**Nota:** il modello è conservativo. Se una chiave contiene realmente più versioni, incluse versioni non correnti, la suite restituisce NO-GO fino a riconciliazione esplicita della loro provenienza. Non le nasconde e non assume più che `ListObjectVersions` sia un download del body: nessun `ETag` viene scambiato per SHA-256. Un futuro adattatore reale dovrebbe confrontare l'ID di versione con la ricevuta durabile e verificare il body *separatamente* con `GetObject` per quel `VersionId`.

`api/tests/gdprB2S3VersionPaginationSynthetic.test.js` contiene 13 gruppi di test: paginazione positiva in due pagine; pagina mancante, continuazione falsa, coppie di marker non valide/cicliche, delete marker, vecchie versioni, versione extra, version ID/size incongrui, bucket/prefisso contaminati, pagine vuote o riordinate, witness/pin indisponibili e limiti superati.

## Requisiti operativi che mancano

Un controllo reale richiederebbe una credenziale **dedicata e limitata** al bucket GDPR con capability `listFiles` per `ListObjectVersions`. Non usare la chiave writer né quella dell'archivio log Axiom; il bucket GDPR deve essere distinto. Per leggere un singolo oggetto servono ulteriori capability minime `readFiles` e `readFileRetentions` e autorizzazione separata. La CLI metadata attuale consente solo `readBuckets` e `readBucketRetentions` ed **esclude deliberatamente** `ListObjectVersions`: questa PR **non** aggiunge una chiamata reale.

La stessa risposta provider non attesta da sola che l'intero journal GDPR sia durabile, completo, attuale, non ripristinato a uno snapshot vecchio o indipendente da SQL. Restano essenziali: witness esterno anti-rollback, backup SQL/WAL verificato, prova della copertura di tutte le operazioni GDPR, verifica Object Lock COMPLIANCE per ogni versione, isolamento dei writer/ingress e restore in quarantena.

**Nessuna credenziale, bucket B2, dati personali, Supabase/Render produzione, merge, deploy o restore toccati. Recovery NO-GO.**
