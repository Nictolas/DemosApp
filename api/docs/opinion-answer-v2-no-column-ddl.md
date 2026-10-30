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
