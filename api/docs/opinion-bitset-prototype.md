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


## Simulazione end-to-end HTTP senza migrazione BYTEA (DOC-031)

I nuovi casi di `api/tests/opinionCodecHttpContract.test.js` montano
il router sperimentale `api/tests/fixtures/opinionPackedShadowHttpFixture.js`
**solo durante il test**, sotto percorsi `/_synthetic/{fixed|trimmed|sparse}/api`.
Nessuna route pubblicata importa questo router e il codice non è usato
da server DEMOS, Android o Supabase.

I test eseguono veri POST e GET HTTP locali per confrontare
**la route Express legacy attuale** (database e JWT mock)
con tre router di prova che memorizzano soltanto Buffer binari in Map.
Le risposte sono confrontate come oggetti JSON, inclusi i campi di domanda
`id`, `text`, `grado`, `userAnswer` e, per il salvataggio riuscito,
`success`, `message`, `savedCount`, `errorCount`,
`notificationsCreated`; `timestamp` è validato separatamente,
perché nasce da richieste diverse. Non devono apparire
`payload`, `encoding`, `catalogFingerprint` o `catalogVersion` nelle
risposte pubbliche.

Sono inclusi account A/B isolati, assenza iniziale di voto,
salvataggio di f/c/i e alias testuali, modifica di una sola opinione senza
perdere le altre, ampliamento append-only del catalogo da v1 a v2 senza
riscrivere i blob vecchi, blocco POST al cambio del flag consenso,
autenticazione assente/non valida e rifiuto di valori/ID non validi.

**Confini e decisioni aperte**: il router shadow è un modello del
contratto pubblico ma non contiene tutta la logica delle route reali,
come notifiche dei rappresentanti, errori parziali, autentica revoca
atomica dei voti e CAS SQL. La sua Map non dimostra concorrenza
transazionale o durabilità. Per i casi di input misti validi/invalidi
il parser di prova resta più restrittivo della route attuale: la
compatibilità totale non è ancora dimostrata. Il test Android installato
e la verifica di RLS/pooler/Supabase rimangono fuori ambito.
La convenienza economica della codifica a 2 bit resta **non dimostrata**,
OP-41 **In corso**, KPI-23 **Non verificato**.


## Salvataggi parziali e errori HTTP: compatibilità shadow (DOC-032)

Il router sperimentale `api/tests/fixtures/opinionPackedShadowHttpFixture.js`
riproduce ora **nei soli test HTTP** la semantica di successo parziale
dell'attuale `POST /api/opinioni/salva`: se arrivano insieme opinioni
accettabili e opinioni con ID o valori non validi, vengono salvate solo
le prime; il JSON pubblico restituisce `savedCount` ed `errorCount`.
Non cambiano le API reali, il parser sperimentale puro
`parseLegacyOpinionPost` (ancora rigoroso), il database o gli utenti.

La suite `api/tests/opinionCodecHttpContract.test.js` mette a confronto
la route Express reale con JWT/DB simulati e tutti e tre i router shadow
(fixed, trimmed, sparse). I nuovi scenari confrontano il corpo HTTP:
- primo salvataggio misto (due opinioni valide e due errori);
- account separato con voto valido e ID non riconosciuto;
- aggiornamento misto senza cancellare opinioni non toccate;
- rifiuto HTTP 400 di batch senza opinioni valide o vuoto, senza
  sostituire i Buffer precedenti;
- rifiuto HTTP 403 su flag consenso spento, senza scritture.
I timestamp delle chiamate separate vengono validati, non confrontati
come stringhe identiche. Un Buffer interno non viene mai esposto in JSON.

**Limiti**: il simulatore verifica gli ID presenti nel suo catalogo
di prova, mentre l'endpoint attuale interroga
`information_schema.columns` e può usare un mapping storico.
Perciò non dimostra compatibilità per tutte le colonne/mappature
esistenti, né atomicità SQL, salvataggi simultanei, notifiche dei
politici, revoca reale con cancellazione, RLS Supabase, Android installato
o vantaggio complessivo della compressione binaria. Il codec non è
integrato nelle route effettive e la PR rimane in bozza.
**OP-41 In corso; KPI-23 Non verificato.**


## Concorrenza HTTP con salvataggi BYTEA su PostgreSQL effimero (DOC-033)

Script `api/scripts/verify-opinion-packed-http-concurrency.js`, richiamato
esclusivamente dalla CI su GitHub Actions con PostgreSQL 17 **effimero**,
credenziali fittizie e guardia obbligatoria `GITHUB_ACTIONS=true`,
`OPINION_BENCH_EPHEMERAL=yes`, `PGDATABASE=opinion_bitset_ci` e
`PGHOST=127.0.0.1`. È un router **di sola prova** sotto `/_ci/api`,
non importato dal server o dalle route DEMOS: nessun accesso a
Supabase, dati reali, DDL persistente o costi aggiuntivi.

Per ciascuna codifica fixed, trimmed e sparse, il test usa due account
sintetici. Lancia in parallelo **due POST HTTP di primo salvataggio sulla
stessa riga utente inesistente**, con opinioni diverse. Ogni transazione
acquisisce un `pg_advisory_xact_lock` per account prima di cercare la
riga con `FOR UPDATE`; il secondo POST deve preservare la prima risposta,
la riga finale deve avere revisione 2 e il JSON della GET non deve
esporre Buffer o metadati. Gli UPDATE successivi verificano anche
`WHERE revision = $expected` come controllo CAS.
Sono testati account separati, batch tutti invalidi e POST con consenso
sintetico disattivato: niente nuove scritture.

