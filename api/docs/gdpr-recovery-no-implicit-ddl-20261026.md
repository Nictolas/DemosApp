# DEMOS — ripristino GDPR senza DDL implicito (26/10/2026)

**Stato:** proposta DRAFT stacked su PR #306 (a sua volta stacked su #302). Non eseguire in produzione.

## Difetto individuato

La procedura offline `reconcileRestoredPrivacyState` invocava `Ledger.ensureTable()` prima di controllare la presenza dell'outbox. Inoltre, `mergeCaptured()` e `applyCurrentPrivacyState()` chiamavano internamente `ensureTable()`, che esegue `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`. Se un ripristino fosse stato privo del ledger, il replay avrebbe potuto **creare una nuova tabella** senza segnalare lo schema incompleto. L'HMAC del manifest non prova che il database ripristinato abbia conservato la struttura attesa.

## Modifica

1. Il recovery verifica `to_regclass('public.privacy_erasure_ledger')` prima di importare qualsiasi evento o modificare dati. Schema mancante → errore, `ROLLBACK`, nessuna tabella creata.
2. Le due funzioni del ledger accettano un'opzione interna `requirePreinstalled: true` usata esclusivamente dal percorso di replay verificato; evita la creazione implicita di tabelle e indici anche nelle chiamate annidate. Il comportamento legacy degli altri chiamanti resta invariato.
3. Rimangono obbligatori manifest firmato, hash approvato indipendentemente, confronto completo con il ledger ripristinato, verifica della outbox e quarantena operativa di ogni accesso.
4. I test PostgreSQL 17 sintetici simulano un ledger mancante, verificano che resti assente dopo il rifiuto e che le selezioni utente restino intatte; un client strumentato rifiuta qualsiasi `CREATE TABLE/INDEX` durante replay riuscito e ripetuto.
5. La prova fisica `pg_dump`/`pg_restore` danneggia **solo la copia disposable CI** eliminando il ledger, verifica il rifiuto e lo ricrea intenzionalmente nel test prima di proseguire con il replay. Nessun database o bucket reale.

## Limiti non risolti (issue #296)

La presenza dello schema non certifica **completezza degli eventi** dopo perdita totale del database. Serve un checkpoint di freschezza esterno e indipendente, archivio B2 version-pinned realmente verificato, quarantena completa di Supabase/Render, approvazione DPIA/retention e un runbook operativo autorizzato. Nessun `ready=true` locale abilita il rilascio.

**Nessun merge, deploy, migrazione di produzione, credenziale o dato reale.**
