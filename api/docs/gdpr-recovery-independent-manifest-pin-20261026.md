# DEMOS — Pin di freschezza indipendente per il ripristino GDPR

**Proposta DRAFT del 26 ottobre 2026. Nessun deploy o recovery reale.**

## Problema risolto nel codice

Un manifesto può avere una firma HMAC valida ma essere **vecchio**: il contenuto potrebbe non includere le revoche successive. Verificare solo la firma non dimostra né l'integrità della cronologia completa né la correttezza dell'orario di backup.

La nuova funzione `assertIndependentRecoveryCheckpoint` richiede **prima di qualsiasi query SQL** tre approvazioni fornite da un canale diverso rispetto al file firmato:

- SHA-256 atteso dell'intero manifesto normalizzato più la sua firma (`expectedManifestDigest`).
- Timestamp attendibile del backup effettivamente ripristinato (`expectedRestoredBackupTakenAt`).
- Timestamp attendibile del checkpoint esterno approvato (`expectedCapturedAt`).

Un manifesto autentico ma tagliato o riprodotto da una versione precedente ha digest diverso e viene rifiutato. L'assenza anche di una sola approvazione blocca il ripristino. I controlli sono effettuati prima dell'apertura della transazione.

**Limitazione critica:** se digest, timestamp e manifesto sono letti tutti dallo stesso oggetto o possono essere sostituiti dalla stessa persona/chiave, il pin non aggiunge protezione dalla sostituzione o dall'uso di versioni precedenti. In produzione dovranno provenire da un archivio separato con protezione contro rollback, audit di accesso e segregazione dei ruoli. I test CI calcolano il pin su una fixture sintetica approvata per riprodurre un ambiente esterno. Il repository NON possiede ancora questa infrastruttura.

## Verifiche di isolamento ancora aperte

- Il flag `DEMOS_PRIVACY_RECOVERY_MAINTENANCE=true` copre il processo Express e i suoi job avviati in-process, non tutte le repliche Render, altre funzioni edge, sessioni PostgreSQL già connesse o la Data API Supabase.
- Le [restrizioni di rete Supabase](https://supabase.com/docs/guides/platform/network-restrictions) si applicano alle connessioni dirette Postgres e al pooler, **non** alle API HTTPS di PostgREST, Auth, Storage o alle librerie supabase-js. Non considerarle una quarantena totale.
- Un recovery deve usare un database destinazione isolato dalla rete pubblica finché il ledger e il pin non sono stati convalidati, con passaggio al traffico autorizzato solo dopo attestation e DPIA.
- La lista completa dei servizi Render richiede una selezione esplicita del workspace autorizzato; non vanno ipotizzati servizi né modificati ambienti di produzione.

## Test

- Test unitari: firma HMAC valida + manifesto ritagliato, digest errato, backup cutoff sbagliato, pin assente => rifiuto prima di accesso SQL.
- PostgreSQL 17 sintetico: gate vincolato al checkpoint indipendente.
- Drill fisico `pg_dump` → database distrutto → `pg_restore`: manifesto valido ma ritagliato rifiutato, nessun evento importato; manifesto approvato riconcilia revoche e cancellazioni.

**Gates mancanti:** archivio esterno append-only affidabile e continuo, checkpoint autorevole indipendente dal file, misura di freschezza, quarantena completa Supabase/Render, test con versioni reali e validazione DPO/titolare. Issue #296 resta aperta.