Si aggiunge la versione 2 del catalogo in una tabella locale separata:
le risposte v1 devono rimanere leggibili con i nuovi slot NULL.
Due ulteriori POST HTTP concorrenti per ciascun formato (uno su un nuovo
slot e uno su uno vecchio) devono portare alla revisione 4, con entrambi
i voti conservati e payload aggiornato al catalogo v2. Viene verificata
la somma delle revisioni su tutti i soggetti sintetici.

**Limiti essenziali:** la prova esercita un nuovo router Express e un
nuovo schema SQL inventati *per la CI*, non il vero
`POST /api/opinioni/salva`. Le route pubblicate NON memorizzano BYTEA.
Questo test non misura il throughput in produzione, non valida RLS/JWT/
pooler Supabase, non riproduce revoca e cancellazione atomiche, non
copre notifiche politiche, Android installato o rollback delle versioni
già scritte. Il lock è una convenzione fra scrittori cooperanti: non
sostituisce i vincoli e permessi necessari in un disegno produttivo.
La convenienza della compressione rispetto a TEXT resta da dimostrare.
**OP-41 In corso; KPI-23 Non verificato; OP-42 Da fare.**


## Revoca del consenso durante POST: prova di concorrenza (DOC-034)

In `api/scripts/verify-opinion-revocation-race.js` si usa SOLO il
PostgreSQL 17 effimero del job GitHub Actions `physical-storage`.
Guardia obbligatoria: `GITHUB_ACTIONS=true`,
`OPINION_BENCH_EPHEMERAL=yes`, database `opinion_bitset_ci` su
`127.0.0.1:5432` e utente/password fittizi. Schema isolato
`ci_opinion_revoke_race_247`, dati sintetici, nessun Supabase,
nessuna migration o nuova route DEMOS.

Il nuovo esperimento riproduce, per tutti e tre i formati
`fixed`, `trimmed`, `sparse`, tre sequenze con barriere e vere
connessioni SQL separate:

1. **Controllo negativo volutamente insicuro**: POST legge
   `granted=true` FUORI dalla transazione, viene sospeso, la revoca
   aggiorna il consenso e cancella i voti nello stesso commit, poi il
   POST prosegue e ricrea un blob BYTEA. Il test DEVE osservare la
   ricomparsa, dimostrando che il controllo esclusivamente preventivo
   non è una garanzia sufficiente. Il dato di prova ricreato viene
   cancellato prima di terminare il test.
2. **Salvataggio prima della revoca, versione protetta**: il POST
   apre la transazione, blocca la riga del consenso con
   `SELECT ... FOR UPDATE`, verifica `granted` e solo allora
   salva. La revoca in parallelo aspetta realmente il lock PostgreSQL
   (verificato con `pg_blocking_pids`), quindi disattiva il consenso
   e cancella i voti. Dopo il commit della revoca non rimane BYTEA
   e nuovi POST ottengono HTTP 403.
3. **Revoca prima del salvataggio, versione protetta**: `UPDATE`
   del consenso e `DELETE` operano nella stessa transazione. Il
   POST in parallelo aspetta il lock, vede `granted=false` e
   risponde HTTP 403 senza inserire la risposta. Il test verifica il
   lock nel database, non deduce la concorrenza da ritardi arbitrari.

Un quarto test per formato provoca un errore dopo `UPDATE` del
consenso e `DELETE` ma prima del `COMMIT`: il `ROLLBACK`
deve preservare sia il consenso attivo sia il blob precedente.

**Rilevanza per il codice attuale:** l'endpoint reale
`api/routes/opinioni/user-answers.js` controlla oggi il consenso
con `pool.query` **prima** della transazione di salvataggio;
`api/routes/user/political-opinions-consent.js` effettua la revoca
e il cleanup dentro una transazione separata. Questo è un
**rischio di competizione da approfondire**, non la conferma
di una violazione su dati reali. In questa PR il test NON modifica
i due endpoint effettivi: mostra il difetto del modello insicuro e
una contromisura candidata, che richiederebbe progettazione/test
anche con le vere tabelle consenso e gli altri processi di scrittura.

**Non verificati**: route reali sotto concorrenza, permessi
Supabase/Auth/RLS/pooler, cancellazione degli altri dati GDPR,
Android e confronto economico totale TEXT vs BYTEA. Un test positivo
sulla soluzione in miniatura non elimina questi limiti.
OP-41 **In corso**, KPI-23 **Non verificato**, OP-42 **Da fare**.


## Contratto delle route effettive: lock del consenso sul POST (DOC-035)

Nel codice **reale ma NON distribuito** del branch sperimentale PR #247,
`api/routes/opinioni/user-answers.js` mantiene il controllo preliminare
del consenso, per conservare il contratto degli errori HTTP 403/404,
e aggiunge una **seconda verifica obbligatoria nella transazione SQL
che effettua il salvataggio**. Prima della prima scrittura, acquisisce
`SELECT id FROM users WHERE id=$1 FOR UPDATE` sulla medesima
riga aggiornata dalla vera route di revoca, poi esegue una *nuova*
`SELECT COALESCE(uc.political_opinions_consent,
u.political_opinions_consent,false) AS granted` tramite lo **stesso
client DB** dopo aver ottenuto il lock. Il secondo statement
in `READ COMMITTED` evita di utilizzare una snapshot precedente di
`user_consents` dopo aver atteso l'UPDATE della revoca.
Se l'utente non esiste più: rollback + 404; se il consenso risulta
revocato: rollback + 403. Il lock viene conservato sino a COMMIT/ROLLBACK
delle risposte e delle notifiche nel DB.

