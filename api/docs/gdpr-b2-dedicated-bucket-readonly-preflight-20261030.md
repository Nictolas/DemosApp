# GH-296 — Bucket GDPR dedicato su Backblaze B2: controllo di sola lettura

**30 ottobre 2026 — PR #374 Draft, solo codice e test locali/sintetici. NO-GO.**

## Cosa c'è già e cosa manca

- Il vecchio servizio Render `demos-b2-readonly-restore-staging` esegue `archive:axiom:readonly-health` sui dataset Axiom `centralized_logs` e `real-time`, con prefisso `demos/axiom-archive/v1` e bucket log Axiom. **Non è l'archivio delle cancellazioni GDPR**.
- `api/services/privacyErasureB2Journal.js` contiene già codice per una copia B2 **separata** e versionata degli eventi GDPR (`demos/gdpr-erasure/v1/events/`), controlli di bucket COMPLIANCE Object Lock, retain-until sulla singola versione, readback SHA-256 e binding della ricevuta. **È una copia di eventi già confermati, non un'autorità esterna transazionalmente completa di recovery.** Il servizio e il worker restano Draft: non risultano deployati o verificati con un bucket GDPR reale.
- Mancano tuttora la prova che esista un bucket dedicato configurato con retentions adeguate, le capabilities di una chiave **separata**, la prova di ricezione della versione bloccata e un checkpoint fresco, indipendente e completo rispetto agli eventi SQL, nonché un restore sintetico isolato con ogni ingresso chiuso.

## Nuovo controllo preparato

**CLI:** `node api/scripts/attest-gdpr-b2-bucket-readonly.js`

La CLI può fare **soltanto** le due richieste S3, usando uno S3Client separato e un transport allowlist:

1. `GetBucketVersioning`: richiede `Status=Enabled`.
2. `GetObjectLockConfiguration`: richiede ObjectLockEnabled=`Enabled` e DefaultRetention `Mode=COMPLIANCE` con `Days` intero >= un minimo deliberato e <=3000.

**Non fa** `ListObjectVersions`, `HeadObject`, `GetObject`, `GetObjectRetention`, `PutObject`, altre write, chiamate a Supabase, Render, Axiom, Firebase, o letture di eventi. Non mostra nemmeno il nome del bucket. Costruttore SDK disaccoppiato e 7 test sintetici, compresi rifiuto di target errati, riutilizzo di chiavi app, governance/unlocked, errori mascherati, operazioni vietate e prova negativa di recovery.

### Configurazione minima per esecuzione esplicitamente autorizzata

Solo in un contesto **operatore isolato**, non nel web server Render e non nella app DEMOS:

| Variabile | Valore/contratto |
|---|---|
| `GDPR_B2_METADATA_PROBE` | `demos-gdpr-b2-isolated-metadata-readonly-v1` |
| `GDPR_B2_READONLY_BUCKET` | Nome **esatto** del bucket GDPR dedicato |
| `GDPR_B2_READONLY_APPROVED_BUCKET` | Ripetere il nome deliberatamente approvato, esattamente uguale |
| `GDPR_B2_READONLY_REGION` | Regione indicata dall'endpoint Backblaze ufficiale |
| `GDPR_B2_READONLY_ENDPOINT` | `https://s3.<region>.backblazeb2.com`, URL TLS senza query, porta custom o userinfo |
| `GDPR_B2_READONLY_ACCESS_KEY_ID` / `GDPR_B2_READONLY_SECRET_ACCESS_KEY` | **Chiave dedicata SOLO lettura** del bucket GDPR, non la chiave di produzione del writer, né chiavi archivio Axiom |
| `GDPR_B2_READONLY_MIN_RETENTION_DAYS` | Minimo di giorni approvato dal titolare/DPO; tra 1 e 3000 |
| `B2_BUCKET_NAME` | Nome bucket archivio log Axiom, usato solo per impedirne il riutilizzo accidentale |

Autorizzazioni chiave di lettura da valutare nel pannello B2: limitazione al solo bucket GDPR, `readBuckets` per `GetBucketVersioning`, `readBucketRetentions` per `GetObjectLockConfiguration`. Nessun `writeFiles`, `deleteFiles`, `writeBucketRetentions`, `bypassGovernance` o chiavi condivise col worker. **Non inserire mai credenziali in GitHub, Google Sheet, documenti o chat.** Non provare a passare l'ID/secret della chiave writer esistente.

Il processo rifiuta `DATABASE_URL`, `SUPABASE_DB_URL`, token amministrativi, variabili B2 di writer, Axiom e i flag worker, e rifiuta l'ambiente `RENDER` per evitare qualsiasi confusione con un servizio web. La CLI produce solo un report senza segreti.

### Interpretazione del report

- `READONLY_BUCKET_METADATA_COMPLIANCE_NOT_RECOVERY`: bucket versionato, Object Lock abilitato e retention di default COMPLIANCE >= soglia **osservati**. Non dice che esista almeno un evento GDPR, né che l'eventuale versione abbia un lock valido o che il journal sia aggiornato. Restano `completeGdprJournalVerified:false`, `objectVersionsVerified:false`, `restoreTestVerified:false`, `recoveryReady:false`.
- `NO_GO_GDPR_B2_METADATA_PRECHECK_FAILED`: non autorizzato/target errato/variabili pericolose; nessuna richiesta provider.
- `NO_GO_GDPR_B2_METADATA_UNVERIFIED`: metadati insufficienti, risposta non conformante o errore SDK (testi provider mascherati).

**Il processo esce sempre con codice 2**, compreso il primo caso: il metadata PASS non è un recovery GO.

## Prima di qualunque attivazione reale

1. Verificare dal provider se il bucket GDPR esiste e se la modalità COMPLIANCE e la retention sono appropriate. **Abilitare Object Lock è una scelta non reversibile**; non creare o cambiare un bucket né impostare periodi di retention senza revisione DPIA e implicazioni GDPR (eventi con identificatori, minimizzazione, durata).
2. Se serve, predisporre una chiave dedicata solo lettura (non la chiave del writer). Un'eventuale prova reale della CLI deve avere autorizzazione esplicita e ambiente senza credenziali di produzione.
3. Per provare la **versione** di almeno un evento sintetico GDPR, serve un secondo controllo, distinto dal metadata probe, con `GetObjectRetention` e `GetObject` limitato a chiave/versione conosciute e con confronto SHA-256/ricevuta; niente eventi personali senza ulteriore approvazione.
4. Per concludere il recovery: checkpoint esterno durabile/completo e prova di replay su un database **fittizio** con sessioni SQL dirette/Supavisor e API HTTPS isolate e gestite indipendentemente. Le fixture PG17 già testano parti del protocollo ma non dimostrano il comportamento dei provider.
5. Gate RP-10/F5-17, DPO/DPIA; solo allora considerare merge, deploy o recovery.

### Documentazione Backblaze consultata

- https://www.backblaze.com/docs/cloud-storage-object-lock
- https://www.backblaze.com/docs/cloud-storage-s3-compatible-app-keys
- https://www.backblaze.com/apidocs/s3-get-object-lock-configuration
- https://www.backblaze.com/docs/cloud-storage-s3-compatible-api-bucket-versions

**Decisione attuale:** B2 può rimanere la destinazione per un journal GDPR dedicato, ma il test del bucket reale non è stato eseguito: nessuna integrazione diretta Backblaze disponibile nei connettori attuali, nessun accesso a chiavi e nessuna autorizzazione a modificare Object Lock/bucket. GH-296 resta **OPEN / NO-GO**.
