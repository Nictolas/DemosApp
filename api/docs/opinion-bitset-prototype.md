# DEMOS — prototipo codifica binaria opinioni (OP-41)

**Stato: esperimento isolato.** Non installa colonne, non legge o modifica dati utenti,
non abilita una feature flag e non altera il formato delle API. Non fare merge
o deploy in produzione finché non abbiamo confrontato le alternative su staging.

## Formato della codifica

Ogni opinione occupa **due bit**:

| Codice | Risposta |
|---|---|
| 00 | NULL: non ha risposto |
| 01 | f: favorevole |
| 10 | c: contrario |
| 11 | i: indeciso esplicito |

Quattro slot per byte; il primo ID ordinato occupa i bit 7–6, poi 5–4, 3–2
e 1–0. Gli ultimi bit inutilizzati devono essere zero.

**94 opinioni → ceil(94 × 2 / 8) = 24 byte** per i soli valori,
con bitmap realmente binaria (Buffer / PostgreSQL BYTEA), non con la
stringa di testo "00011011".

Le funzioni in api/utils/opinionBitset.js richiedono un catalogo ordinato
esplicito di ID: encodeAnswers(ids, answers), decodeAnswers(ids, bytes),
readAnswer(ids, bytes, opinionId), patchAnswers(ids, bytes, changes).
Il codec non legge la tabella e non costruisce automaticamente il catalogo.

## Catalogo versionato: requisito di produzione

La posizione di ogni opinione nel bitset è parte del formato persistito.
**Non generare mai l'ordine da ORDER BY text, object keys, SELECT * o
information_schema**, e non riutilizzare posizioni in seguito a eliminazioni.

Prima di salvare un bitset reale occorre:
1. pubblicare una mappa ID → indice immutabile e versionata;
2. gestire l'aggiunta di nuove opinioni come append-only;
3. memorizzare la versione del catalogo accanto al blob;
4. convertire le versioni precedenti senza riordinare le opinioni;
5. testare anche i client Android che usano ancora f/c/i/NULL.