In `api/routes/user/political-opinions-consent.js` è stata
documentata, senza cambiare la logica esistente, l'invariante
**UPDATE users prima del cleanup**. L'UPDATE in revoca e il
`SELECT ... FOR UPDATE` nel salvataggio si escludono a vicenda
sulla stessa riga. Non è stata modificata la struttura delle
risposte né sono stati aggiunti codec BYTEA alle vere route.

Test:
- `api/tests/ordinaryUserOpinionSave.test.js`: verifica ordine
  BEGIN → lock utenti → nuova lettura consenso → INSERT, che la revoca
  interposta dopo il primo controllo restituisca 403 senza scritture e
  che la cancellazione utente interposta restituisca 404;
- `api/tests/opinionCodecHttpContract.test.js`: esercita l'autentica
  route Express con mock JWT/DB simulando revoca dopo il preflight;
- `api/scripts/verify-opinion-consent-real-route-race.js`:
  **esclusivamente GitHub Actions, PostgreSQL 17 effimero**,
  carica la **vera sorgente** `user-answers.js` con autenticazione
  e notifiche fittizie, ma con **query e transazioni PostgreSQL reali**.
  La revoca concorrente è una transazione SQL *di test* che usa lo stesso
  ordine UPDATE users → UPDATE user_consents → DELETE risposte della
  vera route. Sono verificate con `pg_blocking_pids` le sequenze
  revoke-first (POST attende, 403, nessuna risposta ricreata),
  save-first (il POST trattiene lock, completa, poi la revoca cancella),
  rollback del revoker (il POST riprende e salva legittimamente).
  La prova usa solo schema e utenti di fantasia.

**Limiti e condizioni prima di qualunque deploy**: la prova non
esegue in concorrenza la vera route PUT /revoke con tutta la logica
di cancellazione GDPR, non verifica Supabase JWT, pooler, policy RLS,
fonti, notifiche distribuite, Android fisico o tutte le altre vie
di modifica del consenso. In particolare, scrittori che alterano
`user_consents` senza prima coordinarsi tramite `users` non
rispettano questo protocollo e richiedono audit. La PR è in DRAFT
e la modifica RESTA NON DISTRIBUITA. OP-41 **In corso**,
KPI-23 **Non verificato**: i vantaggi economici e prestazionali
del BYTEA non sono provati e la codifica binaria non è attiva.


## Audit scritture amministrative e ripristino privacy (DOC-036)

Rispetto al checkpoint DOC-035, la ricognizione dei percorsi di scrittura
ha individuato due superfici non coordinate con la revoca:

1. `PUT /api/users/:userId/opinioni` (admin):
   il codice originario leggeva il consenso con `pool.query`,
   poi leggeva le fonti esistenti ed eseguiva INSERT/UPDATE con altre
   `pool.query` indipendenti, **senza transazione né lock**. Nel branch
   sperimentale, la route conserva l'ordine delle verifiche HTTP iniziali
   ma prima della lettura delle fonti e dell'effettiva scrittura apre
   una transazione SQL, acquisisce `SELECT id FROM users WHERE id=$1
   FOR UPDATE`, rilegge `user_consents/users` nel medesimo client
   e fallisce con 403 o 404 e rollback se il consenso o l'utente
   non sono più presenti. Anche il controllo esistenza della risposta,
   la lettura e modifica delle fonti, la scrittura, il COMMIT e gli
   errori transitano tramite lo stesso client. Non cambia il formato
   legacy dei voti TEXT o le risposte HTTP.
2. `PrivacyErasureLedgerService.enforcePoliticalRevocation`:
   il cleanup chiamava la cancellazione di `opinioni_risposte` prima
   dell'UPDATE del consenso su `users`, creando un ordine incompatibile
   con la protezione appena aggiunta. L'ordine è stato invertito:
   UPDATE `users` → UPDATE `user_consents` → DELETE
   `opinioni_risposte`. Questa sequenza dà il corretto protocollo
   **se chiamata in un'unica transazione**. Il servizio non apre
   transazioni autonomamente: chiamanti di replay che non lo fanno
   NON sono garantiti da questa sola modifica.

Test mock della vera route amministrativa, in
`api/tests/politicalOpinionWriteRules.smoke.test.js`:
salvataggio lecito con fonti dopo lock e consenso, revoca simulata
tra preflight e lock (403 senza scrittura), soggetto eliminato
(404 senza INSERT), failure SQL con rollback e release.
Nuovo `api/tests/privacyLedgerLockOrder.test.js`:
ordina i comandi della replay e blocca il DELETE se l'UPDATE
sul consenso fallisce. Inclusi nel workflow delle Opinioni
e nella CI del prototipo.

**Limiti critici**: non è ancora un test concorrente end-to-end
della route admin con il vero PUT/revoke su PostgreSQL;
la semantica del service replay dipende dall'uso di un client
transazionale; altri endpoint di preferenze politiche, gli
import manuali e gli script di migrazione non sono stati
tutti verificati. Nessuna migrazione né deploy; PR in bozza;
OP-41 In corso, KPI-23 Non verificato e OP-42 Da fare.


