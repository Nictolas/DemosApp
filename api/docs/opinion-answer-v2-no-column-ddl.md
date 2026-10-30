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
