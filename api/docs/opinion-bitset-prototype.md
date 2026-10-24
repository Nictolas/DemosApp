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