## Query TEXT raggruppate per GET /api/sondaggi nazionale (DOC-039)

La route **effettiva nel branch in bozza**, `api/routes/sondaggi.js`,
ora delega gli aggregati nazionali al helper
`api/utils/sondaggiTextBulk.js`, senza modificare la risposta legacy
`{ success: true, data: { stats, questions } }`, senza BYTEA o schema
nuovo. Le rotte regionali/provinciali/comunali restano invariate.

Il helper usa il catalogo delle domande pubblicate già filtrato dalla
route e richiede **due whitelist** prima di inserire identificatori nel
SQL: ID con forma stretta `^[a-z][a-z0-9_]{0,62}$` e
`information_schema.columns` nel `public.opinioni_risposte`.
La verifica di colonna è una query parametrica `ANY($1::text[])`,
anziché un'interrogazione per opinione. Un'unica SELECT con
`CROSS JOIN LATERAL (VALUES ...)` e `GROUP BY v.opinion_id`
calcola i tre conteggi f/c/i, con gli stessi filtri
`account_type='PERSON'`, consenso `COALESCE` e risposta non NULL.
La soglia privacy minima di **10 risposte** viene applicata in Node
tramite `cellThresholdMet`, come prima. Domande prive di colonna o
di cella pubblicabile restano elencate in `questions`, senza chiave
in `stats`.

Se la SELECT raggruppata o la lettura metadata falliscono, un fallback
interroga separatamente soltanto le colonne con ID validati e trovate
nello schema, mantenendo la soppressione delle celle sotto soglia.
Cataloghi oltre 256 colonne usano direttamente il fallback.

I nuovi `api/tests/sondaggiTextBulk.test.js` e
`api/tests/opinionStatsAccountPopulation.test.js` verificano
SQL sicuro, contract HTTP nazionale con pool sintetico, numero di
query, filtro account, consenso, soglia 9/10, fallback e mantenimento
dei filtri delle altre tre rotte. Il runner **CI-only**
`api/scripts/verify-sondaggi-text-endpoint.js` monta invece la
**vera route GET** con PostgreSQL 17 effimero, usando viste di prova
sopra una **copia autonoma** `ci_sondaggi_text` di `ci_query_text`
e su `ci_opt_users` già creati nel job. Le alterazioni della colonna
di prova per la soglia 9/10 agiscono esclusivamente su questa copia:
`ci_query_text` resta invariata per i successivi test privacy e codec.
Verifica contratti JSON, domanda non approvata, cella esattamente
10 voti poi 9 dopo una revoca di prova, ripristino consenso e
fallback SQL, controllando anche che il percorso normale esegua
**3 query SQL per richiesta** (domande + schema + aggregato), invece
di 1+2N. Il runner rifiuta qualunque database diverso dal
`opinion_bitset_ci` di GitHub Actions con credenziali fittizie.

L'output EXPLAIN ANALYZE precedente, su 1.200 righe sintetiche,
mostrava **27,526 ms** per il raggruppamento TEXT contro circa
**49,953 ms** di somma delle 94 query TEXT separate. I valori non
comprendono roundtrip rete, pool, cold cache, produzione o Android.
Non costituiscono un SLA o una prova di risparmio effettivo su
Supabase.

**Limiti:** questa è un'ottimizzazione del solo endpoint nazionale;
non implica alcuna integrazione BYTEA o cambiamento di database.
Un piano SQL differente in produzione può offrire vantaggi diversi,
e un errore persistente del DB può comunque ridurre la disponibilità
di statistiche anche con il fallback. Niente merge/deploy: OP-41
**In corso**, KPI-23 **Non verificato**, OP-42 **Da fare**.


## Sondaggi TEXT raggruppati anche per regione, provincia e comune (DOC-040)

Nel branch sperimentale della PR #247 le **vere route**
GET /api/sondaggi/:regione,
GET /api/sondaggi/:regione/:provincia e
GET /api/sondaggi/:regione/:provincia/:comune
utilizzano il medesimo helper TEXT del caso nazionale, mantenendo
intatti i contratti JSON: { success, data: { stats, questions, filter } }.
Non cambiano il nome/compressione delle regioni e province,
i codici del database, le denominazioni comunali,
i parametri di ingresso, il formato dei voti o il database.

Il nuovo getTerritorialSurveyStats in api/utils/sondaggiTextBulk.js
accetta solo le profondità 'regione', 'provincia' o 'comune'.
I relativi filtri SQL sono letterali e statici:
- regione_residenza = $1;
- regione_residenza = $1 AND provincia_residenza = $2;
- regione_residenza = $1 AND provincia_residenza = $2
  AND comune_residenza = $3.

I **valori** sono sempre parametri e non sono incorporati nel SQL.
Gli ID delle opinioni pubblicate devono superare la regex per
identificatori sicuri ed essere presenti in
information_schema.columns su public.opinioni_risposte.
Il percorso standard fa tre query (domande, whitelist e aggregato
CROSS JOIN LATERAL VALUES) anziché una verifica e un aggregato per
ogni opinione pubblicata. Il filtro account_type='PERSON', la
preferenza esplicita del consenso user_consents rispetto al campo
users, l'esclusione delle risposte NULL e la soppressione delle celle
di meno di 10 risposte sono conservati.

