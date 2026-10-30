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
