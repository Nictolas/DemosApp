# DEMOS — registro esterno GDPR su Backblaze B2 (proposta tecnica)

**26 ottobre 2026 — STATO DRAFT; non abilitato, nessun collegamento automatico ai percorsi di revoca/cancellazione.**

## Obiettivo

Preparare una copia cifrata e immutabile degli eventi confermati del ledger PostgreSQL in un **bucket B2 dedicato**, distinto dall'archivio Axiom dei log. I documenti precedenti #296–#299 implementano il replay e il pin indipendente, ma una sorgente B2 esterna non esiste ancora come servizio operativo: questo componente e' una base di implementazione, non la soluzione definitiva al disaster recovery.

## Contratto del componente

- Codice: `api/services/privacyErasureB2Journal.js`. Non viene importato da `api/app.js`, non apre automaticamente connessioni e non lancia job; per default fallisce se `GDPR_LEDGER_B2_ENABLED` non e' esattamente `true`.
- Credenziali e bucket B2 **distinti** dall'attuale log archive; endpoint HTTPS ufficiale e parametri espliciti. La chiave runtime va limitata allo stretto necessario e **senza delete**, modification/retention downgrade o bucket administration.
- Preflight con `GetObjectLockConfiguration`: deve essere abilitato Object Lock e una regola di default **COMPLIANCE** per una durata non inferiore a `GDPR_LEDGER_B2_RETENTION_DAYS`. Nessun automatismo crea bucket, abilita lock o cambia la retention.
- Ogni evento ha una chiave UUID sotto `demos/gdpr-erasure/v1/events/YYYY/MM/`, **senza identificativo utente nel nome, nel prefisso o nei metadati**. Il corpo contiene necessariamente `subject_user_id`, tipo, timestamp, UUID evento e dettagli del ledger: dati personali pseudonimi, **non anonimi**.
- Prima del caricamento controlla collisioni e verifica lo schema; chiede cifratura server-side AES256 e lock COMPLIANCE. Dopo il caricamento legge il **VersionId esatto** e i dati della retention con `GetObjectRetention`, scarica la stessa versione, confronta hash SHA-256 e contenuto.
- Se la chiave e' gia' presente, non sovrascrive: accetta la versione esistente solo dopo controlli di SHA, lunghezza, retention e contenuto. Se bucket/configurazione/ritenzione/read-back non rispettano il contratto, fallisce.
- `archiveBatch` puo' esportare un massimo di 100 eventi ordinati per data e UUID, con cursore. Il cursore restituito e' valido solo dopo che tutti gli oggetti del batch sono stati verificati; se un oggetto fallisce, il chiamante non deve avanzare alcun checkpoint.
- **Precisione del cursore (PR draft):** PostgreSQL memorizza microsecondi, mentre `Date.toISOString()` arrotonda ai millisecondi. Per evitare che un secondo batch ripeta il primo evento, la query restituisce un cursore UTC ISO con **sei cifre decimali** indipendente dal timestamp JS del corpo firmato. Trasmettere il valore `result.cursor` **senza trasformarlo in Date**, senza troncarne i decimali e senza ricostruirlo dal campo `occurred_at` dell'evento. Il componente rifiuta espressamente cursori `Date`, stringhe millisecondo (`.sssZ`) e qualsiasi formato diverso da UTC con sei cifre decimali (`.ssssssZ`), prima di interrogare PostgreSQL o B2. Il cursore non e' una attestazione di completezza dopo guasto, ne' un checkpoint immutabile; se mancano precisione o metadati, l'operazione deve fallire senza ulteriori PUT.

- Non esegue DELETE, listing di dati di utenti, log delle preferenze, migrazioni, aggiornamenti al DB, invio di email o modifica delle impostazioni B2.

## Variabili dedicate (solo dopo progetto, DPIA e approvazione)