Se il raggruppamento o la metadata query falliscono, un fallback
per ogni opinione validata conserva scope territoriale, valori
parametrizzati, controlli del consenso e soglia anti-inferenza.
Un catalogo superiore a 256 colonne usa direttamente il fallback
senza generare SQL unbounded. In caso di errori ripetuti di database
non si garantisce la disponibilità di tutte le statistiche: rimane
la semantica best-effort legacy.

La suite mock api/tests/sondaggiTextBulk.test.js include:
builder SQL non iniettabile e arità corretta dei parametri per tutte
le profondità; query di aggregato e fallback; contratto HTTP delle
tre route con i campi filter territoriali invariati; HTTP 400 per
regioni/province sconosciute. Il test di compatibilità
api/tests/opinionStatsAccountPopulation.test.js verifica la
persistenza dei filtri privacy ora centralizzati nel helper.

Il runner CI-only api/scripts/verify-sondaggi-text-endpoint.js
usa PostgreSQL 17 effimero e una COPIA della fixture opinioni,
con regioni e province sintetiche in viste dedicate. Con dieci
utenti fittizi della stessa regione/provincia/comune verifica la
pubblicazione; dopo il consenso negativo del decimo l'aggregato
deve sparire in tutti e tre gli scope, e ricomparire solo al
ripristino del consenso. Per ognuno confronta realmente il risultato
della query aggregata con il fallback provocando un errore sintetico
del grouped SQL. Conferma inoltre che una provincia diversa
non eredita la cella del territorio osservato.

**Limiti:** risultati misurati solo su dati sintetici, non sulle
app mobili o sul pooler e sulle policy di Supabase. Non si assume
né un dato risparmio in euro né una riduzione certa di latenza
su produzione. Nessun merge/deploy/DDL o BYTEA nelle route;
DOC-037 rimane un test admin/replay non applicato; OP-41 In corso,
KPI-23 Non verificato, OP-42 Da fare.


## Sensibilità dello spazio alle fonti e ai metadati del catalogo (DOC-042)

Questo **benchmark aggiuntivo non è una migrazione**: lo script CI-only
`api/scripts/benchmark-opinion-mixed-sources.js` crea esclusivamente tabelle
di prova `ci_mixed_*` sul PostgreSQL 17 **effimero** di GitHub Actions.
Rifiuta qualsiasi ambiente diverso da `GITHUB_ACTIONS=true`,
`OPINION_BENCH_EPHEMERAL=yes`, `PGHOST=127.0.0.1`, `PGPORT=5432`,
`PGDATABASE=opinion_bitset_ci`, `PGUSER=postgres` e password fittizia.
Nessuna connessione a Supabase, migrazione DDL reale o lettura di risposte
politiche reali.

Il campione contiene **824 account fittizi**, **94 opinioni** e **6.856
risposte non-NULL**: media 8,320 e mediana 6, con 508/824 account sotto
8 risposte. Riproduce solo le *statistiche aggregate* annotate in OP-40:
la distribuzione sintetica interna è una scelta artificiale a cinque
scaglioni e **NON è una copia né una ricostruzione delle distribuzioni
individuali reali**. Le risposte f/c/i e le posizioni sono generate
da un PRNG deterministico.

Si testano **cinque scenari ipotetici** di presenza delle fonti JSONB
(0%, 10%, 35%, 75%, 100%), con testi sintetici a bassa comprimibilità
di 140/700/1400 caratteri. La frequenza e la lunghezza delle fonti
**non sono state inferite dai dati reali**. Per ogni scenario tutte le
rappresentazioni ricevono **gli stessi utenti, risposte e fonti**:
TEXT 94 colonne, fixed a 2 bit, trimmed a 2 bit, sparse e due varianti
sparse che considerano i costi per record dei metadati:
- `sparse_versioned`: BYTEA + `catalog_version integer`;
- `sparse_envelope`: BYTEA + `catalog_version integer` +
  `catalog_fingerprint text` SHA-256 esadecimale di 64 caratteri +
  `encoding text`.

Sono misurate con vere funzioni PostgreSQL
`pg_relation_size`, `pg_indexes_size`,
`pg_total_relation_size` le dimensioni fisiche comprensive di heap,
indici, TOAST e allocazione delle relazioni; vengono verificati
numero di righe e quantità/dimensioni delle fonti per ogni variante.
Il log CI `OPINION_MIXED_SOURCES_RESULT_JSON` fornisce per scenario
byte/account, risparmio assoluto e percentuale rispetto a TEXT,
non proiezioni di costo o di capacità di Supabase.

**Limiti importanti:** la variante `sparse_versioned` potrebbe
richiedere ulteriori campi, lookup del catalogo, politiche RLS,
aggiornamenti atomici, indici o tabelle ausiliarie in produzione.
`sparse_envelope` è soltanto un possibile limite superiore del
metadata overhead, non un formato prescritto. Il benchmark non misura
CPU, latenza HTTP, query aggregate, consumi RAM, backup reali,
contenzioso dei lock, Android, prezzi, distribuzione autentica delle
fonti o numero massimo di utenti del piano Free. I risultati di
`pg_total_relation_size` su 824 record risentono anche
dell'allocazione in pagine. Si confrontano soltanto alternative
sperimentali: **nessuna decisione di migrare BYTEA** è autorizzata
dal benchmark. OP-40 e OP-41 restano **In corso**, KPI-23
**Non verificato**; OP-42 **Da fare**.


