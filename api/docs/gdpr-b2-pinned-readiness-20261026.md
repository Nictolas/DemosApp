# DEMOS — B2 readiness vincolata a un manifest esterno approvato (26/10/2026)

**PR #308 in bozza, stacked su #307 → #306 → #305 → #304 → #303 → #302. Nessuna produzione.**

## Lacuna corretta

Il controllo `verifyOutboxRecoveryReadiness` verificava tutte le righe **presenti nel PostgreSQL ripristinato** contro le rispettive versioni immutabili B2, ma poteva restituire `ready: true` anche se il database era stato ripristinato con **zero eventi**, oppure se mancava un evento insieme alla sua riga outbox. L'assenza non poteva essere scoperta enumerando soltanto il database incompleto.

## Nuovo controllo fail-closed

Prima di ogni query o richiesta B2, il chiamante offline deve presentare:

1. Un manifest completo firmato HMAC, con identificativo di recovery esplicitamente approvato.
2. SHA-256 del manifest approvato da un canale **indipendente** e timestamp di backup/cattura approvati separatamente.
3. Una dichiarazione esplicita di manutenzione/quarantena, un client PostgreSQL dedicato e l'exporter B2 configurato.

La funzione riutilizza `verifySignedManifest`, `assertIndependentRecoveryCheckpoint` e la normalizzazione canonica degli eventi già usata nel replay. All'interno della transazione read-only `REPEATABLE READ`:

- ogni evento presente nel ledger deve appartenere al manifest approvato e avere contenuto identico;
- la ricevuta outbox deve essere presente e l'exporter deve verificare la **versione B2 specifica**, il corpo, SHA-256 e Object Lock;
- al termine **nessun evento del manifest** può risultare assente dal ledger ripristinato;
- vengono restituiti solo `verifiedEvents` e `pinnedEvents` (oltre a `ready`), senza dati identificativi.

Un manifest assente, con firma/digest non approvati, una riga DB aggiuntiva, mancante o alterata, o una versione B2 non valida causa errore e **non** restituisce `ready:true`. Il controllo non esegue DDL, PUT o modifiche a dati personali.

## Test

Unit test con manifesto assente/digest diverso rifiutati **prima di qualsiasi I/O**. PostgreSQL 17 sintetico con exporter B2 finto: snapshot firmati, perdita di una riga del ledger simulata nella scansione, alterazione del contenuto, nuova riga dopo l'approvazione del checkpoint, ricevute mancanti/alterate e ripetizione della verifica.

**Avvertenza:** i test sintetici creano il checkpoint dalla fixture PostgreSQL solo per simulare una fonte approvata. Questa operazione è **vietata** come scorciatoia nella procedura reale: l'operatore deve ottenere il digest da un canale autonomo, aggiornato e affidabile.

## Blocchi ancora aperti — issue #296

Questa verifica dimostra la **corrispondenza** tra DB ripristinato, manifest indipendentemente approvato e versioni B2 accessibili. Non dimostra che il manifest sia il più recente né che includa eventi mai esportati prima della perdita totale del DB. La continuità/completezza anti-rollback del canale esterno, l'isolamento effettivo Render e Supabase Data API, i costi delle letture B2, la retention approvata nella DPIA e l'esercizio su un bucket reale di staging richiedono decisioni/autorizzazioni separate.

**Nessun merge, deploy, migrazione, attivazione, credenziale o dato reale.**