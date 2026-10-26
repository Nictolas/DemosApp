# DEMOS — Isolamento schema per cancellazione account e revoca consensi GDPR

**26 ottobre 2026 — Proposta DRAFT stacked su #331 → #330 → #329 → #328 → #327 → #326 → #302.**

## Problema

Alcuni metodi della classe `PrivacyErasureLedgerService` e le funzioni di `politicalConsentService` interrogano `information_schema.columns` limitando esplicitamente lo schema a `public`, ma successivamente eseguivano `DELETE`, `UPDATE` e letture tramite nomi di tabella **non qualificati**. Un client PostgreSQL con `search_path=pg_temp,public` e tabelle temporanee omonime poteva quindi cancellare o aggiornare relazioni diverse dalle `public` appena controllate. Il rischio include cancellazione incompleta dopo richiesta dell'utente, permanenza di dati politici dopo revoca e aggiornamento del consenso su una tabella ombra.

## Correzione (senza DDL)

- Gli helper dinamici `deleteByColumn`, `deleteByAnyColumn`, `removeUserFromArrayColumn` di `PrivacyErasureLedgerService` usano sempre `public.${quoteIdentifier(table)}`, continuando a quotare correttamente i nomi di tabella/colonna. L'informazione di schema utilizzata per selezionare le colonne resta limitata a `public`.
- Le cancellazioni collegate a `reazioni` / `comunicazioni`, la cancellazione finale di `users`, gli aggiornamenti di revoca su `users` e `user_consents` e le scansioni del ledger in `applyCurrentPrivacyState` sono qualificate `public`.
- Le letture del consenso corrente e la pulizia dei campi legacy personali in `politicalConsentService` sono qualificate `public`.
- Non vengono aggiunti `CREATE TABLE`, `ALTER TABLE`, migrazioni, nuove variabili di ambiente o modifiche alle transazioni esistenti.

## Regressione PostgreSQL 17 sintetica

La suite `api/scripts/verify-privacy-recovery-gate-ci.js` viene eseguita **esclusivamente** con il database CI locale disposable e la consueta guardia `GITHUB_ACTIONS=true`, `PRIVACY_RECOVERY_CI=isolated`, host e password fittizi. Nella stessa transazione:
1. Prepara unicamente fixture sintetiche per messaggi/reazioni e copie temporanee di `users`, `user_consents`, `opinioni_risposte`, `political_selections`, `user_representatives`, `comunicazioni`, `reazioni`.
2. Imposta `SET LOCAL search_path = pg_temp, public`, con un consenso deliberatamente diverso nella tabella temporanea, e verifica che la lettura corrente punti a `public`.
3. Esegue direttamente `enforcePoliticalRevocation` e `enforceAccountDeletion` senza utilizzare il `SET LOCAL` protettivo del replay: devono scomparire i dati personali in `public`, essere conservate le copie `pg_temp`, essere ripulite le reazioni collegate e l'elenco `read_by` di un messaggio altrui, preservando un altro account.
4. Effettua `ROLLBACK` e verifica che i dati inventati originari siano stati ripristinati, prima dei drill di recovery già esistenti.

Questo test dimostra il comportamento degli helper su un database disposable, non il completamento della cancellazione su tutte le tabelle di una produzione reale o la correttezza di altri percorsi non inclusi nell'audit.

## Dipendenze ancora aperte

- La completezza e freschezza indipendente degli eventi fino alla barriera di arresto, e la durabilità delle revoche eventualmente perse insieme al database **non** sono dimostrate dal registro locale o dai test PG17.
- Serve verifica organizzativa e infrastrutturale dell'isolamento di tutti gli ingressi, i worker e le connessioni Render/Supabase (incluse Data API e tabelle ulteriori).
- Serve verifica su B2 staging reale di Object Lock COMPLIANCE, retention, VersionId, crash/retry e privilegi minimi.
- Decisioni documentate del titolare e DPO su DPIA, conservazione, costi e procedura operativa restano dipendenze bloccanti.

**Non fare merge/deploy/migrazioni o attività su servizi, segreti, dati reali e produzione. La PR non autorizza il ripristino né l'apertura del traffico.**