## Latenza di lettura, aggiornamento e lookup catalogo (DOC-043)

Il nuovo `api/scripts/benchmark-opinion-mixed-performance.js` esegue
**solo nel PostgreSQL 17 effimero di GitHub Actions**, usando
le tabelle sintetiche `ci_mixed_2_*` (scenario **35% di fonti**)
prodotte precedentemente dal test DOC-042. Il runner controlla
rigidamente `GITHUB_ACTIONS=true`, `OPINION_BENCH_EPHEMERAL=yes`,
host locale `127.0.0.1`, porta 5432, database
`opinion_bitset_ci`, utente `postgres`, password `synthetic-only`,
versione 17 del server, 824 righe per tabella e 288 fonti sintetiche.
**Nessun dato personale, Supabase o connessione di produzione.**

Ogni rappresentazione (TEXT, fixed, trimmed, sparse,
sparse_versioned e sparse_envelope) affronta lo stesso set deterministico
di 120 letture complete e 120 letture di una singola opinione,
con dieci richieste di warm-up, misurando wall-clock locale che include
roundtrip DB, driver Node e normalizzazione/decodifica. La lettura
completa normalizza tutte le 94 posizioni, mentre per la singola
opinione il TEXT legge una colonna e il binario deve recuperare il
payload e decodificarne la posizione. I campi JSONB delle fonti
**non sono letti**: non è una misura dell'intero endpoint HTTP DEMOS.

Si eseguono inoltre **72 aggiornamenti per formato**, ciascuno con
BEGIN, SELECT ... FOR UPDATE, UPDATE e COMMIT, sullo stesso elenco
deterministico di account sintetici e slot, più 8 warm-up; viene
verificato il valore finale memorizzato per ciascuno. TEXT aggiorna
soltanto la colonna scelta; i formati binari leggono il BYTEA sotto
lock, lo modificano con il codec Node e riscrivono l'intero BYTEA.
Letture e scritture riportano mediana, p95 e media locali in ms:
non simulano carico concorrente o Round-Trip Android.

La prova include un catalogo CI autonomo
`ci_mixed_catalog_bench`, contenente la versione 1 da 94 ID
e una versione 2 **append-only** con un nuovo ID. Le due fingerprint
SHA-256 sono verificate e l'ordine storico invariato. Vengono misurate
120 verifiche con catalogo in cache Node e 120 SELECT dirette
del catalogo sul PostgreSQL locale (entrambe includono la verifica
SHA-256). Lo spazio fisico della tabella catalogo viene riportato.
La versione 2 serve a esercitare lookup/immutabilità sintetici:
**non** è aggiunta al catalogo DEMOS di produzione.

Un benchmark CPU Node separato normalizza 1.000 volte la medesima
riga di ogni formato, senza DB né rete, e riporta il tempo di decode
per iterazione; include volutamente l'allocazione della mappa
completa delle 94 risposte.

Tutti gli output sono in
`OPINION_MIXED_PERFORMANCE_RESULT_JSON` (incluse mediane e p95);
il marcatore `OPINION_MIXED_PERFORMANCE_PASS` è emesso **solo dopo**
verifica del conteggio campioni, dei valori riscritti e del catalogo.

**Cautela fondamentale:** la differenza tra formati dipende dalla cache
SQL, JIT Node, page allocation, carico dei runner e dalla scelta di
SELECT/UPDATE. Il benchmark **non** misura consenso o RLS reali,
altre route, contesa multiutente, indice su opinioni, endpoint
statistici, latenza client, costi e capacità del piano Free.
È una *sensibilità locale* su 824 account simulati, non una stima
di latenza p95 in produzione, né un benchmark per prendere una
decisione automatica di migrazione. Il formato BYTEA resta escluso
dalle route effettive; la PR è DRAFT, nessun merge/deploy/migrazione
Supabase, OP-41 **In corso**, KPI-23 **Non verificato**, OP-42
**Da fare**.


## Concorrenza sotto contesa e invalidazione cache catalogo (DOC-044)

**Test sperimentale, non installato nelle route DEMOS.**
Il runner `api/scripts/benchmark-opinion-concurrent-load-catalog.js`
opera esclusivamente sul servizio PostgreSQL 17 effimero di GitHub
Actions `opinion_bitset_ci`, con guardia rigida sulle variabili
di ambiente, credenziali fittizie e controllo della versione server.
Duplica in quattro tabelle isolate i dati fittizi di DOC-042
(824 soggetti, 94 opinioni, 288 fonti in scenario 35%), senza alterare
le fixture dei benchmark precedenti o accedere a Supabase.

**Contesa di scrittura:** per ciascuno dei formati TEXT (94 colonne)
e BYTEA `sparse_versioned`, otto connessioni eseguono 12
aggiornamenti ciascuna, per un totale di 96 transazioni per formato
e scenario. Sono confrontati uno scenario `hot` (otto lavoratori
sulla **stessa riga** ma su otto opinioni diverse) e `spread`
(otto account diversi). Ogni scrittura usa BEGIN,
SELECT ... FOR UPDATE, UPDATE e COMMIT, aggiorna una revisione
intera e attende artificialmente **5 ms sotto il lock** per rendere
osservabile la contesa. Il test verifica con
`pg_stat_activity` e `pg_blocking_pids` che la contesa sul
singolo account sia reale; dopo gli aggiornamenti verifica
**tutte le revisioni e le risposte finali** per escludere
scritture perse. Riporta mediana, p95 e media per scenario.
Il ritardo sintetico altera i tempi: i numeri **NON sono
latenze della produzione**, e il test non simula traffico Android
o molti utenti contemporaneamente.

