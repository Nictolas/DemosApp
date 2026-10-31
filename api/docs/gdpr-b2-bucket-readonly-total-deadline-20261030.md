# DEMOS GDPR/B2 — scadenza totale nel preflight metadati del bucket (30 ottobre 2026)

**PR Draft #374 · issue #296 · recovery NO-GO.**

## Difetto verificato

Lo script autonomo `api/scripts/attest-gdpr-b2-bucket-readonly.js` effettuava due chiamate read-only (GetBucketVersioning e GetObjectLockConfiguration) in sequenza, ma **senza limite temporale totale**. Un provider o trasporto sospeso poteva lasciare un audit manuale in attesa indefinita. Questo controllo è distinto dal già protetto script per **una singola versione sintetica** e dalle letture del Draft exporter.

## Fix nella branch Draft

Il preflight dei metadati usa un budget condiviso di massimo **15.000 ms** (`MAX_PROBE_MS`, per default 15 secondi) con un singolo AbortController che copre **entrambe** le richieste, incluse eventuali risposte tardive. Se il timeout scade, restituisce sempre `NO_GO_GDPR_B2_METADATA_UNVERIFIED`; non può eseguire la seconda chiamata una volta scaduto il primo controllo. Il client SDK viene chiuso e il timer ripulito anche se il provider non risponde. Errori SDK o problemi durante il cleanup non devono comparire nell'output.

La funzione `readOnlyTransport` ora ammette soltanto `GetBucketVersioning` o `GetObjectLockConfiguration` sull'unico bucket approvato, con esattamente il campo `Bucket` e, se presente, la sola opzione `AbortSignal`. Comandi di scrittura, listing, chiavi arbitrarie, parametri SDK aggiuntivi o altri bucket sono rifiutati. **Il timeout annulla la verifica locale**, ma non è una prova che un provider esterno abbia interrotto la richiesta.

## Prova sintetica

Aggiunti sette casi in `api/tests/gdprB2ReadonlyBucketMetadata.test.js`: timeout e input non validi prima della costruzione SDK; opzioni e operazioni vietate; primo GET sospeso; secondo GET sospeso con budget condiviso; risposta tardiva; eccezione di cleanup redatta; successo con AbortSignal e sempre `recoveryReady:false`. Questi test usano client iniettati simulati, mai un bucket reale. Il workflow B2/PG17 esistente include già sia lo script sia il file dei test.

## Condizioni non dimostrate

Nessuna prova reale della versione del bucket, Object Lock COMPLIANCE su ogni versione storica, completezza e provenienza del journal GDPR, witness anti-rollback durabile, claim monouso integrato, isolamento di tutti i writer o restore isolato. Nessun account, credenziale, dato personale, bucket B2, Supabase/Render di produzione, merge, deploy o restore è stato toccato.

**Decisione invariata: PR Draft; issue #296 aperta; recovery NO-GO.**