- `GDPR_LEDGER_B2_ENABLED` (default non impostato, quindi OFF)
- `GDPR_LEDGER_B2_BUCKET` (nuovo bucket privato dedicato)
- `GDPR_LEDGER_B2_ENDPOINT` (URL HTTPS endpoint S3 Backblaze ufficiale)
- `GDPR_LEDGER_B2_REGION`
- `GDPR_LEDGER_B2_ACCESS_KEY_ID` e `GDPR_LEDGER_B2_SECRET_ACCESS_KEY` (segreti separati da Axiom)
- `GDPR_LEDGER_B2_RETENTION_DAYS` (valore da approvare per finalita' probatoria, minimizzazione e rischio di cancellazione; nessun valore presunto nel codice)

## Perche' questo non basta ancora per chiudere l'issue #296

1. **Consistenza e ritardo**: un batch post-commit puo' arrivare in B2 in ritardo o saltare un evento mentre il DB cambia. La sola esportazione non dimostra che ogni revoca/cancellazione sia stata replicata, ne' impedisce conferme utente prima dell'archiviazione. Serve un protocollo di outbox/transazione, monitoraggio della lag e un limite operativo fail-closed sui recovery.
2. **Anti-rollback**: Object Lock protegge la singola versione, ma **non** impedisce di creare una nuova versione o un delete marker che nasconda la versione corrente. Il recovery deve elencare e controllare le versioni, validare completezza/continuita', verificare una radice o checkpoint fresco e separatamente approvato; lo snapshot B2 non puo' auto-certificarsi.
3. **Conservazione GDPR**: la COMPLIANCE mode puo' impedire la cancellazione prima del termine scelto. Occorre una durata commisurata al minimo necessario e una policy del titolare/DPO, una informativa sui backup e misure contro la diffusione dei dati pseudonimi. Non impostare 10 anni per mera consuetudine.
4. **Isolamento**: bloccare Render Express non blocca tutte le altre istanze, worker separati, accessi diretti a PostgreSQL, Supabase Data API o chiavi service-role. Le restrizioni di rete Supabase **non** chiudono le API HTTPS. Non eseguire alcun recovery finche' queste superfici non sono effettivamente isolate.
5. **Verifica infrastrutturale**: i test di questa PR simulano il protocollo S3; nessun oggetto e' stato scritto nel B2 reale, non sono state verificate versioni/permessi o retention di un bucket attuale. Test con un bucket *staging dedicato* sono indispensabili prima della produzione.
6. **Operazioni e autorizzazione**: solo quando outbox, pin esterno, quarantena multi-servizio, DPIA, ruolo DPO, retention e disaster drill sono verificati si puo' valutare merge e deploy. I rami precedenti #264–#299 restano dipendenze.

## Riferimenti Backblaze

- https://www.backblaze.com/docs/cloud-storage-object-lock
- https://www.backblaze.com/docs/cloud-storage-enable-object-lock-with-the-s3-compatible-api
- https://www.backblaze.com/docs/cloud-storage-configure-immutable-storage-for-reseller-and-msp-customers

**Prossimo passaggio:** definire una outbox e un checkpoint esterno affidabile, senza fare affidamento sulla singola copia del DB o sull'ultimo oggetto visibile del bucket; preparare una prova B2 staging completamente separata. No merge, no deploy, no data migration.


## Preflight B2: corrispondenza regione/endpoint (draft)

`GDPR_LEDGER_B2_REGION` deve essere identico al segmento regionale dell'endpoint HTTPS ufficiale `https://s3.<regione>.backblazeb2.com`. Il client rifiuta mismatch tra regione configurata ed endpoint, nomi di regione malformati, credenziali incorporate nell'URL e porte non standard. La verifica avviene in `validatedConfig` prima di costruire il client S3; per il worker outbox `runOnce` fallisce prima di `pool.connect` e di ogni chiamata B2. Nessun rilevamento automatico di regione né modifica a endpoint o segreti.

Test esclusivamente sintetici: sei configurazioni errate e una corretta, con contatori su connessioni PostgreSQL e chiamate B2 che restano a zero per tutti i casi rifiutati. Non prova che credenziali, regione, bucket, Object Lock o connessione funzionino su un servizio reale.

## Decisione ancora aperta: worker durante la quarantena

Il flag HTTP `DEMOS_PRIVACY_RECOVERY_MAINTENANCE` protegge soltanto Express. Il worker outbox oggi ha flag separati e non consulta tale variabile. Durante un recupero potrebbe servire un'esportazione *offline e autorizzata* degli eventi reimportati, ma un worker ordinario non deve continuare ad agire sulla base di un database ripristinato prima delle verifiche. Bloccare indistintamente il worker quando il flag HTTP è impostato impedirebbe anche un recupero autorizzato: occorre prima definire ruoli, procedura e fonte di autorizzazione distinta e verificabile, barriera di quiescenza su tutte le istanze, e ordine fra replay, consegna B2 e verifica finale.

Questa PR **non modifica** il comportamento di manutenzione del worker. La quarantena Render/Supabase/Data API/worker e la relativa prova operativa restano un punto bloccante dell'issue #296, soggetto a decisione del titolare/DPO. Non dedurre l'isolamento di componenti separati dal solo flag HTTP.


## Preflight coerente tra regione ed endpoint (PR successiva a #322)

Il client B2 usa la regione configurata per firmare le richieste S3. Una regione differente da quella dell'endpoint ufficiale puo' provocare errori di autenticazione e lasciare eventi GDPR pendenti nell'outbox. La validazione ora accetta soltanto un URL HTTPS ufficiale `https://s3.<regione>.backblazeb2.com` la cui regione coincide **esattamente** con `GDPR_LEDGER_B2_REGION`. Rifiuta anche credenziali incorporate nell'URL, porte non standard, percorsi/query/fragment e regioni con formato non valido.

Il worker invoca `exporter.config()` **prima di aprire PostgreSQL**. Il test sintetico verifica che configurazioni discordanti vengano respinte senza chiamare `pool.connect()` o il client B2; verifica anche un esempio valido. Questo controllo non prova la raggiungibilita' del servizio, la correttezza delle credenziali o la configurazione di Object Lock sul bucket reale.

**Dipendenza recovery documentata:** `DEMOS_PRIVACY_RECOVERY_MAINTENANCE` protegge il traffico HTTP, ma non e' un interruttore universale dei worker. Durante un recovery autorizzato potrebbe essere necessario esportare eventi ripristinati mantenendo chiusi gli ingressi pubblici. Non si introduce un blocco indiscriminato dei worker senza un protocollo di quarantena e di autorizzazione operativa approvato; l'isolamento reale di tutte le istanze, dei worker e della Supabase Data API resta obbligatorio per chiudere #296.

Solo CI sintetica, nessun accesso a PostgreSQL/B2 reali, segreti, deploy, migrazione o attivazione. La scelta su DPIA, retention, costi e checkpoint indipendente resta sospesa.