**Cache di catalogo, prova di correttezza:** due connessioni
PostgreSQL con cache Node **indipendenti**, ma nello stesso processo
CI, caricano un catalogo append-only versionato e validato
mediante fingerprint SHA-256. In una tabella `catalog_head`
separata, la lettura `FOR SHARE` consente più scrittori
contemporanei e la modifica `FOR UPDATE` serializza le
operazioni che appendono nuove versioni. Due append concorrenti
basate su versione 1 devono produrre un solo successo,
con rigetto dell'altra come obsoleta; una cache rimasta alla
versione 1 non può salvare dichiarandosi implicitamente
aggiornata alla versione 2: la scrittura è respinta,
senza modificare i dati, fino al caricamento della
nuova versione. Una riga storica in formato BYTEA versione 1
rimane decodificabile dopo l'append. Fingerprint alterate
in una transazione di test sono rilevate e la modifica viene
annullata dal ROLLBACK.

Questa è soltanto una **proposta sperimentale di lock condiviso
sul catalog head**: l'uso di `FOR SHARE`/ `FOR UPDATE`
ha costi di contesa propri, così come una cache distribuita
necessiterebbe gestione di invalidazione, riconnessione e
consistenza di processo/replica. Il test non implementa
pub/sub né una vera cache applicativa deployabile. Non testa
JWT, consenso, RLS e pooler di Supabase, failover, revoca
GDPR, backup, schemi reali, prestazioni economiche o Android.
La PR resta DRAFT, nessun merge/deploy/DDL persistente,
nessuna migrazione a BYTEA. OP-41 resta **In corso**;
KPI-23 **Non verificato**; OP-42 **Da fare**.


## Disconnessione PostgreSQL e recupero catalogo (DOC-045)

Lo script `api/scripts/verify-opinion-crash-recovery.js` aggiunge
una regressione **solo CI** su PostgreSQL 17 effimero `opinion_bitset_ci`.
Crea tre nuove tabelle isolate con dati sintetici e 94 ID di opinione.
Non accede a Supabase, API DEMOS o dati degli utenti.

Il test simula la **terminazione del backend PostgreSQL** durante una
transazione che aveva inserito una versione di catalogo, spostato la
testa e modificato due righe BYTEA, **prima del COMMIT**. Dopo la perdita
della connessione verifica atomicità del rollback: nessuna versione
fantasma, nessun cambio al catalog head, nessuna risposta parziale.
Riapre una connessione, effettua un append e un salvataggio confermati,
termina anche quella connessione e verifica che la versione confermata
sia ricostruibile dal DB. Le risposte scritte con catalogo v1 devono
rimanere leggibili attraverso la v2 e i nuovi slot devono restare NULL
nelle vecchie risposte. Una cache obsoleta è identificata controllando
la versione corrente con il lock condiviso sul catalog head.

**Limiti:** terminare un backend non equivale a un failover del server
o alla perdita di un disco. Il test non copre conferme COMMIT ambigue,
idempotenza dei retry HTTP, backup e restore, riavvio del server
PostgreSQL, cache distribuite, dispositivi Android, RLS o JWT reali.
È un test del pattern sperimentale, NON una modifica delle route.
CI PostgreSQL 17 #40100198634 **SUCCESS**: il job physical-storage
conferma il passo `Recover versioned opinions from terminated PostgreSQL
backend` PASS, marcatore `OPINION_CRASH_RECOVERY_PASS`.
Anche le altre cinque CI sul medesimo HEAD #b554ced sono SUCCESS:
Opinioni #40100198612, Security #40100198610, Privacy erasure
#40100198613, DPO #40100198643, Logging #40100198619.
PR #247 ancora DRAFT; nessun merge, deploy, DDL in produzione o
migrazione BYTEA. OP-41 **In corso**, KPI-23 **Non verificato**,
OP-42 **Da fare**.


## Retry idempotente e snapshot logico ripristinato (DOC-046)

Il runner `api/scripts/verify-opinion-idempotent-backup.js`
realizza una **prova autonoma esclusivamente su PostgreSQL 17 effimero**
di GitHub Actions (`opinion_bitset_ci`). Tutti gli ID/account sono
sintetici; DDL e dati restano in nuove tabelle isolate `ci_idem_*`.
La guardia richiede credenziali CI fittizie e host loopback.

**Conferma persa e deduplicazione:** un client salva una delta-opinione
con `request_id` e fingerprint del payload, la transazione esegue COMMIT
e il test simula la perdita della risposta al client **dopo** COMMIT.
Una seconda connessione ripete lo stesso `request_id`: la richiesta
deve risultare già applicata, senza riscrivere la riga né incrementare
la revisione. Stesso ID ma contenuto diverso viene rifiutato.
Due richieste concorrenti uguali producono un solo aggiornamento;
due ID diversi con delta disgiunti devono preservare entrambi gli
aggiornamenti. Il modello testato usa una tabella persistente
di idempotency key con unicità `(subject,request_id)`, fingerprint
e revisione, e serializza per account il protocollo tramite
`SELECT subject FOR UPDATE` **prima** dell'inserimento della chiave.
Una versione di catalogo successiva permette di continuare a leggere
i payload storici.

