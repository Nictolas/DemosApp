# DEMOS — Risposte alle Opinioni v2 senza DDL a ogni domanda

**Stato: proposta sperimentale isolata, NON integrata nel runtime e NON autorizzata per produzione.**

**Ambito di questa PR:** solo `api/experiments/`, test e questa documentazione.
Non modificare PR [#384](https://github.com/Nictolas/DemosApp/pull/384)
(catalogo ufficiale nel codice), PR [#464](https://github.com/Nictolas/DemosApp/pull/464)
(cache cifrata locale), o PR [#247](https://github.com/Nictolas/DemosApp/pull/247)
(codec binario a 2 bit). Non fare deploy, DDL, backfill o merge.

## Risultato cercato

- Catalogo pubblico nel **codice**: ID, testo, livello, approfondimento; **zero letture SQL** delle domande.
- Risposte personali **nel database**, con consenso verificato, e cache locale cifrata dove appropriato.
- Aggiunta di una 95ª opinione: **nuovo ID nel codice**, nessun `ALTER TABLE ADD COLUMN`.
- Rimozione dal catalogo: nascondere la domanda, **mai riciclare il suo ID** e mai cancellare automaticamente la risposta preesistente.
- Interfaccia/API Android legacy: mantenere formati `GET /api/opinioni-list` e `POST /api/opinioni/salva`, compresi `f/c/i`, conteggi e rilettura di conferma.
- Cambiamenti atomici con revoca consenso, nessun ripristino di dati cancellati dopo restore.

## Candidato A — documento JSONB per utente

Uno schema **una tantum**, in un'area non esposta alla Data API, memorizzerebbe:

```text
demos_private.opinion_answer_maps_v2
user_id (UUID PK/FK verso users) | answers (JSONB) | updated_at
utente sintetico               | {"energia_nucleare":"f", "nuova_opinione":"i"}
```

`NULL`/assenza della chiave significa *mai risposto*, non una quarta posizione.
Tre soli valori: `f`, `c`, `i`. Nessun nome, email o preferenza nel catalogo.
Il numero di colonne resta costante quando cambia la lista nel codice.

Gli aggiornamenti devono applicare **solo il delta**, con un `INSERT … ON CONFLICT DO UPDATE SET answers = existing.answers || EXCLUDED.answers` parametrizzato. NON fare `SET answers = $snapshot` da una copia client potenzialmente obsoleta: due dispositivi potrebbero sovrascriversi. Due modifiche alla *stessa* Opinione restano soggette all'ordine di commit (e a un eventuale protocollo CAS futuro); la cache della PR #464 deve invalidare/riconciliare correttamente.

L'esperimento `api/experiments/opinionAnswersV2Candidate.js` valida soltanto ID pubblicati in codice e valori `f/c/i`, conserva le vecchie risposte non più pubblicate, calcola cambiamenti reali e notifiche, e produce SQL parametrizzato. **Non viene importato da alcuna route.**

### DDL di esempio — NON eseguire senza gate

```sql
-- SOLO PROPOSTA. Richiede verifica ruoli effettivi, RLS, piano di rollback.
CREATE SCHEMA IF NOT EXISTS demos_private;
REVOKE ALL ON SCHEMA demos_private FROM PUBLIC, anon, authenticated;

CREATE TABLE demos_private.opinion_answer_maps_v2 (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(answers) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE demos_private.opinion_answer_maps_v2 FROM PUBLIC, anon, authenticated;
ALTER TABLE demos_private.opinion_answer_maps_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE demos_private.opinion_answer_maps_v2 FORCE ROW LEVEL SECURITY;
-- NON concedere privilegi al pool Render finché il ruolo e le policy
-- applicabili al suo collegamento reale non siano stati attestati.
```

Questo DDL non è una migration applicata o schedulata. Il controllo sulla forma JSONB
non sostituisce la convalida `f/c/i` e ID nel backend; valutare ulteriori constraints,
dimensione massima, limiti di payload e audit degli accessi prima del rilascio.

## Sequenza che deve essere provata PRIMA di ogni mutazione reale

1. In un'unica transazione: `BEGIN`, lock `public.users` della persona con `FOR UPDATE`, **nuova SELECT di consenso Art. 9 dopo il lock** e rifiuto se revocato o account assente. Questo ordine è già una protezione fondamentale della PR #384.
2. Leggere `answers` v2 `FOR UPDATE` e determinare il delta; per un valore identico non eseguire UPDATE. Le notifiche ai sostenitori nascono soltanto da un passaggio `f/c/i` verso un altro valore.
3. Applicare il delta JSONB parametrizzato nella stessa transazione; COMMIT. Una revoca concorrente deve acquisire il **medesimo lock su users** e cancellare tanto la forma legacy quanto v2 in modo atomico.
4. I lettori delle risposte devono autorizzare la richiesta e verificare lo stesso consenso; nessun fallback che recuperi risposte revocate o dati di altri utenti.
5. Adeguare tutte le route delle statistiche e dei Sondaggi, matching dei rappresentanti, esportazione/cancellazione GDPR, backup/replay e notifiche. Continuare a sopprimere aggregazioni con meno di 10 risposte, anche nei filtri territoriali.
6. Migrazione iniziale con *backfill controllato*, riconciliazione dei conteggi e delle risposte, nessuna scrittura doppia fuori transazione. Definire con precisione il punto di switch della fonte autorevole; nessuna lettura opportunistica della vecchia tabella dopo revoca.
7. Rollback prima di dismettere la tabella legacy: il backend precedente dipende dalle vecchie colonne. Conservare vecchi deploy e tabella finché la reversibilità dei dati non è provata. Una volta accettate nuove Opinioni presenti solo in v2, un semplice rollback del codice **non basta**: serve piano esplicito per le nuove risposte e compatibilità API.
8. Allineare la PR #384: il preflight `--schema-only` oggi pretende una colonna per ogni ID. Aggiornarlo **solo al momento del vero cutover v2**, lasciando inalterato il suo primo rilascio. Allineare le revisioni del catalogo usate da #464 e i controlli Android.

### Prove bloccanti

- Test automatici del codec e del delta, nuove/domande archiviate, valori invalidi, nessun lost update fra ID differenti.
- PostgreSQL 17 sintetico: merge atomico su un'unica riga, revoca/salvataggio concorrenti, idempotenza, 1 milione di ID simulati **non necessari**; usare carichi rappresentativi e un account test isolato.
- Comparazione **misurata**, non ipotizzata, su vari volumi/densità di risposte: spazio per utente, TOAST/WAL, p50/p95 GET e POST, aggregazione per Opinione e per geografia, costo di lettura SQL. Candidato B = `user_id, opinion_id, answer` in righe normalizzate; candidato C = bitset 2-bit della PR #247 con mapping ID/ordinale versionato e archivio.
- Autorizzazioni/RLS del pool **effettivo** su Render; Data API non esposta; consent revocation ed erasure incluse nell'eventuale recovery B2.
- Collaudo reale Android, aggiornamento coordinato del backend e del frontend, monitoraggio, rollback con gate umano.

## Decisione tecnica, non ancora presa

JSONB è un **candidato semplice e flessibile**, non una promessa di costi minori.
Il formato con una riga per risposta può facilitare alcune aggregazioni ma aumentare
il numero di righe fino a 94 per utente. La bitmap 2-bit può ridurre byte di payload
ma richiede un mapping ID/versione sicuro e test reali delle query.

La PR #247 ha già confrontato formati binari e colonne TEXT su PostgreSQL sintetico
con risultati di risparmio fisico modesti a densità bassa: **non** adottare un
formato senza benchmark e compatibilità end-to-end. Obiettivo costi/free-tier
a 1 milione di utenti **non verificato**.

**Fonte autorevole corrente:** ancora `public.opinioni_risposte` a colonne,
finché un rilascio futuro esplicito e verificato non cambia il contratto.


## Prime misurazioni replicabili (30 ottobre 2026)

**Riproduzione in CI:** node api/scripts/benchmark-opinion-answer-layouts-ci.js nel workflow
Opinion answers v2 — isolated research della PR #483. Il benchmark rifiuta
connessioni fuori dal database PostgreSQL 17 effimero, locale, opinion_answers_ci
in GitHub Actions. Sono utilizzati **solo 1.200 utenti e 94 domande sintetiche**,
con densità deterministica del 9% oppure del 45%. Nessuna credenziale o risposta
di DEMOS reale è letta. La terza struttura è normalizzata con PK
(user_id, opinion_id) e indice (opinion_id, answer, user_id).

La misura dello spazio usa pg_total_relation_size, **compresi gli indici**,
e quindi rappresenta tabella+indici in queste fixture, non spazio di rete,
backup, piani Supabase o costo fatturabile. I tempi sono EXPLAIN ANALYZE
server-side con 12 ripetizioni per richiesta, **non** latenze HTTP, P95
di produzione o un carico concorrente. Non è stata confrontata in questa
suite la bitmap BYTEA della PR #247.

| Densità | 94 colonne TEXT | JSONB un documento/utente | Righe normalizzate |
| --- | ---: | ---: | ---: |
| 9%, spazio totale | 163.840 B | 344.064 B | 1.376.256 B |
| 45%, spazio totale | 245.760 B | 1.179.648 B | 6.979.584 B |
| 9%, p50 aggregazione singola Opinione | 0,188 ms | 0,292 ms | 0,051 ms |
| 45%, p50 aggregazione singola Opinione | 0,238 ms | 0,466 ms | 0,145 ms |
| 9%, p50 lettura di un utente | 0,019 ms | 0,011 ms | 0,020 ms |
| 45%, p50 lettura di un utente | 0,020 ms | 0,016 ms | 0,043 ms |

L'aggregazione ha restituito **conteggi identici** nelle tre strutture in
entrambe le densità. La struttura a righe è più rapida su una singola domanda
in questo benchmark (indice specifico) ma usa molto più spazio; JSONB elimina
il DDL per domanda ma usa più spazio rispetto alle 94 colonne sparse.
**Non si può sostenere che JSONB risparmi spazio o costo** in base ai dati.
I test SQL con lock e revoca su PostgreSQL sintetico verificano soltanto
invarianti isolate; non sostituiscono l'integrazione con le vere route GDPR.

### Interpretazione e scelta sospesa

1. La struttura **attuale** usa meno spazio nei due campioni, ma richiede
   un'altra colonna per ogni domanda aggiunta.
2. **JSONB** soddisfa il requisito di nessun DDL per nuova domanda, ma il
   costo di memorizzare le chiavi testuali per ogni utente è concreto.
3. Le **righe normalizzate** rendono l'aggiunta di nuove domande semplice,
   però presentano il maggior overhead per record e indici nel campione.
4. La **bitmap 2-bit con ID immutabili e manifest persistente**, oggetto
   della PR #247, è una quarta possibilità: non duplicare il suo lavoro,
   ma richiedere benchmark comparabili di aggregazioni e GDPR, compreso
   il caso di aggiunta/rimozione domanda, prima di scegliere.
5. Una soluzione può vincere per spazio e perdere per costo delle query:
   la scelta deve considerare contemporaneamente Sondaggi, matching,
   revoche, profilo/caching e rollback su Android vecchi.

**Decisione attuale: NO-GO su una migrazione schema.** Mantenere la PR #483
sperimentale e separata fino a confronto completo, test end-to-end
con consenso, GDPR, migrazione dei dati e autorizzazione specifica.


## Dipendenze applicative verificate (inventario dal codice esistente)

Prima di passare da ricerca a implementazione, tutte le seguenti parti
devono leggere/scrivere la **stessa fonte autorevole** e rispettare
consenso, diritti GDPR e compatibilità:

| Componente | Dipendenza da correggere soltanto nel futuro ramo di integrazione |
| --- | --- |
| api/routes/compatibility.js | GET Opinioni N/R/CO/E: proiezione delle colonne per grado e formato Android storico |
| api/routes/opinioni/compatibility.js | Lettura risposte personali e payload legacy |
| api/routes/opinioni/user-answers.js | POST Salva, notifiche su cambio posizione, lock e controllo consenso |
| api/routes/users/profile.js | Lettura e aggiornamento opinioni e fonti; allineare anche i metadati fonti_opinioni |
| api/utils/sondaggiTextBulk.js | Sondaggi nazionale/territoriali, aggregazioni e soglia minima 10 |
| api/routes/opinioni/stats.js | Statistiche per età, sesso, regione e singola opinione |
| api/services/politicalMatchingService.js | Matching tra rappresentanti e persone |
| api/services/politicalConsentService.js | Portata della revoca e tabelle con dati politici |
| api/services/privacyDataExportService.js | Export completo delle opinioni, anche ID storici |
| api/services/privacyErasureLedgerService.js | Cancellazione account, revoca e replay dopo ripristino |
| api/scripts/checkOpinionCatalogParity.js | Preflight attuale: una colonna TEXT per ogni ID pubblicato; aggiornare soltanto al cutover v2 |

Questo inventario riguarda le dipendenze principali viste nei file attuali;
non è un audit completo di ogni SQL dinamica, trigger, view, amministrazione,
script storico o cliente Android. Eseguire una nuova ricerca repository-wide e
un inventario PostgreSQL di funzioni/trigger/viste al gate di integrazione.

**Rischio specifico:** il salvataggio del Profilo conserva fonti_opinioni
in JSONB nella tabella attuale. Un eventuale spostamento delle sole risposte
senza includere la semantica delle fonti potrebbe creare incoerenza e
trattamento GDPR incompleto. Nessuna fonte va eliminata o convertita senza
piano approvato e testato.

**Ulteriore barriera:** prima del backfill, consentire al sistema di riconoscere
account con consenso revocato/cancellati e preservare la validità del ledger
di revoca anche dopo PITR/restore. Una copia legacy non può mai diventare
un fallback che ricrea dati personali cancellati.


## Confronto stesso campione con i codec reali della PR #247 (30 ottobre 2026)

Il benchmark di questa PR ora legge i tre codec della PR #247 **direttamente
da uno snapshot Git immutabile** (commit 17c935e5ab6e7500297d14e4e3b9c2e822a1a459),
tramite un secondo checkout GitHub Actions. Nessun codec è copiato o
modificato dalla PR #483. Il confronto si svolge su **esattamente le stesse
risposte sintetiche** per 1.200 utenti, 94 Opinioni e densità del 9%/45%.

Per i tre formati BYTEA è presente un campo catalog_version INTEGER per
ogni utente. **Non è conteggiata l'eventuale tabella condivisa dei manifest
storici**, né il costo di recupero della versione/rotazione dei cataloghi,
di conversione del dato o di locking read-modify-write. La query SQL
*ad hoc* per leggere un singolo bitset sparse usa una funzione temporanea
PL/pgSQL che scorre i byte; è un riferimento sperimentale, NON un decoder
ottimizzato di produzione. Mancano fonti_opinioni, consenso e indici
territoriali, ugualmente per tutte le tabelle. Dimensioni su PostgreSQL 17
con PK INTEGER sintetica, non UUID reale.

### Spazio totale tabella più indici (pg_total_relation_size)

| Densità | Colonne TEXT | JSONB | Una riga/risposta | 2-bit fisso | 2-bit trimmed | 2-bit sparse |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 9% | 163.840 B | 344.064 B | 1.376.256 B | 163.840 B | 163.840 B | 147.456 B |
| 45% | 245.760 B | 1.179.648 B | 6.979.584 B | 163.840 B | 163.840 B | 188.416 B |

### Aggregazione di una singola Opinione: p50 SQL server-side

| Densità | Colonne TEXT | JSONB | Righe | Fisso | Trimmed | Sparse (funzione PL/pgSQL) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 9% | 0,120 ms | 0,172 ms | 0,033 ms | 0,171 ms | 0,174 ms | 1,910 ms |
| 45% | 0,147 ms | 0,334 ms | 0,105 ms | 0,275 ms | 0,280 ms | 3,145 ms |

Tutti e sei i formati producono **i medesimi tre conteggi f/c/i**.
Le misure (12 ripetizioni, EXPLAIN ANALYZE) sono soggette a variabilità
runner, pagina e planner. Non simulano consenso, rete, API, distribuzione
territoriale, milioni di utenti, aggiornamenti concorrenti o un costo mensile.

Il formato sparse risparmia 16.384 B sulla tabella al 9% (solo **13,65 B
per utente** in questo campione), ma l'aggregazione sperimentale è circa
16 volte più lenta della TEXT in p50; a densità 45% sparse usa
**24.576 B in più** del bitset fisso. La bitmap fissa migliora lo spazio
rispetto a TEXT nel campione al 45%, non al 9%; le sue aggregazioni sono
comunque più lente in questa misura. Non c'è un formato universalmente
migliore.

### ID immutabili, aggiunta e rimozione dal catalogo

La PR #483 ora prova con i codec della #247 che si possa appendere un
ID 95 senza cambiare gli ordinali delle 94 domande iniziali. Per
"eliminare" una domanda pubblicata, il catalogo visibile può nasconderla,
**ma lo slot storico deve restare nel manifest di decodifica**. Rimuovere
fisicamente un ID da un elenco ordinato e ricompattare gli slot non è
sicuro: confonderebbe le vecchie risposte fra Opinioni diverse. Gli ID
non possono mai essere riciclati.

Un manifest storico nel codice (senza query al DB per il catalogo)
è possibile solo se ogni release conserva la possibilità di
decodificare TUTTE le versioni ancora persistenti. Non viene garantito
automaticamente dal prototipo: servono test di upgrade e rollback, e
gestione di versioni eventualmente sconosciute. Se il manifest
versionato fosse invece una tabella SQL, sarebbe necessario chiarire
come evitare le riletture nel normale percorso applicativo.

**Decisione:** mantenere il vecchio schema fino a una scelta condivisa
e motivata. I dati non giustificano da soli la migrazione BYTEA o JSONB,
e l'attuale esigenza di nuove colonne non autorizza a perdere risposte,
compatibilità Android o garanzie GDPR.


## Prova di backfill e rollback reversibile (30 ottobre 2026)

Aggiunti il prototipo **inattivo** di verifica dei dati
`api/experiments/opinionAnswersV2BackfillCandidate.js` e il test SQL
`api/tests/opinionAnswersV2Backfill.pg.test.js`. Il test opera soltanto
su tabelle `ci_v2_bf_*` di PostgreSQL 17 effimero, con nove utenti e
94 colonne completamente **fittizi**. Non è un migratore di produzione.

Il test copre:

- Copia di tutte e sole le risposte non nulle `f/c/i` dalle 94 colonne
  alla mappa JSONB; un valore non valido causa rollback, non correzione
  silenziosa. Le fonti JSONB restano nella vecchia tabella durante la
  prova: la loro migrazione **non è implementata**.
- Ogni account va bloccato con `FOR UPDATE`; solo **dopo** il lock
  si rileggono consenso e stato di cancellazione. Account senza consenso,
  dati vuoti o con segnale di cancellazione ricostruito da un registro
  esterno **non** vengono copiati.
- L'operazione è idempotente: una seconda copia non deve sovrascrivere
  una risposta già presente nella nuova struttura. Se cambia una
  risposta legacy dopo la prima copia, o se v2 contiene risposte che
  non esistono nel sistema precedente, il test segnala **conflitto**:
  l'assenza di errori SQL non significa migrazione corretta.
- Salvataggio/copia in attesa del lock e revoca del consenso in
  concorrenza: la revoca elimina entrambe le rappresentazioni e una
  copia in coda non può far riapparire i dati.
- `rollbackCoverage` impedisce un ritorno cieco al formato precedente
  se esistono nuovi ID non rappresentabili (es. la 95ª Opinione).
  `rollbackParity` blocca anche le modifiche a Opinioni *già esistenti*
  che siano presenti solo nella nuova struttura. Il rollback del solo
  codice può altrimenti perdere o riportare indietro le risposte.

Il registro di cancellazione usato nel test è una **tabella fittizia
già ripopolata** per simulare un evento esterno al ripristino. Un registro
conservato nello stesso snapshot del DB potrebbe essere riportato
indietro assieme alle risposte: questo test **non prova** un ripristino
reale da B2 e non sostituisce l'integrazione con il ledger GDPR esistente.

### Sequenza di rilascio possibile — NON autorizzata

1. **Preparazione:** inventariare ogni percorso SQL/HTTP/Android e la
   posizione delle fonti; eseguire parità 94/94, verifica degli account,
   consenso e rischi di ripristino. Escludere qualunque autodeploy,
   merge o modifica del database da questa PR di ricerca.
2. **Ombra (solo dopo autorizzazione):** predisporre una tabella
   privata v2 e permessi strettamente necessari; copia con lock sullo
   stesso utente, consenso verificato dopo lock e registro di
   cancellazione autorevole. Verificare la parità di risposte/consensi
   e fermarsi sui conflitti. Non eliminare le 94 colonne.
3. **Scritture coerenti:** definire un'unica autorità per le risposte e
   instradare **tutti** i writer, incluse API legacy e Profilo, attraverso
   il medesimo protocollo atomico di consenso/revoca. Nessuna doppia
   scrittura eventualmente incoerente e nessuna copia opportunistica
   da snapshot del client.
4. **Switch controllato:** adeguare GET/POST, Sondaggi, statistiche,
   matching, fonti, GDPR export/cancellazione, cache #464, catalogo
   #384 e vecchi Android. Su database testare i conteggi con soglia
   minima 10 e una revoca che riduce una cella da 10 a 9.
5. **Rollback prima di accettare nuove Opinioni:** verificare
   parità *di valori*, non solo di ID. Se v2 accetta un ID senza
   colonna legacy o una modifica non sincronizzata, il vecchio
   deploy non può essere ripristinato senza una procedura di recupero
   separata e senza rischi di perdita di dati.
6. **Pulizia successiva:** dismettere l'architettura precedente solo
   dopo collaudi Android reali, verifica restore/erasure B2,
   benchmark rappresentativi, piano di rollback dimostrato e
   autorizzazione specifica per ogni passo irreversibile.

**Gate:** il completamento dei test isolati non autorizza alcun
`CREATE TABLE`, backfill reale, dual write, cambio di fonte,
pubblicazione, merge o deploy. Lo schema attuale resta autorevole.


### Nuovo blocco preventivo: inventario delle colonne storiche

La migrazione sperimentale ora richiede che l'elenco dei 94 ID utilizzato
per convertire le risposte coincida con **tutte** le colonne storiche
presenti in `public.opinioni_risposte`, non soltanto le Opinioni
visibili nel catalogo corrente. La verifica deve controllare
`information_schema.columns` e imporre il tipo PostgreSQL `TEXT`
per ogni colonna di risposta. `user_id` e `fonti_opinioni` sono
campi di servizio, non Opinioni.

Questo preflight va eseguito **una sola volta prima del backfill**
con accesso di sola lettura ai metadati, senza nuove query per ogni
apertura dell'app. Se manca un ID, appare una colonna storica non
registrata o il tipo è incompatibile, bloccare la migrazione: non
ignorare la colonna e non eliminarla. Gli ID archiviati devono essere
nel manifest storico anche se non più pubblicati.

Il controllo è implementato nel candidato di ricerca
`api/experiments/opinionAnswersV2BackfillCandidate.js` e provato
nei test unitari e PostgreSQL sintetici. **Non è ancora collegato
al database DEMOS**. I controlli sul catalogo della PR #384
rimangono indipendenti, per evitare di modificarne il rilascio.


## Nuove verifiche di compatibilità e ripristino (30 ottobre 2026)

### Formato delle API legacy

Il candidato **non collegato alle route**
`api/experiments/opinionAnswersV2CompatCandidate.js` riceve solo
metadati pubblici delle Opinioni e un oggetto di risposte già autorizzato.
Riproduce il formato `{success,data:[{id,text,grado,userAnswer}],grado,total}`
usato dalle API `GET /api/opinioni-list` e
`GET /api/opinioni/opinioni-list`: `f/c/i` oppure `null` per le
risposte mancanti. Non restituisce le risposte a Opinioni archiviate,
né `user_id` o `fonti_opinioni` come campi della risposta pubblica.
Una 95ª Opinione può avere risposta nella mappa senza esigere una
nuova colonna. La proiezione è *solo dopo* autenticazione, verifica
dello stato dell'account, consenso politico e protezione del ripristino.
I test comparano payload sintetici vecchi/nuovi, senza chiamare API reali.
Non è stato cambiato alcun endpoint Android/frontend.

### Replay GDPR dopo un backup

Il test **solo PostgreSQL 17 sintetico**
`api/tests/opinionAnswersV2Restore.pg.test.js` simula un backup che
reintroduce risposte e consenso *precedenti* alla revoca/cancellazione.
Il gate fittizio rimane chiuso finché un insieme completo di eventi
esterni *inventati* non è riconciliato. Il test verifica che:

- letture e scritture sono bloccate con gate chiuso; un ripristino non
  può riaprire automaticamente gli accessi;
- la revoca elimina le risposte sia nella tabella vecchia sia in
  quella v2, e l'eliminazione account elimina entrambe;
- i successivi tentativi di salvare/leggere un soggetto revocato o
  eliminato sono negati;
- il replay idempotente non riscrive i dati eliminati;
- il gate dev'essere richiuso anche per un eventuale secondo restore.

**Limite fondamentale:** il test NON esegue `pg_restore`, B2, PITR,
un vero ledger esterno, ruoli RLS o le route dell'app. Il requisito
"due eventi" è unicamente un controllo sulla fixture fittizia, NON
una prova che un archivio esterno sia completo. In produzione,
**il blocco dell'accesso deve essere applicato fuori dal database
restaurabile**, o garantito dall'orchestrazione prima che il database
sia nuovamente raggiungibile; un flag ripristinato insieme al database
potrebbe essere erroneamente `true`.

### Dipendenze esistenti osservate

`api/services/privacyErasureLedgerService.js` e
`api/services/politicalConsentService.js` eliminano attualmente
dati della tabella legacy `opinioni_risposte`; la futura tabella
v2 non è ancora nel loro perimetro. Lo stesso vale per
`api/services/privacyDataExportService.js`, che legge le opinioni
dalla tabella legacy. Questi componenti richiederanno integrazione
coordinata **prima** di abilitare v2. Non si deve aggiungere una
lettura fallback dai vecchi dati se il consenso è stato revocato.

**Stato:** controlli sperimentali separati dalle PR #384/#464
e dal lavoro GDPR/B2. Nessuna modifica a produzione,
Supabase, Render, schema, API runtime, o backup reali.


## Ricerca sulla copertura GDPR v2: cancellazione, export, consenso dopo restore

L'esperimento **non importato dalle route**
`api/experiments/opinionAnswersV2GdprCandidate.js` contiene:

- un comando DELETE parametrizzato, specifico della futura
  `demos_private.opinion_answer_maps_v2`, per l'uso *esclusivamente*
  dentro una transazione GDPR che ha già acquisito il lock dell'utente;
  l'assenza della nuova tabella produce un **errore**, non un successo
  fittizio;
- un proiettore per l'export GDPR del singolo interessato, vincolato
  all'ID richiesto, che include anche gli ID di Opinioni archiviate.
  Il proiettore **non include** `fonti_opinioni`: il percorso futuro
  deve esportare tali fonti separatamente, con autorizzazione e coerenza;
- un pianificatore conservativo per gli eventi **successivi o coincidenti**
  con il timestamp del backup ripristinato. Revoche/cancellazioni
  impongono la rimozione delle risposte da **entrambe** le strutture.
  Una nuova concessione del consenso *successiva alla revoca* non
  fa riapparire le vecchie risposte che erano nel backup.

Il test `api/tests/opinionAnswersV2Gdpr.pg.test.js` verifica su
PostgreSQL 17 effimero la cancellazione atomica delle due tabelle con
consenso, il rollback integrale quando una query fallisce, l'export
degli ID archiviati, il caso revoca→nuovo consenso e la mancata
cancellazione silenziosa quando la nuova tabella non esiste.

### Blocco logico individuato nel replay attuale — nessuna modifica al servizio

L'implementazione corrente di
`api/services/privacyErasureLedgerService.js`, nella funzione
`applyCurrentPrivacyState`, seleziona l'**ultimo evento**
`political_consent_revoked`/`political_consent_granted` per
interessato e cancella le opinioni soltanto se quell'ultimo evento
è una revoca.

Scenario da gestire **prima di qualunque passaggio a v2**:

1. Il backup contiene risposte originali `A`.
2. Dopo il backup l'interessato revoca il consenso: `A` viene cancellata.
3. Successivamente l'interessato concede un nuovo consenso, **senza**
   esprimere nuovamente `A`.
4. Un restore riporta alla luce il backup con `A`.
5. Un replay che considera soltanto l'**ultimo** consenso (concesso)
   non cancella `A`: rischio di *resurrezione di dati cancellati*.

Occorre quindi riprodurre in ordine cronologico i **cambiamenti
successivi al punto di ripristino** su un registro esterno completo,
senza ritenere che un nuovo consenso autorizzi il recupero automatico
di dati cancellati prima della nuova concessione. Questo problema è
rilevante anche per lo schema legacy, non soltanto per v2. Il fix
del servizio GDPR reale spetta al flusso GDPR/B2 coordinato, e **non**
viene introdotto in questa PR di ricerca.

**Condizioni non provate:** completezza e integrità del ledger esterno,
timestamp affidabile del backup, orchestrazione che chiuda l'accesso
fuori dal DB fino al replay, identità/permessi del pool Render,
regole RLS, esportazione completa di `fonti_opinioni`, restore B2
reale e coerenza di tutte le API/Android. La documentazione non
autorizza un cutover, né i test sintetici dimostrano questi requisiti.


## Fonti delle Opinioni — contratto v2 sperimentale (30 ottobre 2026)

La versione in uso conserva già `fonti_opinioni` come JSONB nella
tabella delle risposte. La pagina profilo usa `fonti_opinioni[id]` e
mostra `unknown` per fonti assenti. Il modulo sperimentale
`api/experiments/opinionAnswersV2SourcesCandidate.js` non è collegato
al runtime e prepara una **seconda mappa JSONB `sources`** nella futura
riga per utente, accanto a `answers`:

```text
user_id | answers: { opinione_0:"f", ... } | sources: { opinione_0:"fonte...", ... }
```

L'aggiunta o il nascondimento di Opinioni riguarda soltanto gli ID
del catalogo nel codice: **nessuna colonna dedicata per nuova Opinione**.
Tuttavia, la presenza di una nuova colonna JSONB `sources` sarebbe
una modifica **una tantum al futuro schema v2**, da includere nella
migrazione solo previa autorizzazione; non è stata applicata.

Proprietà verificate nel codice di ricerca:

- Una copia legacy completa deve trasferire **insieme** risposte e
  `fonti_opinioni`. La migrazione si interrompe su sorgenti senza
  ID storico noto o valori incompatibili. Un'Opinione archiviata non
  viene mostrata nel profilo pubblico, ma la fonte rimane disponibile
  per export GDPR e rollback autorizzato.
- Gli aggiornamenti delle fonti usano **delta JSONB**, non la scrittura
  dell'intero snapshot client. Una fonte vuota o `null` rimuove
  soltanto la chiave specificata; le fonti di altri ID restano intatte.
- Il profilo conserva `source: 'unknown'` quando la fonte non esiste,
  rispettando il contratto del client storico.
- Il candidato export GDPR adesso include facoltativamente
  `sources_by_id` e `answer_sources_included: true` quando la riga
  v2 contiene il campo `sources`. Una riga di ricerca che contiene
  soltanto `answers` segnala invece chiaramente
  `answer_sources_included: false`. **Questo non sostituisce**
  l'esportazione reale della fonte autorevole al cutover.
- Il salvataggio e la cancellazione di risposte e fonti devono
  condividere lock dell'utente, controllo del consenso dopo il lock
  e un'unica transazione; la futura revoca deve eliminare anche
  il documento `sources` e i dati del legacy.

**Limitazioni:** testo originale delle fonti non normalizzato, possibili
fonti storiche non conformi da valutare prima della migrazione,
percorso autorizzativo non implementato, costo storage aggiuntivo
non ancora misurato per la densità reale, nessuna integrazione
con il Profilo Android o la cache PR #464. Non abilitare v2
finché export/cancellazione GDPR e rollback non attestano anche le fonti.


## Nuova candidata preferenziale: una sola colonna per le Opinioni future

**Raccomandazione di ricerca aggiornata (30 ottobre 2026):** conservare
tutte le 94 colonne TEXT esistenti nella stessa tabella
`public.opinioni_risposte`, conservare `fonti_opinioni` JSONB
**senza spostarla**, e proporre **un'unica nuova colonna NULLABLE
`answers_extra JSONB`** per le Opinioni aggiunte in seguito.

Non va eseguito ora alcun DDL reale. La modifica **una tantum** allo
schema esistente richiede approvazione, valutazione di lock, RLS, backup
e rollout. Le Opinioni n. 95, 96, ... entrerebbero nella mappa
`answers_extra` con ID immutabili, senza altre ALTER TABLE. Una
domanda archiviata viene nascosta nel catalogo in codice, non
cancellata dalle risposte storiche. Un ID non va mai riutilizzato.

Questa terza architettura elimina la necessità del **backfill delle
94 risposte esistenti**, evitando conversione massiva, doppia copia,
rischio di divergenze e necessità di modificare subito tutte le
aggregazioni vecchie. Anche per le Opinioni future, un'unica SELECT
della riga corrente può ottenere colonne esistenti, `answers_extra`
e `fonti_opinioni`. L'utente non paga una lettura SQL in più
soltanto perché esiste una nuova Opinione.

### Benchmark fonti incluse — vecchio schema, JSONB completo, 2-bit fisso

`api/scripts/benchmark-opinion-sources-ci.js` usa 1.200 utenti
e 94 domande fittizie, con fonti di circa 95 byte sul 20% delle risposte
nel campione poco compilato e 40% nel campione più compilato.

| Risposte compilate | 94 TEXT + fonti | JSONB completo + fonti | 2-bit fisso + fonti |
| --- | ---: | ---: | ---: |
| 9%, tabella+indici | 520 KiB | 576 KiB | 400 KiB |
| 45%, tabella+indici | 712 KiB | 1.464 KiB | 1.776 KiB |

In questo esperimento il 2-bit fisso non ha un vantaggio stabile
sul layout già esistente: è più compatto nel caso 9%, molto più
voluminoso nel 45%. Il comportamento può riflettere differenti
decisioni PostgreSQL di compressione/TOAST, non una proprietà generale
della codifica a 2 bit. Anche il WAL delle 80 scritture fittizie
varia: non usarlo per predire fatture Supabase.

### Benchmark specifico ibrido — 94 colonne conservate, due nuove Opinioni

`api/scripts/benchmark-opinion-hybrid-ci.js` confronta tabelle
sintetiche gemelle dopo **VACUUM FULL** (a differenza dell'esperimento
precedente): 1.200 utenti e 94 colonne TEXT con fonti identiche.
La variante contiene una sola colonna NULLABLE `answers_extra`.
Successivamente 120 utenti compilano due nuove Opinioni in JSONB.
Le vecchie 94 risposte e tutte le fonti restano identiche.

| Densità | Vecchia tabella | Ibrida, campo extra vuoto | Ibrida, 120 utenti con 2 nuove risposte |
| --- | ---: | ---: | ---: |
| 9% | 376 KiB | 376 KiB | 384 KiB |
| 45% | 1.304 KiB | 1.304 KiB | 1.320 KiB |

Differenze osservate: **0 KiB misurabili prima di nuovi dati**,
poi **+8 KiB** (9%) o **+16 KiB** (45%). Il p50 della SELECT di un utente
è rimasto identico nel test: 0,014 ms e 0,021 ms rispettivamente.
I conteggi di colonne restano invariati dopo aver inserito le
Opinioni n. 95 e 96.

**Non confrontare direttamente le dimensioni assolute delle due
tabelle sopra:** i benchmark usano diversi ordini di INSERT/UPDATE
e il test ibrido compatta i file mediante VACUUM FULL. Questi non
sono dati di produzione, benchmark a un milione di utenti o stime
attendibili dei costi commerciali.

### Prototipo verificabile e dipendenze ancora da integrare

`api/experiments/opinionAnswersV2HybridCandidate.js` è un modulo
**non importato dalle route in uso**. Distingue gli ID storici
dalle nuove Opinioni pubblicate e prepara patch senza colonne per
domanda futura. La proiezione del Profilo conserva l'attuale payload
e `buildHybridAnswerSelect` prepara **un solo SELECT** con le colonne
TEXT per quel grado e le mappe JSONB della stessa riga.

`api/tests/opinionAnswersV2Hybrid.unit.test.js` e
`api/tests/opinionAnswersV2Hybrid.pg.test.js` simulano aggiunta di
95ª/96ª Opinione, modifica senza sovrascrivere risposte esistenti,
archiviazione, fonti intatte, cancellazione dell'intera riga su
revoca e blocco della scrittura in attesa del lock. Il preflight
riconosce `answers_extra` come campo di servizio **opzionale**
di tipo JSONB, preservando la verifica di tutte le 94 colonne TEXT.

Restano indispensabili prima di qualsiasi cutover:
- Adeguare **tutti i writer** (salvataggio personale e profilo Admin),
  mantenendo il lock dell'utente e il controllo consenso dopo lock
  nella stessa transazione; non inserire nuovi ID tramite SQL
  costruita da testo fornito dal client.
- Adeguare GET di compatibilità, Profilo, Android e cache locale
  #464: la domanda nuova viene dal catalogo #384, il suo valore
  dalla mappa; nessuna lettura del catalogo da Supabase.
- Adeguare Sondaggi, matching, statistiche e export GDPR per
  risolvere gli ID oltre le 94 colonne; mantenere la soglia privacy
  delle aggregazioni e la semantica delle fonti.
- La cancellazione della **stessa riga** dovrebbe coprire anche
  `answers_extra`, ma va verificata end-to-end su tutti i percorsi
  GDPR e dopo restore/consenso revocato. Il rischio
  revoca→nuova concessione→restore individuato nel ledger B2
  non è risolto da questa architettura.
- Verificare permessi, RLS, backup, query planner, WAL e regressioni
  Android con dati di prova realistici; evitare la riattivazione
  di risposte eliminate durante aggiornamenti, rollback o replay.

**Decisione di ricerca:** dare priorità alla soluzione **ibrida**
rispetto alla migrazione completa JSONB/bitset, perché soddisfa il
requisito "nessun DDL per ogni nuova Opinione" con minore spostamento
di dati. La PR resta Draft e **NO-GO produzione**: nessun ALTER TABLE,
merge, backfill reale, modifica alle route o deploy autorizzato qui.


## Adattatori di salvataggio e compatibilità ibrida (30 ottobre 2026, test isolati)

La revisione del percorso POST delle Opinioni e del Profilo Admin ha
evidenziato due dettagli da preservare durante l'integrazione:

**Primo salvataggio misto.** Se un utente non ha ancora una riga nella
tabella delle risposte e invia insieme una delle 94 Opinioni storiche
e una nuova Opinione, fare prima UPDATE della vecchia colonna e poi
UPSERT del campo JSONB perde la risposta storica: UPDATE non trova
alcuna riga. Il nuovo candidato
api/experiments/opinionAnswersV2HybridCandidate.js prepara invece
UN SOLO INSERT ... ON CONFLICT DO UPDATE, con tutti i valori storici
e la patch JSONB. Il test PostgreSQL verifica il primo inserimento
misto e successivi aggiornamenti a ID diversi, senza sostituire
l'intera mappa. I nomi delle vecchie colonne derivano esclusivamente
dal manifest immutabile validato nel codice; i valori sono parametri SQL.

**Due contratti di risposta distinti.** Nell'endpoint legacy
GET /api/opinioni/opinioni-list, il campo id nel JSON restituito
è ancora il testo della domanda normalizzato (spazi in underscore
e minuscolo), mentre la risposta viene individuata con il vero ID
stabile. Nel GET Opinioni del Profilo, il campo id è invece l'ID
stabile. Convertire indiscriminatamente entrambi al nuovo ID
potrebbe rompere vecchi client Android. Gli adattatori sperimentali
formatHybridLegacyGradePayload e formatHybridProfileOpinions
preservano deliberatamente i rispettivi formati, senza modificare
le route attive e senza ulteriore SELECT del catalogo.

**Notifiche e scritture inutili.** Un unico SELECT di risposte
esistenti con FOR UPDATE, dopo lock utenti e rilettura del consenso,
può distinguere risposta nuova (non notificare), posizione politica
cambiata (notifica secondo l'attuale ruolo e le attuali regole)
e valore invariato (saltare l'UPDATE e il relativo WAL).
planHybridAnswerChanges produce tale classificazione per vecchie
colonne e nuove chiavi insieme. Rimangono obbligatorie tutte le
verifiche esistenti per creare notifiche e le autorizzazioni.

**Concorrenza.** Le patch future applicate a chiavi JSONB differenti
non devono sostituire snapshot client completi. Le prove synthetic
PG17 serializzano le scritture tramite lo stesso lock utente,
preservano fonti e altre risposte, e bloccano eventuali scritture
dopo la revoca.

**Non è ancora integrazione live.** Il runtime ha ancora writer
Admin con una lettura di information_schema per ogni modifica;
la soluzione futura deve usare il manifest statico, non creare
nuove letture SQL ripetute. I test della PR #483 sono autonomi e
non coprono ancora il routing HTTP completo, le notifiche push,
le autorizzazioni tra utenti e un vero ripristino GDPR/B2.
Qualunque modifica schema o deploy richiede separata autorizzazione.


## Sondaggi e compatibilità politica con la soluzione ibrida — ricerca isolata

Il nuovo modulo sperimentale api/experiments/opinionAnswersV2AggregateCandidate.js,
non collegato alle route, prepara il percorso delle Opinioni future
anche per statistiche e matching, oltre ai GET/POST personali già provati.

- **Sondaggi nazionali e territoriali:** una sola query con CROSS JOIN
  LATERAL (VALUES ...) aggrega le colonne TEXT storiche e le nuove chiavi
  di answers_extra. Gli identificatori di colonna derivano esclusivamente
  dal manifest storico; le nuove chiavi JSONB sono validate rispetto al
  catalogo pubblicato **nel codice**. Nessuna interrogazione del catalogo
  SQL o di information_schema per aggiungere una nuova Opinione.
- **Consenso:** il join con utenti e consensi mantiene la precedenza
  esplicita di user_consents.political_opinions_consent sul valore base
  users.political_opinions_consent. Gli account non-persona sono
  esclusi. **Verificare account_type all'integrazione:** il codice
  Sondaggi esaminato usa il valore legacy PERSON; eventuali codifiche
  compatte richiedono un cambiamento coordinato, non una scelta in PR #483.
- **Territorio:** filtri statici per regione, provincia e comune, con
  valori geografici come parametri SQL, senza interpolazione del client.
- **Soglia privacy:** utilizza api/utils/politicalAggregatePrivacy.js
  con minimo 10 risposte valide f/c/i. Nel test PG17 Toscana/Livorno
  con 10 risposte è visibile; dopo una revoca e cancellazione scende a
  9 e non appare. Il totale nazionale può restare visibile a 10.
  Una cella regionale con un solo rispondente non viene pubblicata.
  **Attenzione:** la soglia di 10 non impedisce da sola inferenze
  per differenza tra aggregati sovrapposti; servono ulteriori garanzie.
- **Matching:** uno SELECT per gli utenti autorizzati può essere
  proiettato in mappe identiche con vecchi ID e ID futuri. I test
  usano anche gli algoritmi reali getOpinionCompletion e
  calculatePoliticalMatch: le nuove Opinioni partecipano al punteggio
  e le Opinioni archiviate no. **L'autorizzazione del singolo soggetto
  non è implementata dall'adapter**, e deve precedere la lettura.

L'esperimento limita ciascuna query aggregata a 128 Opinioni: un
catalogo futuro più grande richiederà batch nello stesso snapshot
consistente e nuovi benchmark, senza ricadere su una lettura per
Opinione né aumentare senza controllo le interrogazioni. Un errore
nella struttura deve bloccare la query.

Test: api/tests/opinionAnswersV2Aggregate.unit.test.js e
api/tests/opinionAnswersV2Aggregate.pg.test.js, con PostgreSQL 17
effimero e dati inventati. Coprono vecchie e nuove risposte,
prevalenza del consenso, esclusione organizzazioni, geografia a tre
livelli, parametri ostili, soglia 10→9, archiviazione e compatibilità
del matching con il calcolo dell'app.

**Stato Draft/NO-GO:** nessuna modifica a route Sondaggi, Statistiche,
politicalMatchingService, Render, Supabase o Android. RLS,
autorizzazioni, inferenza sui dati aggregati, restore GDPR/B2 e
cataloghi molto grandi sono ancora gate aperti prima del rilascio.


## Statistiche dettagliate: eta, sesso, regione — esperimento isolato

Il candidato api/experiments/opinionAnswersV2DemographicsCandidate.js
prepara una singola SELECT per l'Opinione specifica, sia essa una delle
94 colonne TEXT storiche, sia una chiave futura di answers_extra JSONB.
Non e importato da alcuna route: NON modifica DEMOS in produzione.

### Metadati verificati con accesso di sola lettura

In information_schema.columns della tabella public.users esistono
data_nascita (DATE), sesso (VARCHAR), genere (VARCHAR), account_type e
regione_residenza. Non e stata trovata la colonna anno_nascita.
Non sono state lette righe utente, solo nomi e tipi delle colonne.
Le route attuali delle statistiche utilizzano data_nascita e genere;
il nuovo prototipo usa data_nascita e sesso M/F per allinearsi al
campo unico previsto, senza convertirli ne leggere dati aggiuntivi.
I valori PERSON e P sono entrambi accettati come account persona
durante la transizione; le organizzazioni sono escluse.
Prima dell'integrazione va verificata la semantica effettiva dei
valori legacy e la completezza del campo sesso, senza inferenze.

### Proprieta testate

- Autorizzazione aggregata: conta solo account persona con consenso
  politico valido, dando la precedenza al consenso esplicito.
- I gruppi eta seguono le fasce preesistenti Under 18, 18-25,
  26-35, 36-45, 46-55, 56-65, 65+. Le date mancanti o future
  sono escluse dalle fasce.
- Il sesso accetta soltanto M/F presenti nella colonna sesso;
  valori nulli o fuori codifica non sono raggruppati arbitrariamente.
- Il filtro regionale riceve un parametro SQL, mai testo interpolato.
  Gli ID di colonna storica provengono dal manifest statico, mentre
  quelli JSONB sono limitati agli ID ufficiali pubblicati nel codice.
- Riuso del minimo applicativo di 10 risposte f/c/i, con una
  precauzione aggiuntiva: se una cella NON vuota e sotto soglia,
  sopprimere l'INTERO breakdown invece di mostrare soltanto le altre
  celle. In caso contrario il totale pubblico potrebbe permettere
  la ricostruzione indiretta della cella piccola per sottrazione.
- I test PostgreSQL 17 effimeri simulano 10 M + 9 F e la
  soppressione completa; con consenso esplicito il gruppo F sale
  a 10 e diventa visibile. Una revoca fa scendere 10 a 9 e
  sopprime il dettaglio; il caso di una sola persona in Lazio
  resta nascosto. I 94 vecchi ID e una nuova Opinione condividono
  la medesima regola, senza DDL per domanda.

### Limiti non risolti

La soppressione integrale riduce un vettore di inferenza ma non e
una garanzia generale contro differenze fra piu query, fasce,
geografie sovrapposte o pubblicazioni in momenti diversi.
Occorre una revisione delle statistiche pubbliche e dei limiti
di interrogazione prima di un'eventuale integrazione.
Le route attive /api/opinioni/stats restano inalterate: il prototipo
non dimostra parita completa delle API, dei dati reali o dei vecchi
client Android, ne autorizza un aggiornamento di Supabase.

Test automatici: api/tests/opinionAnswersV2Demographics.unit.test.js
e api/tests/opinionAnswersV2Demographics.pg.test.js.
Primo run corretto del nuovo codice: GitHub Actions #41090798270,
125 test PASS, benchmark completati. Dati soltanto sintetici.

**Stato Draft/NO-GO:** nessun merge, deploy, DDL o modifica alla
produzione. Le integrazioni con Sondaggi, Statistiche, Profilo,
matching, API Android, consenso e recupero GDPR/B2 rimangono separate.


## Contratto HTTP reale simulato, senza attivazione delle route

Il modulo sperimentale `api/experiments/opinionAnswersV2HttpContractCandidate.js`
monta un router Express separato per verificare il contratto di:

- `GET /api/opinioni/opinioni-list?grado=N` (autenticato): mantiene
  gli ID di risposta normalizzati dal testo, gli ID stabili utilizzati
  per leggere le risposte e il JSON legacy `{success,data,grado,total}`.
  La lettura avviene una volta sola per il soggetto autenticato.
- `GET /api/opinioni/stats/:opinionId` (statistiche pubbliche):
  mantiene il formato della risposta e non espone alcun totale o
  conteggio quando la soglia delle 10 risposte non e raggiunta.
- `GET /api/opinioni/stats/:opinionId/eta` e `/genere`: conserva
  la struttura `success,minimumCellSize,data` richiesta dai vecchi
  client; la proiezione sperimentale usa il campo attuale `sesso`
  M/F ma conserva la chiave JSON `genere` e la presentazione
  Uomo/Donna per il percorso nazionale.

Il router non legge direttamente alcun database. Riceve dipendenze
iniettate: autenticazione, catalogo nel codice, gate di restore,
lettura del solo soggetto dopo verifica del consenso, aggregazioni.
Tutti i dati nei test sono sintetici e le risposte HTTP sono
scambiate soltanto con un server locale temporaneo.

Le prove `api/tests/opinionAnswersV2HttpContract.unit.test.js`
verificano 401 prima di qualunque lettura, 400 su grado mancante,
403 quando il consenso non e valido, 404 per un ID archiviato,
500 generico se una lettura restituisce un soggetto diverso o
dati aggregati invalidi e 503 con gate GDPR chiuso, impedendo
letture personali e conteggi pubblici.

**Limiti essenziali:** l'autenticazione del test e un fake token.
`loadOwnAuthorizedRow` e un'astrazione: il suo implementatore
deve eseguire il controllo reale delle autorizzazioni e del
consenso in una vista/transazione coerente. Il gate di ripristino
deve essere esterno al DB restaurato o imposto prima della
riapertura del traffico. Il test NON prova il middleware reale,
RLS, le route regionali, le diverse etichette legacy regionali
di genere, il backend Render, Android ne restore B2.
Non importare il router nella produzione prima del lavoro
coordinato con #384, #464 e il flusso GDPR.

**Stato:** PR #483 Draft/NO-GO. Nessuna API runtime cambiata,
nessun deploy, merge, DDL o backfill reale.


## Route regionali HTTP: compatibilita Android e privacy (30 ottobre 2026)

Il modulo `api/experiments/opinionAnswersV2RegionalHttpCandidate.js`
e il test `api/tests/opinionAnswersV2RegionalHttp.unit.test.js`
sono SOLO sperimentali: server Express temporaneo, aggregate sintetiche
e dipendenze iniettate; nessuna importazione dalle route attive.

Il contratto riproduce ESATTAMENTE i tre URL regionali esistenti:

- `GET /api/opinioni/stats/:opinionId/regione/:regione`;
- `GET /api/opinioni/stats/:opinionId/eta/regione/:regione`;
- `GET /api/opinioni/stats/:opinionId/genere/regione/:regione`.

Le regioni sono risolte da `api/utils/regioniUtils.js`, con nomi
ufficiali e codici storici di DEMOS. Gli slug Emilia-Romagna,
Friuli-Venezia Giulia e Valle d'Aosta vengono normalizzati
senza query SQL. I nomi invalidi sono rifiutati con HTTP 400,
gli ID di Opinioni non pubblicate ricevono HTTP 404 e non
innescano interrogazioni di aggregazione.

Un dettaglio di compatibilita non ovvio: **la vecchia route
nazionale /genere converte u/d in Uomo/Donna, la route regionale
/genere/regione restituisce ancora u/d**. I due adattatori di
ricerca preservano deliberatamente tale differenza, convertendo
eventuali valori `sesso` M/F nella forma attesa solo al confine
HTTP. Questa decisione non cambia gli utenti, i loro dati,
ne i nomi delle API gia distribuite.

La route regionale pubblica conta una cella soltanto quando
raggiunge almeno 10 risposte; sotto soglia non presenta totale
ne conteggi. I dettagli eta/sesso applicano la regola piu
prudente della ricerca: se un sottogruppo non vuoto ha meno di
10 risposte, non viene pubblicato nessun altro sottogruppo
della stessa suddivisione. Il gate di replay GDPR deve essere
aperto **prima** di interrogare qualunque aggregato.

**Limiti:** le query regionali del router sono dipendenze finte
nei test; l'app reale dovra filtrare account persona, consenso
politico e territorio nella stessa query, con parametri SQL.
Resta una dipendenza sulla conversione dati `genere` -> `sesso`
e su `account_type` compatto P rispetto a PERSON. Occorre
prevenire differenze inferibili tra statistiche nazionali,
regionali o in momenti differenti: soglia 10 da sola non basta.
Le API provinciali/comunali dei Sondaggi hanno un percorso
separato e NON sono state simulate qui.

**NO-GO:** nessun merge, deploy, DDL, backfill o cambiamento
del middleware reale. Queste verifiche HTTP non sono un test
Android end-to-end, RLS, Supabase o ripristino B2.


## Copertura dei codici account e rischio di inferenza nazionale–regionale

Nel candidato `api/experiments/opinionAnswersV2AggregateCandidate.js`
la condizione per gli account persona comprende ora sia `PERSON`
(legacy) sia `P` (codice compatto). I test sintetici PostgreSQL
verificano che entrambi contribuiscano alle statistiche quando esiste
consenso, mentre `O` (organizzazione) rimane escluso. È una correzione
del solo prototipo: la query reale non viene modificata.

**Rischio aggiuntivo da risolvere prima del rilascio:** la soglia
minima di 10 per ciascun aggregato regionale non basta se sono
pubblicati contemporaneamente anche i conteggi nazionali.
Esempio fittizio: 10 rispondenti toscani tutti favorevoli,
un rispondente laziale contrario. Si potrebbe pubblicare il risultato
nazionale (10 favorevoli + 1 contrario) e quello toscano (10
favorevoli). La differenza rivela la scelta dell'unico rispondente
laziale, anche se il Lazio è nascosto.

Il candidato **non collegato a nessuna API**
`api/experiments/opinionAnswersV2RegionalPrivacyCandidate.js`
confronta i conteggi nazionali con **tutte** le 20 regioni,
compresi i gruppi a zero, in un insieme di risultati della
**stessa istantanea coerente**. Verifica che ogni conteggio
corrisponda alla somma regionale e richiede una soppressione
complementare quando la somma dei gruppi non pubblicati è
positiva ma inferiore a 10. Se serve, nasconde un'ulteriore
regione sopra soglia. In caso di regione mancante, duplicata
o totali incongruenti interrompe l'operazione.

Il modulo include solo una **prova di politica di pubblicazione
per uno snapshot nazionale/regionale**. Non garantisce la privacy
quando vengono confrontati periodi differenti, query per
provincia/comune, suddivisioni demografiche, cambi di composizione
o ripetute interrogazioni. Per essere efficace richiederebbe
una decisione centralizzata e coerente applicata a tutti gli
endpoint, preferibilmente con aggregati precomputati e versionati,
evitando una lettura extra per ogni richiedente. Non è sicuro
attivare pubblicamente questi endpoint basandosi solo sul test.

Test isolati: `api/tests/opinionAnswersV2RegionalPrivacy.unit.test.js`;
nessuna lettura di dati personali, nessuna modifica di schemi,
Supabase, Render o servizi di produzione. La PR resta Draft/NO-GO.


## Un solo snapshot nazionale/regionale per Opinione — prototipo isolato

La soppressione complementare delle regioni descritta sopra richiede
conteggi nazionali e regionali dalla **stessa istantanea dei dati**,
non da 21 interrogazioni indipendenti mentre cambiano risposte e consensi.

Il candidato `api/experiments/opinionAnswersV2CoherentSnapshotCandidate.js`
prepara una **sola query PostgreSQL** tramite
`GROUPING SETS ((regione), ())` su utenti e consensi:

- Legge una vecchia colonna TEXT oppure una nuova chiave
  di `answers_extra JSONB`, con ID pubblicati nel codice.
- Include persone `PERSON` e `P` con consenso politico valido;
  esclude organizzazioni `O` e consensi esplicitamente negati.
- Restituisce nello stesso statement conteggi nazionali e
  regionali, senza una SELECT separata per ciascuna regione.
- Rifiuta codici geografici ignoti, duplicazioni, marker di
  raggruppamento non validi e incongruenze fra conteggi.
- Completa in memoria le regioni a zero risposte e applica
  la soppressione complementare in modo deterministico.

Test: `api/tests/opinionAnswersV2CoherentSnapshot.unit.test.js`
e `api/tests/opinionAnswersV2CoherentSnapshot.pg.test.js`
su PostgreSQL 17 temporaneo e dati inventati. Verificano vecchia
e futura Opinione, 10 persone in Toscana + 1 in Lazio, presenza
di un'altra regione sopra soglia, revoca e regione non riconosciuta.

**Limite essenziale:** una SELECT crea uno snapshot coerente soltanto
per quella specifica esecuzione. Non rende coerenti le risposte
pubblicate successivamente da endpoint e cache diversi.
Il piano dovra essere calcolato centralmente e versionato,
applicato a livelli nazionale, regionale, provinciale, comunale
e demografico. Confronti temporali e gruppi sovrapposti
richiedono protezioni aggiuntive; non eseguire questo
calcolo pesante a ogni visita, per minimizzare letture e costi.

**Stato:** sola ricerca nella PR #483 Draft/NO-GO. Nessun
merge, deploy, DDL, backfill, modifica al runtime o Supabase.


## Correzione 30/10/2026: rischio di sottrazione per singola categoria

Una seconda verifica ha evidenziato un difetto nella politica
di soppressione complementare che considerava soltanto il
**numero totale** delle risposte regionali nascoste.

Controesempio sintetico: Toscana pubblicata con 10 favorevoli;
Lazio nascosto con 15 favorevoli e **1 contrario**. Il
totale nazionale avrebbe 25 favorevoli e 1 contrario.
La popolazione nascosta totale sarebbe 16 (sopra soglia),
ma sottraendo la Toscana dal nazionale si ricostruirebbe
comunque l'unico contrario nella regione nascosta.

La funzione di ricerca `planCoherentRegionalPublication` ora
valuta **sia il totale nascosto sia ciascun residuo f/c/i**.
Se un residuo positivo e inferiore a 10, nasconde una ulteriore
regione che contribuisca alla categoria a rischio. Se nessuna
regione ancora pubblicabile puo alzare tale residuo alla soglia,
nasconde tutti i risultati regionali per quella Opinione:
il nazionale rimane pubblicabile soltanto quando il proprio
totale raggiunge la soglia applicativa.

I test unitari includono il controesempio 25 favorevoli +
1 contrario, il caso 10+10+1 con due regioni altrimenti
pubblicabili, e il caso in cui sia possibile preservare una
regione pubblica nascondendo l'altra che contribuisce alla
categoria troppo piccola. I test degli snapshot PostgreSQL
sono stati aggiornati alla regola piu prudente.

**Limite:** la soppressione per categorie riduce il rischio
di sottrazione da un *singolo snapshot nazionale e regionale*.
Non dimostra la protezione da confronti nel tempo, incroci
con eta/sesso/province/comuni o deduzioni da informazioni
esterne. Non rende sicuro pubblicare automaticamente tutte
le viste: occorre un coordinamento centralizzato, versionato
e una verifica privacy end-to-end prima di attivare il codice.

Nessuna query di produzione, modifiche a Supabase, merge,
deploy o variazioni delle API attive.


## Snapshot pubblico versionato senza conteggi nascosti (ricerca)

Il modulo `api/experiments/opinionAnswersV2PublishedSnapshotCandidate.js`
converte una singola istantanea nazionale/regionale in un
**oggetto pubblico immutabile**, associato a un ID di Opinione
e a una versione di pubblicazione. Non contiene righe personali,
conteggi delle regioni oscurate o altre risposte non pubblicabili.

Il futuro backend potrebbe calcolare la pubblicazione una volta,
memorizzarla in cache e usare **gli stessi conteggi gia filtrati**
per le route nazionali e regionali; una richiesta che si riferisce
a un'altra versione viene rifiutata, non ricomputata con dati
di un'altra istantanea. La risposta HTTP conserva le chiavi
legacy `success`, `data`, `stats`, `totaleUtenti`, `regione`
e `minimumCellSize`. Non e stata collegata alcuna route reale.

**IMPORTANTE:** la compatibilita fra due richieste dello stesso
snapshot non impedisce il confronto di **due snapshot pubblicati
in momenti diversi**. Per questo occorre una futura politica
di rilascio che valuti differenze temporali e incroci
territoriali e demografici prima di sostituire la cache.
Il modulo non crea un cron, non scrive in database e non
risolve da solo queste inferenze.

I test `api/tests/opinionAnswersV2PublishedSnapshot.unit.test.js`
verificano la forma dei payload, il blocco di versioni errate,
l'assenza di conteggi regionali soppressi e l'immutabilita
rispetto a successive modifiche dei dati di input.

**NO-GO:** serve revisione del DPO e test end-to-end prima di
pubblicare statistiche ottenute da questa nuova struttura.


## Riscontro 94/94 fra PR #384 e schema reale — sola lettura, 30 ottobre 2026

Ho confrontato tramite la connessione autorizzata **solo i metadati**
di information_schema.columns sulla tabella public.opinioni_risposte
(senza SELECT di risposte personali e senza SQL di scrittura) con
i sei file JSON del catalogo in codice nella PR #384, alla commit
`3396b2d5ce9e190a9e34d68473050750d8099c5c`.

**Risultato: corrispondenza esatta 94/94 ID**, senza ID mancanti,
aggiunti, duplicati o colonne di risposta non TEXT.
Sono inoltre presenti `user_id uuid` e `fonti_opinioni jsonb`.
Al momento dell'ispezione non risultava alcun campo `answers_extra`.
I sei frammenti del catalogo contavano 10, 20, 20, 20, 20 e 4 Opinioni.

Per evitare che la pubblicazione/archiviazione futura di una
Opinione cancelli accidentalmente la sua identita storica,
la PR #483 conserva il nuovo manifest di riferimento
`api/experiments/opinionAnswersV2HistoricalManifest.json`.
Contiene esclusivamente gli ID gia pubblici delle 94 domande
e un riferimento alla commit canonica verificata, non risposte
di utenti. E un **manifest storico immutabile** per le vecchie
colonne: eventuali nuove Opinioni useranno `answers_extra` e
non richiederanno modifiche al manifest SQL storico.

Il workflow di ricerca ora fa una checkout in sola lettura,
fissata allo SHA indicato, dei sei JSON della PR #384 e lancia
`api/tests/opinionAnswersV2HistoricalParity.unit.test.js`.
I test verificano equivalenza esatta degli ID, colonne storiche
tutte TEXT in un inventario di prova, comportamento fail-closed
quando un ID viene rinominato/rimosso, nuova Opinione scritta
solo nella mappa JSONB e archiviazione senza perdita di identita.

**Limiti e gate:** il test CI usa metadata sintetici per le
verifiche strutturali, non interroga Supabase durante ogni run.
La parita effettiva vale per l'istante della verifica read-only
e per il commit specificato della PR #384; una successiva modifica
del catalogo o dello schema richiede nuovo confronto prima
di qualsiasi integrazione. Il controllo preventivo live
`inspectLegacyOpinionAnswerSchema` deve essere eseguito
**immediatamente prima** di ogni futura migrazione autorizzata.
Nessun DDL, lettura dati personali, merge o deploy reale.


## GDPR della soluzione ibrida: una sola riga, sorgenti, revoca e backup

**Verifica di integrazione nel codice attuale (sola lettura):**
il servizio `api/services/politicalConsentService.js` include gia
`opinioni_risposte` tra le tabelle politiche soggette a revoca;
la route `api/routes/user/political-opinions-consent.js` avvia una
transazione e chiama il cleanup prima del COMMIT.
Anche `api/services/privacyErasureLedgerService.js` elimina
la riga di `opinioni_risposte` durante revoca/cancellazione.
Poiche il layout ibrido mantiene vecchie colonne TEXT,
`fonti_opinioni` e futuri `answers_extra` **nella stessa riga**,
una cancellazione completa di quella riga elimina tutte le
rappresentazioni; non servirebbe la seconda tabella v2.

Il servizio di esportazione GDPR esistente
`api/services/privacyDataExportService.js` usa `SELECT *`
sulle righe di `opinioni_risposte`: una volta aggiunto lo schema,
il campo `answers_extra` sarebbe quindi incluso nell'export
grezzo. Questo **non** verifica la copertura dei restanti
percorsi di esportazione, il consenso, la completezza delle
fonti, ne la portabilita del formato Android.

Il modulo non integrato
`api/experiments/opinionAnswersV2HybridGdprCandidate.js`
prepara l'export di una singola riga dell'interessato,
comprendendo risposte delle 94 vecchie colonne, Opinioni
future e archiviate, e tutte le fonti (comprese archiviate).
Richiede soggetto autorizzato, riga completa e ID
immutabili; fallisce senza esportare parzialmente se trova
campi mancanti, collisioni o fonti malformate.
La DELETE parametrizzata elimina la **riga intera**
ed e progettata per funzionare esclusivamente nella
transazione di revoca/account deletion dopo il lock utente.
Una tabella assente deve provocare errore e rollback, mai
essere trattata come cancellazione riuscita.

**Backup e nuova concessione:** dopo il backup possono
avvenire revoca del consenso e poi nuova concessione.
La nuova concessione non legittima il recupero delle
vecchie risposte presenti nel backup antecedente alla
revoca. `planHybridPostRestoreErasure` usa il piano
dei precedenti esperimenti GDPR per cancellare la riga
dello snapshot se nel ledger esterno esiste una revoca
o cancellazione posteriore al backup, anche se seguita
da un evento di consenso concesso.

**Limite di sicurezza assoluto:** il prototipo NON attesta
che il ledger esterno sia completo, durabile, coerente
con il backup o immune da perdita di eventi. Il blocco
del traffico durante il restore deve essere imposto
fuori dal database ripristinato o prima di riaprire
l'accesso; non e sufficiente fidarsi di un flag
interno al database riportato indietro dal backup.
Questa resta la criticita da coordinare con la PR #374.

Test isolati: `api/tests/opinionAnswersV2HybridGdpr.unit.test.js`
e `api/tests/opinionAnswersV2HybridGdpr.pg.test.js`.
Il PostgreSQL 17 di CI contiene soltanto UUID, risposte
e fonti sintetiche. Le prove coprono export autorizzato,
fonti archiviate, rollback se fallisce il ledger,
revoca che elimina tutta la riga, nuova concessione
senza resurrezione, restore simulato con ledger
revoca+regrant e cancellazione integrale dell'account.

**Non eseguiti:** un vero ripristino B2/PITR, test
con utenti reali, API runtime, middleware/auth/RLS,
DDL, deployment o merge. PR #483 resta Draft / NO-GO.


## Contratto di apertura post-restore: verifica esterna, non flag nel DB

La verifica del 30/10 ha confermato che l'attuale
`PrivacyErasureLedgerService.applyCurrentPrivacyState`
seleziona per ogni soggetto soltanto l'**ultimo** evento tra
`political_consent_granted` e `political_consent_revoked`.
Se un backup vecchio contiene risposte, un utente revoca
il consenso DOPO il backup e successivamente lo riconcede,
l'ultimo evento e `granted` e la cancellazione nel replay
puo essere saltata. Questa condizione rimane un BLOCCO
per la PR #374: il ledger/restore reale non e corretto da #483.

Il nuovo prototipo INATTIVO
`api/experiments/opinionAnswersV2ExternalRestoreGateCandidate.js`
formalizza il controllo che tutte le API di Opinioni
(personali e statistiche) devono superare PRIMA della lettura:

- Conferma ottenuta **fuori dal database ripristinato**, con
  verifica della prova da un coordinatore attendibile. Il
  prototipo fornisce solo l'interfaccia per un verificatore
  esterno: NON contiene tale servizio o firma crittografica.
- Identita esatta della generazione di ripristino e del
  backup atteso. Un certificato del backup precedente
  non deve poter riaprire quello successivo.
- Attestazione che registro esterno sia completo e che
  la sua copertura inizi prima/durante lo snapshot e
  comprenda il termine della finestra di replay.
- Replay concluso e salvato, barriera di ingresso gestita
  **esternamente**, prova ancora valida e scadenza breve.
- Qualunque errore di rete, prova non verificata, copertura
  insufficiente, versione errata o conferma scaduta deve
  impedire la lettura, senza consultare SQL per un fallback.

I test `api/tests/opinionAnswersV2ExternalRestoreGate.unit.test.js`
coprono le cause di rifiuto e verificano su Express temporaneo
che le API di lista Opinioni, statistiche nazionali e regionali
rispondano 503 SENZA leggere risposte personali o conteggi
quando il gate esterno e chiuso.

**Limitazione fondamentale:** un controllo nel singolo endpoint
non puo impedire da solo una race con un ripristino avviato
dopo il controllo, ne blocca automaticamente cache, worker,
cron o versioni Android vecchie. Il coordinamento dovra
impedire il traffico a livello di ingresso e attestare
il replay **prima** della riapertura. Non e una prova di
ripristino B2/PITR, di durabilita degli eventi o di
integrita crittografica del registro reale. No-GO finche
PR #374 non fornisca e verifichi tali garanzie.

Il ramo resta di sola ricerca: nessun merge, deploy,
modifica di database o route produttive.


## Salvataggio unico di risposte e fonti nel Profilo — ricerca isolata

Il codice attivo della route Admin Profilo oggi legge prima
`fonti_opinioni` da `opinioni_risposte` e successivamente
riscrive tutto il documento JSONB. Con richieste ravvicinate
o concorrenti questa strategia puo perdere fonti aggiornate
da un'altra richiesta. Fa inoltre una SELECT aggiuntiva
del JSONB e una SELECT a `information_schema` per verificare
le colonne di risposta. Non sono state modificate le route attive.

Il prototipo `api/experiments/opinionAnswersV2HybridAdminCandidate.js`
costruisce una sola INSERT ... ON CONFLICT DO UPDATE per
salvare nella medesima riga risposte storiche TEXT, nuove
risposte `answers_extra` e modifiche a `fonti_opinioni`.
Quando una fonte viene modificata, la query SQL usa
`(COALESCE(current.fonti_opinioni, '{}'::jsonb) - removedKeys)
`|| EXCLUDED.fonti_opinioni`, conservando le chiavi
non menzionate, comprese quelle delle Opinioni archiviate.
Le nuove fonti e i riferimenti alle chiavi da cancellare
sono parametri SQL; le colonne storiche provengono
esclusivamente dagli ID immutabili verificati nel codice.
Non viene eseguita alcuna lettura del catalogo dal database.

Il caso **sole rimozioni di fonti** usa UPDATE e non UPSERT:
se un utente non ha ancora risposte, non viene creata
una riga vuota con il solo tentativo di cancellare una fonte.
L'inserimento iniziale di risposte storiche, future e fonti
puo invece avvenire in una sola operazione atomica.

Test isolati:
`api/tests/opinionAnswersV2HybridAdmin.unit.test.js` e
`api/tests/opinionAnswersV2HybridAdmin.pg.test.js`,
con PostgreSQL 17 effimero e fonti sintetiche.
Controllano SQL parametrizzato, prima scrittura, fonti
di Opinioni archiviate preservate, input non valido,
rimozione senza riga e due richieste concorrenti
che modificano fonti differenti senza sovrascriverle.
Verificano inoltre il rollback di risposte e fonti
quando fallisce un passo successivo nella transazione.

**Limiti vincolanti:** il builder non autentica nessuno e
NON controlla il consenso. Ogni uso reale richiederebbe
la transazione con lock `users FOR UPDATE`, verifica
del consenso politico DOPO il lock, autorizzazione Admin
appropriata e gate esterno GDPR/B2, oltre all'uso di
uno snapshot coerente per notifiche e audit.
La rimozione di una fonte e ammessa, la rimozione
di una risposta espressa rimane vietata.
Questo codice non e importato da nessuna route,
non e un rilascio Android, non cambia Supabase.

**PR #483 Draft/NO-GO**: nessun deploy, merge o DDL.


## Scrittura amministrativa autorizzata: lock e consenso dopo revoca — solo test

La sola INSERT/UPSERT atomica non garantisce un salvataggio sicuro.
Il candidato NON ATTIVO
`api/experiments/opinionAnswersV2AuthorizedWriteCandidate.js`
orchestra l'ordine richiesto per una futura integrazione:

1. Convalida ID e patch (senza interrogazioni). Verifica che
   il **gate esterno di restore** sia aperto PRIMA della query.
2. Avvia la transazione; richiede una verifica effettiva del ruolo
   Admin nella **stessa transazione**. Il verificatore e una
   dipendenza obbligatoria, che deve mantenere valido il ruolo
   con opportuno lock fino al commit: questo prototipo NON
   contiene la vera autenticazione DEMOS.
3. Blocca la riga del soggetto con
   `SELECT id FROM users WHERE id=$1::uuid FOR UPDATE`.
4. Solo in una **seconda istruzione SQL**, dopo aver ottenuto
   il lock, controlla l'effettivo consenso politico con
   precedenza a `user_consents` sul valore base `users`.
   In READ COMMITTED questo ordine evita di usare un
   consenso obsoleto quando una revoca ha fatto attendere
   il salvataggio sul lock dell'utente.
5. Se autorizzazione/consenso sono validi, esegue **una**
   scrittura parametrizzata, oppure nessuna per patch vuota;
   conferma il numero di righe e fa COMMIT. Qualunque errore
   provoca ROLLBACK; non trasforma errori in salvataggi riusciti.

Test `api/tests/opinionAnswersV2AuthorizedWrite.unit.test.js`
e `api/tests/opinionAnswersV2AuthorizedWrite.pg.test.js`:
blocco su restore non verificato e ruolo Admin revocato,
consenso negato, assenza utente, esito di scrittura inatteso,
consenso esplicito true/false che prevale sul valore base,
e soprattutto una competizione reale fra due connessioni
PostgreSQL 17: revoca con lock + DELETE delle opinioni prima
del salvataggio in attesa. Il successivo controllo del consenso
impedisce di reinserire la riga appena eliminata. Una nuova
concessione consente solo un salvataggio nuovo, senza recuperare
le vecchie risposte.

**Limiti NO-GO:** non e un middleware reale, non include
la verifica privilegi dell'applicazione né la firma del gate
esterno. Una verifica di restore per singola richiesta non
impedisce una corsa con un ripristino avviato in seguito:
serve sempre una barriera ingress esterna per API, worker
e client vecchi. Resta da coordinare con PR #374.
Il database di CI e interamente sintetico; nessuna
modifica a route attive, Supabase, Render o Android.


## Controllo automatico NO-GO prima dell'integrazione (30/10/2026)

Il prototipo `api/experiments/opinionAnswersV2CutoverAuditCandidate.js`
produce un rapporto di **sola lettura** che distingue le
verifiche meccaniche dall'autorizzazione a procedere.
Non apre connessioni, non interroga risposte personali e
non esegue DDL. Accetta metadati `information_schema`
solo se forniti da un controllo preventivo autorizzato.

Requisiti esaminati:

- Tutti i **94 ID storici immutabili** devono coincidere
  esattamente con il manifest congelato dalla PR #384;
  la pubblicazione di Opinioni future non li modifica.
- Lo schema deve contenere le 94 colonne storiche TEXT,
  `user_id uuid`, `fonti_opinioni jsonb` e, al momento
  della migrazione autorizzata, **`answers_extra jsonb`**.
- Le PR coordinate **#384, #464 e #374** devono essere
  effettivamente integrate nella revisione di rilascio,
  non semplicemente aperte con test riusciti.
- Ogni requisito operativo necessita di verifica esterna
  per il commit esatto da pubblicare: compatibilita
  delle API, consenso dopo il lock, ruoli Admin,
  vero ripristino GDPR/B2 con registro esterno,
  vecchi client Android, protezione delle statistiche
  contro confronti nel tempo e rollback senza perdita.

Un controllo e marcato completo solo quando e associato
al medesimo commit e a un riferimento di verifica;
**questa verifica della forma non garantisce l'autenticita**
di chi la dichiara. Anche in un caso fittizio con ogni
indicatore positivo, `releaseAuthorized` resta SEMPRE
`false`: nessun test isolato puo sostituire l'approvazione
esplicita e i collaudi infrastrutturali reali.

**Situazione verificata oggi:** le PR #384, #464 e #374
sono ancora aperte e in bozza; lo schema controllato
il 30/10 conteneva le 94 colonne originali e non ancora
`answers_extra`. Questi sono blocchi concreti e attesi,
non errori da nascondere. Il rapporto puo cambiare
solo dopo nuovi controlli sul vero stato di integrazione.

Test `api/tests/opinionAnswersV2CutoverAudit.unit.test.js`:
percorso corrente **NO-GO**, schema incompleto, tipo
di colonna errato, manifest storico alterato, PR non
integrate, evidenze mancanti/attribuite al commit
sbagliato, e rilascio negato anche nello scenario
puramente ipotetico con controlli positivi.

**Questo controllo non si collega alle protezioni di
branch GitHub, ai deploy Render o al database reale.**
Prima di utilizzarlo come gate operativo servirebbero
fonti di evidenza indipendenti e protezioni di rilascio
applicate esternamente. La PR #483 rimane Draft/NO-GO.


## Prima prova completa di salvataggio/rilettura HTTP con PostgreSQL 17

Nuovi prototipi esclusivamente nella cartella `api/experiments`: 

- `opinionAnswersV2AuthorizedReadCandidate.js` effettua
  **una sola SELECT** per un soggetto autenticato, con
  `users LEFT JOIN user_consents LEFT JOIN opinioni_risposte`.
  La JOIN della riga politica e condizionata dal consenso
  attivo; anche il risultato SQL del soggetto che ha negato
  il consenso contiene `answer_row=null`. Non esiste
  una lettura separata delle 94 risposte o del catalogo SQL.
  Il gate GDPR/B2 esterno deve essere verificato prima
  della SELECT. Il soggetto proviene dal token autenticato,
  mai da un parametro modificabile nel client.
- `opinionAnswersV2PersonalWriteCandidate.js` riproduce
  il percorso di salvataggio dell'utente, distinto dalle
  funzioni Admin. Una transazione blocca `users FOR UPDATE`,
  verifica il consenso in una SECONDA istruzione SQL,
  legge solo il valore precedente delle Opinioni che
  cambiano, esegue una UPSERT per le differenze effettive
  e registra le notifiche dei veri cambiamenti **nello
  stesso commit**. La prima risposta non crea notifiche.
  Ripetere lo stesso salvataggio non provoca UPDATE
  o scritture inutili del JSONB.
- `opinionAnswersV2PersonalSaveHttpCandidate.js` monta
  **solo in test** il vecchio contratto `POST /salva`,
  riconoscendo sia `body.opinioni` sia un oggetto diretto
  e mantenendo le chiavi di risposta `savedCount`,
  `errorCount`, `notificationsCreated` e `timestamp`.

Il nuovo `api/tests/opinionAnswersV2HybridHttpRoundtrip.pg.test.js`
usa un server Express su localhost e due connessioni
PostgreSQL 17 effimere con tabelle e utenti inventati.
Verifica il ciclo completo GET iniziale con risposte null,
POST di una delle 94 Opinioni storiche piu una 95ª,
GET che le rilegge, doppio salvataggio senza UPDATE
inutile, modifica con notifica nello stesso commit,
rollback se fallisce la notifica, ID non pubblicati
rifiutati, blocco delle letture/scritture durante
ripristino, revoca con cancellazione e risposta 403,
nuova concessione con solo nuove risposte e
Opinioni archiviate escluse dalla lista pubblica.
Le altre due suite unitarie coprono query personale,
identita del soggetto e verifica dei risultati.

**Limiti NO-GO:** l'autenticazione e il gate del test
sono finti e non collegati agli effettivi middleware
DEMOS; il servizio di notifica e un sostituto locale.
Il GET di ricerca e il servizio di lettura verificano
entrambi il gate in questa composizione; in una futura
integrazione la verifica deve essere centralizzata
senza richieste esterne duplicate, preservando
l'invalidazione della cache della PR #464.
Il test non e un collaudo su smartphone, non usa
database con dati reali, non esegue restore B2 e
non autorizza una modifica delle API attive o della
struttura `opinioni_risposte` reale.

**Stato: ricerca e test soltanto; PR #483 Draft / NO-GO.**


## Lettura personale: un solo controllo esterno GDPR per richiesta

Il primo round-trip HTTP della ricerca chiamava due volte
la verifica esterna di readiness nel caso GET personale:
una volta nella route `GET /opinioni-list` e una seconda
volta nel servizio di lettura consent-gated.
Non erano due letture Supabase, ma potevano diventare
due chiamate inutili al coordinatore esterno per visita.

La route sperimentale `opinionAnswersV2HttpContractCandidate.js`
ora delega il controllo personale al lettore di fiducia
creato da `createHybridAuthorizedReadCandidate`,
che verifica il gate **prima di qualsiasi SQL**.
La route non accetta piu una funzione generica come
`loadOwnAuthorizedRow`: controlla una registrazione privata
del factory e che il lettore sia vincolato alla **stessa
istanza di `assertRestoreReady`** utilizzata dalle API
aggregate. Il lettore e il controllo esterno sono anche catturati
alla creazione della route: sostituire successivamente le funzioni
nell'oggetto di dipendenze non deve poter eludere il blocco GDPR.
Un test HTTP forza proprio questo tentativo di sostituzione.

Le route statistiche continuano a verificare
il gate ciascuna una volta.

I test sul server HTTP e su PostgreSQL 17 ora verificano
un solo controllo GDPR per GET personale e una sola SELECT
per consenso + risposte, con risposta 503 e **zero SQL**
quando il restore e chiuso. Altri test rifiutano lettori
non creati dal factory e lettori che verificano una
funzione di restore diversa da quella della route.

**Limite:** questo e soltanto un collegamento controllato
fra moduli sperimentali, non una firma/attestazione esterna
reale. Il ripristino deve comunque chiudere il traffico
all'ingresso, inclusi richieste gia avviate, worker e
cache. Non bisogna interpretare questa riduzione di
una chiamata come autorizzazione al cutover o garanzia
contro race infrastrutturali. PR #483 resta Draft/NO-GO.


## Piano di migrazione minima e ritorno non distruttivo — ricerca 31/10/2026

Ho preparato il file **NON eseguibile in produzione senza una nuova
autorizzazione** `api/experiments/opinionAnswersV2AddOnlyColumn.sql`.
Il solo cambiamento proposto e
`ALTER TABLE public.opinioni_risposte ADD COLUMN IF NOT EXISTS
answers_extra jsonb;`. Il tipo e JSONB **nullable** e senza
default: nessuna riscrittura o backfill delle 94 colonne TEXT
e nessuna modifica a `fonti_opinioni`.
Il comando e *idempotente* sulla stessa versione di schema.
Il lock di DDL deve essere gestito dall'operatore con un timeout
breve e una finestra controllata, dopo un preflight di sola lettura.

Il rollback sicuro **NON e un rollback dello schema**:
per tornare al codice precedente si disabilita anzitutto
la pubblicazione delle nuove Opinioni (ID non presenti
nelle 94 colonne), si sospende il traffico durante lo switch,
si lascia completare la scrittura in corso, si invalida
la cache del client e si verifica il gate GDPR/B2 esterno.
Poi si ripristina *solo il codice applicativo*: le 94 colonne
rimangono utilizzabili dal backend vecchio, mentre
`answers_extra` resta fisicamente nella stessa tabella.
Eliminare la colonna significherebbe distruggere le risposte
politiche nuove/archiviate, incidendo anche sul diritto
di accesso e sul principio di integrita GDPR.

`api/experiments/opinionAnswersV2RollbackCandidate.js`
e un **validatore di piano** che rifiuta il fallback
se esistono ancora Opinioni future pubblicate, se manca
uno dei prerequisiti dichiarati o se sono stati modificati
gli ID storici. Non verifica autonomamente ingress,
worker, cache o il registro GDPR: e non autorizza mai
un rilascio. Non fornisce istruzioni SQL distruttive.

`api/tests/opinionAnswersV2AdditiveRollback.pg.test.js`
esegue la migrazione esclusivamente in uno schema sintetico
del PostgreSQL 17 di CI, con 94 colonne e due utenti
di prova. Verifica la compatibilita e l'idempotenza
dell'ALTER, l'assenza di modifiche ai valori storici,
il salvataggio misto old+future e delle fonti, una
scrittura realistica del backend precedente che non
cancella il JSONB, la riattivazione del nuovo backend
che rilegge la risposta futura senza modificare la riga,
e la DELETE integrale per la revoca.

**Limiti NO-GO:** il test non e una migrazione su Supabase
e non misura il tempo reale di lock della tabella con
carico di produzione. Non collauda un vero client Android,
le cache #464 o il ripristino da B2 (#374).
Sono necessarie conferma dello schema reale, revisione
privacy, validazione e approvazione esplicita prima di
qualsiasi DDL o attivazione. Nessuna PR coordinata e stata
modificata o integrata da questi esperimenti.


## Rischio statistico fra due pubblicazioni: prova e blocco NO-GO

Il filtro precedente di almeno dieci rispondenti per
aggregato non protegge contro il **confronto nel tempo**.
Esempio sintetico: nella versione 1 ci sono dieci
risposte favorevoli; nella versione 2 ci sono ancora
dieci favorevoli e una contraria. Entrambe le versioni
superano la soglia per popolazione totale, ma la
differenza mostra il contributo politico di una sola
nuova persona. Anche il passaggio da dieci a undici
favorevoli o una variazione di visibilita regionale
puo far trapelare informazioni sensibili.

Il nuovo modulo di sola ricerca
`api/experiments/opinionAnswersV2TemporalPrivacyGateCandidate.js`
confronta l'involucro **gia filtrato per il pubblico**
di due snapshot coerenti, creati dal factory controllato
`buildVersionedOpinionPublication`. Se cambiano conteggi
nazionali, conteggi regionali, decisioni di soppressione
oppure testi/identificatori pubblicati, il candidato
**blocca ogni nuova versione** senza revisione esterna
indipendente. Anche la primissima pubblicazione richiede
revisione; un numero totale di almeno dieci non
garantisce che ogni categoria positiva abbia dieci
risposte. Il solo caso riutilizzabile e mantenere
l'**esatta versione precedente** se i dati pubblici
sono identici, e solo se quella versione era gia stata
approvata realmente: il modulo NON puo attestarne
la precedente approvazione.

Non esiste qui alcuna funzione che rilasci automaticamente
una nuova versione. Il risultato include sempre
`releaseAuthorized: false`. I riferimenti ai candidati
sono verificati con una `WeakSet` privata del factory
solo nel processo Node di prova; NON sostituisce
un ledger immutabile, firmato e durevole dopo riavvio.
Il rapporto di blocco usa solo codici: non contiene
risposte personali o conteggi soppressi.

**Hardening numerico:**
`opinionAnswersV2RegionalPrivacyCandidate.js` ora accetta
solo interi JavaScript non negativi sicuri oppure le
stringhe decimali canoniche emesse da PostgreSQL per
`COUNT(bigint)`. Rifiuta conversioni ambigue in zero
(stringa vuota, spazi, booleani, array), stringhe
decimali non canoniche e somme fuori
`Number.MAX_SAFE_INTEGER`, che avrebbero potuto
alterare calcoli e decisioni di soppressione.
Il factory degli snapshot pubblici riusa le stesse
regole. Sono aggiunti test avversari e unitari.

**Limitazione NO-GO fondamentale:** un controllo su
due versioni non analizza automaticamente tutte le
versioni gia esposte negli storici dei client, le
intersezioni con fasce d'eta, sesso, province/comuni,
altre Opinioni o dati esterni. Prima di pubblicare
servono una policy statistica documentata, un
registro esterno completo di OGNI versione pubblicata,
un piano per la permanenza delle cache e una
revisione indipendente delle variazioni consentite.
Questa ricerca non modifica gli endpoint attivi,
non crea servizi di pubblicazione e non aggiorna
Supabase/Android. PR #483 rimane Draft/NO-GO.


## Ulteriore minimizzazione statistiche: 10 per ogni categoria positiva

**Problema rilevato:** una soglia di 10 applicata solo al numero totale
di rispondenti non protegge i piccoli sottogruppi delle categorie
`favorevole`, `contrario`, `indeciso`. Esempio: 30 risposte
(29 favorevoli, 1 contraria) superano la soglia totale,
ma pubblicare i tre numeri espone una categoria politica di UNA persona.

I moduli sperimentali di statistiche nazionali, regionali e
demografiche ora applicano una regola piu prudente:
pubblicare una cella completa **solo se il totale e almeno 10**
e **ciascuna categoria positiva contiene almeno 10 risposte**.
Le categorie pari a zero non sono trattate come categorie
positive da sopprimere: un insieme di dieci sole risposte
favorevoli (10/0/0) supera il controllo statico.
Una cella 29/1/0, 9/10/10 oppure 4/3/3 viene soppressa.

Il pianificatore coerente nazionale/regionale sopprime
tutte le regioni se il nazionale stesso contiene una
categoria positiva con meno di 10 risposte; per le
singole regioni il controllo vale separatamente prima
della soppressione complementare del resto del territorio.
Le statistiche per sesso ed eta sopprimono l'INTERO
dettaglio quando anche una sola categoria positiva
in una fascia valida risulta sotto 10, per non lasciare
residui ricostruibili tramite differenze fra gruppi.
Le API sperimentali conservano i campi JSON legacy
`success`, `data`, `stats`, `totaleUtenti`, `minimumCellSize`,
ma non espongono `stats` e `totaleUtenti` in caso di
soppressione. La validazione dei conteggi usa la
verifica rigorosa degli interi PostgreSQL gia introdotta.

**Prove di regressione:** unita regionali, nazionali,
demografiche, inviluppi pubblici e gate temporale,
oltre ai test HTTP di compatibilita nazionali/regionali.
I casi di prova includono 29 favorevoli + 1 contrario,
gruppi 10/10/10 che restano visibili, categorie
con nove risposte, conteggi malformati e medesimi
campi di risposta Android.

**NON e una garanzia definitiva di riservatezza:**
anche gruppi >=10 con singole categorie >=10 possono
essere vulnerabili a versioni successive, intersezioni
fra territori/demografia, dati ausiliari, selezione
ripetuta di filtri e pubblico con conoscenze esterne.
Restano obbligatori il gate anti-deduzione temporale,
la revisione indipendente dell'intera superficie
statistica e la policy per cache e vecchie versioni.
Questa modifica e nel solo ramo di ricerca #483,
non nelle statistiche pubbliche attive.