Il prototipo espone anche `catalogFingerprint(ids)` (SHA-256 dell'ordine esatto)
e `isAppendOnlyCatalog(idsVecchi, idsNuovi)` per rilevare riordini o
rimozioni accidentali. Il fingerprint NON sostituisce la persistenza di
versione e catalogo accanto al BYTEA. I test dimostrano anche che due
snapshot concorrenti possono perdere un aggiornamento senza lock/CAS.

patchAnswers modifica un Buffer *in memoria*, in modo puro. **Non è**
un aggiornamento atomico di PostgreSQL: leggere il blob, cambiarlo e
riscriverlo senza lock/versione può perdere risposte da richieste concorrenti.
In produzione servirà un update SQL atomico dei bit interessati oppure
un controllo di versione/CAS con retry.

## Perché 24 byte non implica automaticamente risparmio

Baseline aggregata della tabella di produzione opinioni_risposte
(rilevata in sola lettura il 24/10/2026):

- 824 righe;
- 94 colonne opinione TEXT, più UUID e JSONB fonti_opinioni;
- media 8,32 opinioni compilate per riga, mediana 6;
- 508/824 righe hanno meno di 8 risposte;
- 688/824 hanno meno di 12 risposte;
- dimensione media logica della riga: ~754 byte, di cui ~681 byte
  per fonti_opinioni conteggiati come pg_column_size mediamente
  (NON sono byte direttamente attribuibili al file tabella).

PostgreSQL non salva le risposte NULL come stringhe e ha una NULL bitmap.
Le risposte valorizzate con un solo carattere TEXT occupano approssimativamente
2 byte ciascuna (short varlena), **non 94 × 2 byte per tutti gli account**.

Quindi per il profilo medio 8,32 risposte:

- testo: ~16,64 byte di soli valori effettivamente compilati;
- bitset: **24 byte fissi** di soli valori anche se nessuna risposta;
- restano da confrontare bitmap NULL, header di riga, BYTEA varlena,
  indici, TOAST, query, aggiornamenti e segmentazioni statistiche.

Risparmio netto sul *vero database*: **NON DIMOSTRATO**. Per dataset
molto sparsi, la codifica binaria potrebbe peggiorare lo spazio.

Eseguire node --test api/tests/opinionBitset.test.js e
node api/scripts/benchmark-opinion-bitset.js per verifiche pure in-memory.
Il secondo è sintetico, non misura PostgreSQL. I risultati dipendono dalla
distribuzione degli utenti.

## Prossimo passo sicuro (OP-40 / OP-41)

Su un **ambiente di prova gratuito e approvato**, confrontare tre tabelle
con dati sintetici che replicano solo le densità aggregate, non dati politici
identificabili: schema TEXT esistente, BYTEA bitset versionato, alternativa
sparse/JSONB. Misurare pg_total_relation_size per heap + indici + TOAST,
piani delle query e tempi di salvataggi concorrenti.

In parallelo studiare fonti_opinioni senza cancellare informazioni
probatorie, mantenere soglia di pubblicazione statistiche e consenso,
e coordinarsi con la PR #216 sul salvataggio delta delle opinioni.
La decisione finale può essere **lasciare lo schema attuale**.

## Prima misura PostgreSQL su staging (sola lettura, 24/10/2026)

È stata eseguita una query `SELECT` sintetica sul progetto Supabase di staging, **senza creare tabelle e senza leggere opinioni individuali**. `pg_column_size(ROW(...))` misura il valore di un record composito costruito in memoria; **non** è la dimensione di una riga heap PostgreSQL e non include indici, TOAST, WAL o costi di aggiornamento. Campioni deterministici, 94 slot, `id INTEGER` e `fonti_opinioni = '{}'::jsonb` in tutte le varianti.

| Risposte compilate | 94 TEXT, record composito (B) | BYTEA 24 B, record composito (B) | JSONB sparse, record composito (B) |
|---:|---:|---:|---:|
| 0% | 49,00 | 58,00 | 38,00 |
| 5% | 58,40 | 58,00 | 93,90 |
| 9% | 65,92 | 58,00 | 138,62 |
| 33% | 111,04 | 58,00 | 409,94 |
| 100% | 221,00 | 58,00 | 1159,00 |

TEXT/BYTEA: 1.000 record per densità; JSONB: 300 record per densità con chiavi corte artificiali `q0..q93`. I numeri sono confrontabili solo **come record compositi sintetici** e non sostituiscono un benchmark con tabelle reali, catalogo versionato e risposte sparse distribuite come in DEMOS. La bitmap NULL può rendere il confronto diverso da `8,32 × 2` byte di soli valori. Il JSONB sparse con chiavi reali potrebbe occupare ancora più spazio. **Non è stata dimostrata alcuna convenienza netta della migrazione.**


## Compatibilità API e contenitore versionato (DOC-016)

La PR #247 aggiunge, **solo come esperimento interno**,
api/utils/opinionCodecEnvelope.js e
api/tests/opinionCodecEnvelope.test.js.
Il modulo non viene importato dalle route reali e non crea tabelle.

Un oggetto interno binario conserva:
- schemaVersion (attualmente 1);
- catalogVersion, intero crescente e presente nel registro;
- catalogFingerprint SHA-256 sull'elenco ordinato degli ID;
- encoding, tra fixed/trimmed/sparse;
- payload come Buffer BYTEA, mai JSON/stringa con 0/1.

Il registro di cataloghi usa copie immutabili degli ID e impone
**append-only** fra versioni consecutive. Un payload v1 può essere
letto alla versione v2 senza spostare gli slot; i nuovi ID sono
NULL. La ricodifica esplicita verso l'ultima versione può anche
cambiare il formato binario preservando le risposte. Un fingerprint
incoerente, una versione sconosciuta, byte non validi o un ordine
modificato fanno fallire la decodifica.

**Limiti fondamentali:** il registro è per ora soltanto IN MEMORIA.
Il fingerprint individua divergenze rispetto al registro, ma non
garantisce autenticità crittografica del payload. Prima di una
eventuale migrazione serve una tabella dei cataloghi persistita,
migrazione/rollback verificati, autorizzazione e verifica della
concorrenza SQL, oltre ai test Android reali.

### Contratto HTTP da preservare

Il client attuale chiama POST /api/opinioni/salva con un body
del tipo {"opinioni":{"caccia":"f","nato":"i"}} e attende success,
savedCount ed errorCount. La successiva GET /api/opinioni-list
espone question.id e question.userAnswer nel vocabolario
f/c/i/NULL. Il nuovo modulo di prova può ricostruire quel formato
con decodeLegacyQuestionRows e interpretare il POST con
parseLegacyOpinionPost usando la normalizzazione reale di DEMOS.

Il parser di prova è più severo del salvataggio attuale per
valori sconosciuti: non va inserito nell'API senza una revisione
separata della gestione degli errori parziali.

Il caricamento delle risposte non deve mai comunicare BYTEA,
catalogVersion o fingerprint agli utenti/Android: restano dettagli
interni. L'app pubblicata non utilizza ancora questo codice.

Test: 8 nuovi casi di versionamento/compatibilità, inclusi il
catalogo esteso, i vecchi client, valori non ammessi e payload
corrotti. È inoltre prevista l'esecuzione in CI del test
esistente api/tests/ordinaryUserOpinionSave.test.js per il vero
endpoint Express con backend isolato/mock, senza dati reali.

Non c'è nessuna modifica alle risposte politiche in Supabase,
nessuna migrazione del DB, nessun deploy e nessun merge.

## HTTP cache delle risposte personali — protezione proposta in PR #247

Il codice della route legacy `GET /api/opinioni-list` nella **sola PR in
bozza** imposta `Cache-Control: private, no-store, max-age=0`,
`Pragma: no-cache`, `Expires: 0` e `Vary: Authorization` per
risposte personali, vuote e di errore. Le richieste condizionali
`If-None-Match`/`If-Modified-Since` sono ignorate in questa route,
per evitare il precedente HTTP 304 che poteva riutilizzare un corpo
personalizzato memorizzato prima della revoca. Il JSON e i codici
di risposta dei vecchi client Android/web restano invariati.

**Limiti:** gli header HTTP non cancellano risposte già presenti in
cache browser/app, IndexedDB, localStorage o proxy che ignorano le
direttive. Sono ancora necessari invalidazione lato client a logout,
cambio account, revoca e cancellazione, verifica delle altre route
personalizzate, test Android installato e definizione policy sul
consenso. La revoca continua a bloccare POST ma non la GET dei
propri voti memorizzati: decisione da valutare separatamente.
Nessun BYTEA collegato alle route; nessuna migrazione o deploy.


## Ripristino sperimentale del catalogo tramite manifesto (DOC-028)

Il prototipo `api/utils/opinionCatalogManifest.js` prova **esportazione e
ricostruzione** del registro delle versioni a partire da una rappresentazione
JSON deterministica, con `schemaVersion: 1` e, per ogni versione,
`version`, elenco ordinato `ids` e relativo `fingerprint` SHA-256.
Non salva fisicamente il manifesto su disco o database: il catalogo reale
di DEMOS resta **non persistito**. Non è autorizzata alcuna DDL.

- `serializeCatalogRegistry` esporta uno snapshot verificato;
- `restoreCatalogRegistry` ricrea una nuova istanza immutabile, rifiutando
  schema o campi sconosciuti, hash diversi, riordini, eliminazioni, input
  malformati e manifesti oltre 1 MiB;
- `appendCatalogManifest` produce un nuovo snapshot senza modificare
  quello precedente e richiede l'aggiunta di almeno un ID;
- i test ricreano il catalogo dopo un *riavvio simulato* e decodificano
  dati storici fixed/trimmed/sparse prima e dopo l'aggiunta di versioni.

**Limiti importanti:** un fingerprint SHA-256 non è una firma digitale:
chi può riscrivere gli ID può ricalcolare anche l'hash. Il test dimostra
ricostruibilità *logica*, non durabilità dei dati, replica, locking,
autorizzazioni, protezione RLS o affidabilità di un backup. Tornare a un
manifesto vecchio **non** rende leggibili automaticamente bitset prodotti
con nuove versioni: il rollback dovrà conservare lettori e manifesti di
tutte le versioni già scritte, o eseguire una conversione approvata.
Non è stato modificato il contratto HTTP f/c/i/NULL né alcun dato reale.

## Catalogo PostgreSQL 17 effimero: prova di persistenza (DOC-029)

Script CI `api/scripts/verify-opinion-catalog-persistence.js`, richiamato **solo**
dal job `physical-storage` di GitHub Actions, con guardia che richiede
`GITHUB_ACTIONS=true`, `OPINION_BENCH_EPHEMERAL=yes` e PostgreSQL locale
127.0.0.1:5432 nel database esatto `opinion_bitset_ci` con credenziali
sintetiche note. **Non è una migration, un modulo runtime o DDL Supabase**.

Su tabelle `ci_opinion_catalog_versions` e `ci_opinion_catalog_votes`
create nel container PostgreSQL 17 effimero, lo script:
1. salva la versione v1 del catalogo e tre blob BYTEA fixed/trimmed/sparse
   di soggetti di fantasia;
2. chiude la connessione e ne apre una nuova, ricostruendo un manifesto
   JSON dalle righe SQL e recuperando tutti i voti storici;
3. aggiunge v2 senza muovere gli slot preesistenti, conservando la
   decodifica delle tre codifiche e provando il rifiuto di un riordino;
4. simula due scrittori concorrenti della versione v3, usando un lock
   consultivo transazionale e il controllo optimistic
   `expectedLatestVersion`: un solo append deve passare e l'altro
   viene rifiutato come obsoleto;
5. altera temporaneamente, con rollback, fingerprint di catalogo e blob:
   la lettura deve fallire senza restituire opinioni scorrette;
6. controlla la ricodifica di blob vecchi nel catalogo più recente.

La validità è circoscritta a un **processo di prova e a due o più
connessioni allo stesso servizio PostgreSQL effimero**; non dimostra un
ripristino da backup, durabilità contro perdita del nodo, permessi o RLS,
repliche, autenticità della mappa ID, compatibilità Android reale o
beneficio prestazionale. Lo schema SQL della prova non prevede
automaticamente tutti i vincoli di immutabilità richiesti in produzione:
scrittori che non rispettano il protocollo consultivo potrebbero
aggirarlo. Il codice di DEMOS non legge né salva questi cataloghi.


## Isolamento PostgreSQL con ruoli e RLS sintetici (DOC-030)

Il file CI-only `api/scripts/verify-opinion-rls-isolation.js` definisce uno
schema **separato e interamente sintetico** nel PostgreSQL 17 effimero di GitHub
Actions. Non ha funzioni importate dalle API, non importa utenti o opinioni
reali e non esegue SQL su Supabase. Richiede `GITHUB_ACTIONS=true`, il
database esatto `opinion_bitset_ci` e credenziali fittizie locali.

Prova una policy *esemplificativa*, non quella installata in DEMOS:

- Due ruoli PostgreSQL non privilegiati, con login e password separati,
  non possono usare `BYPASSRLS` né assumere il ruolo l'uno dell'altro.
- Il catalogo versione/ID è consultabile da entrambi, ma non modificabile.
  **La divulgazione o meno del catalogo in un sistema reale è da decidere.**
- Le righe BYTEA sono protette da `ENABLE ROW LEVEL SECURITY` e
  `FORCE ROW LEVEL SECURITY` con `USING`/`WITH CHECK` basati su
  `subject_role = current_user`.
- Sono verificate lettura e modifica lecite delle proprie risposte,
  invisibilità di risposte altrui, negazione dell'inserimento per altri,
  del cambio di proprietario e dell'accesso con `row_security=off`.
- I payload fixed e sparse sono decodificati tramite gli adattatori puri,
  mantenendo i valori f/c/i/NULL.

**Ambito di validità limitato:** questa policy dimostra che in uno schema
nuovo PostgreSQL può isolare righe di prova con credenziali SQL distinte.
**Non valida** i criteri effettivi di DEMOS, gli accessi tramite pooler,
JWT/`auth.uid()`, le policy Supabase, i privilegi `service_role`, il controllo
del consenso né l'endpoint HTTP esistente. L'accesso SQL con privilegi
amministrativi può aggirare le policy. Le policy di produzione e la
migrazione restano non autorizzate. Anche dopo un esito PASS, OP-41 rimane
**In corso** e KPI-23 **Non verificato**.