**Esportazione e ripristino logico:** una transazione
`REPEATABLE READ READ ONLY` esporta catalogo, head, soggetti fittizi,
voti BYTEA e registro delle richieste in un archivio JSON CI temporaneo
con SHA-256. Un'altra transazione modifica l'origine *dopo l'apertura
dello snapshot*: il backup ripristinato deve riflettere il punto
precedente. Si crea uno schema di tabelle nuove con nomi separati:
restaurati catalogo v1/v2, risposte storiche, revisioni e richiesta
idempotente già elaborata. Un file con checksum alterato viene
rifiutato; un file con riferimento FK impossibile, benché dotato
di un checksum nuovamente calcolato, fallisce con rollback completo
delle tabelle di destinazione. Il ripristino NON modifica le tabelle
sorgenti e non tocca alcuna risorsa DEMOS reale.

**Limiti importanti:** la prova contiene un protocollo di retry
*solo in uno script sperimentale*: non sono aggiunti header/ID al
frontend o al backend DEMOS né effettuati deploy. Le chiavi idempotenti
avrebbero bisogno di autenticazione, scadenza/retention e una policy
anti-riuso. Non è un vero backup `pg_dump`, un ripristino PITR, un
test dopo rottura disco, failover o perdita completa del server; il
checksum rileva alterazioni ma non dimostra autenticità crittografica.
Restano da verificare RLS/consenso reali, Android, pooler Supabase,
dimensionamento/costi e convenienza BYTEA. Nessuna migrazione, nessun
merge della PR DRAFT #247. OP-41 **In corso**, KPI-23
**Non verificato**, OP-42 **Da fare**.

**Evidenza CI verificata:** dopo due correzioni esclusivamente del
runner sperimentale (snapshot con `singleton`, commit `1e181df`;
esecuzione diretta del test POST per aggirare il problema intermittente
IPC di Node, commit `61963dd`), il run **#40101347542 SUCCESS**
conferma `OPINION_RETRY_BACKUP_PASS` nello step
`Exercise lost-ACK retry deduplication and consistent logical backup
restore`, oltre a `physical-storage` e `codec-tests` SUCCESS.
Sul medesimo commit `61963dd` sono SUCCESS anche:
Opinioni #40101347617, Security #40101347539,
Privacy erasure #40101347561, DPO #40101347543,
Logging #40101347601. La prima prova #40101131810 falliva
per omissione del campo `singleton` nel backup; la seconda
#40101232423 non raggiungeva il nuovo script per errore
intermittente di comunicazione del worker `node:test`
nella regressione POST esistente, non per un'asserzione del codec.
DOC-046 **PASS solo per il modello sintetico**; OP-41 resta
**In corso**, KPI-23 **Non verificato**, OP-42 **Da fare**.


## Backup PostgreSQL 17 reale su database CI indipendente (DOC-047)

Lo script `api/scripts/verify-opinion-pgdump-restore.sh` utilizza **i veri
programmi PostgreSQL 17 `pg_dump -Fc`, `createdb` e `pg_restore`** forniti
dall'immagine Docker `postgres:17` sulla macchina GitHub Actions. Opera
esclusivamente sul servizio PostgreSQL CI di GitHub, mediante credenziali
fittizie e verifica rigida di `GITHUB_ACTIONS`, host loopback, utente e
database `opinion_bitset_ci`. Non conosce né utilizza credenziali o URL
di Supabase. Gli archivi temporanei creati con `mktemp` vengono rimossi
da un `trap` alla fine del passo CI; non vengono caricati come artifact.

Al termine di DOC-046, `pg_dump` esporta in formato custom solo le
**cinque tabelle sintetiche** `ci_idem_catalog`, `ci_idem_head`,
`ci_idem_subjects`, `ci_idem_votes` e `ci_idem_requests`. Il file
viene letto dal programma reale `pg_restore --list`, mentre un file
deliberatamente troncato deve essere respinto. Successivamente
`createdb` crea un **secondo database vuoto**
`opinion_bitset_restore_ci` sullo stesso servizio effimero. Il ripristino
utilizza `pg_restore --exit-on-error --single-transaction --no-owner
--no-acl` e non modifica il database sorgente.

Il verificatore `api/scripts/verify-opinion-pgdump-restore.js` confronta
interamente le cinque tabelle sorgenti/ripristinate (compresi i
**Buffer BYTEA grezzi**), recupera la mappatura versionata e controlla
le fingerprint, decodifica sia i voti storici v1 sia i voti v2,
verifica la presenza del registro idempotente con la richiesta la cui
conferma HTTP era stata simulata come persa, controlla che il vincolo
unico impedisca il reinserimento di `request_id` già committati e
verifica che una scrittura transazionale sul DB recuperato non muti
l'originale.

Questa prova **non** costituisce un sistema di backup attivo su DEMOS,
non prova la perdita fisica del server, `WAL`/`PITR`, replica geografica,
conservazione/ripristino da storage remoto, ruoli e policy RLS reali,
autenticazione, consenso, cancellazione GDPR, costi, Android o
compatibilità globale con l'intero schema applicativo. Non introduce
`BYTEA` nelle route vere e non autorizza alcuna migrazione.
PR #247 **DRAFT**, OP-41 **In corso**, KPI-23 **Non verificato**,
OP-42 **Da fare**. **CI in verifica: non dichiarare PASS prima
del completamento del nuovo step.**
