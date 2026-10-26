# DEMOS — integrità ledger/outbox nel ripristino GDPR (26/10/2026)

**Stato:** PR #305 in bozza, stacked su #304. Nessun merge, deploy, recupero o consultazione di dati reali.

## Problema

Un ripristino corretto degli eventi firmati in `privacy_erasure_ledger` può lasciare un buco in `privacy_erasure_delivery_outbox`: i record recuperati dal registro esterno non vengono necessariamente importati insieme alle ricevute o inseriti nella coda. Una lettura della sola outbox potrebbe allora non mostrare alcun lavoro pendente, anche se il ledger contiene eventi che devono essere verificati nuovamente su Backblaze B2.

## Comportamento proposto

- L'operazione `reconcileRestoredPrivacyState` rimane **solo offline** e deve essere eseguita da un operatore dopo la quarantena verificata di ogni ingresso (inclusi Render, worker e Supabase Data API).
- Prima di importare o cancellare dati, il processo legge se lo schema `privacy_erasure_delivery_outbox` è stato installato. Un flag `GDPR_ERASURE_OUTBOX_ENABLED=true` con tabella assente viene rifiutato; altrettanto una tabella esistente con flag disabilitato. Non vengono emessi comandi DDL per creare implicitamente la tabella.
- Dopo la verifica crittografica del manifest esterno, il confronto delle chiavi del ledger ripristinato, l'import e la verifica della completezza locale, la stessa transazione aggiunge **solo le righe mancanti** all'outbox per tutti gli eventi del ledger. Una ricevuta precedentemente verificata resta invariata, grazie a `ON CONFLICT (event_key) DO NOTHING`.
- Il controllo finale `LEFT JOIN` conferma che nessun evento del ledger sia privo di riga outbox; in caso di disallineamento o errore, l'intero import, l'accodamento e l'applicazione delle cancellazioni vengono annullati con `ROLLBACK`.
- Il risultato include solo `outboxInserted` e `pendingExternalReceipts` come conteggi. **Nessuno dei due dimostra disponibilità, integrità o attualità degli oggetti B2.** Ogni ricevuta richiede la verifica remota version-pinned della PR #302 e un checkpoint esterno indipendente e non aggirabile.
- La semplice presenza della tabella non attiva un worker B2; l'avvio deve essere gestito e autorizzato separatamente. Quando la ricostruzione termina, il database deve rimanere isolato finché i gate GDPR e di recupero non sono superati.

## Verifiche sintetiche

- PostgreSQL 17: tabella outbox mancante, modalità disabilitata con schema installato, import atomico di eventi firmati, idempotenza, preservazione ricevute preesistenti e nuove consegne pendenti.
- `pg_dump` + distruzione + `pg_restore`: recupero da snapshot precedente alla revoca, provisioning offline obbligatorio, 4 righe ledger/outbox accodate e nessun ripristino delle vecchie scelte personali.
- Test con dati interamente inventati. Nessuna chiamata a Backblaze o database reali.

## Limiti irrisolti (issue #296)

Un registro B2 (o un PostgreSQL ripristinato) può non contenere eventi che non hanno mai raggiunto lo storage esterno prima di una perdita totale del database. L'outbox, pur essendo transazionale, è memorizzata nello stesso database e **non fornisce da sola un attestato di completezza globale**. Restano indispensabili fonte esterna autonoma con prova di freschezza, archivio B2 in Object Lock con retention approvata, quarantena verificata Render/Supabase, recupero operativo testato e revisione DPIA/titolare/DPO.

**Non autorizza la riapertura dell'app né il rilascio della catena di PR.**