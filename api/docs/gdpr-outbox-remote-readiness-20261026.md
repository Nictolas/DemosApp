# DEMOS — Gate di verifica locale e B2 prima del ripristino (26/10/2026)

**PR #302 DRAFT, stacked su #301. Nessun merge, deploy, attivazione o accesso ai dati reali.**

## Correzioni

1. `recordEvent` non esegue piu' DDL di creazione dell'outbox sulla richiesta utente quando `GDPR_ERASURE_OUTBOX_ENABLED=true`. L'installazione e il backfill devono essere compiuti intenzionalmente in quarantena prima dell'attivazione. Se la tabella non esiste, PostgreSQL rifiuta l'inserimento atomico e la transazione chiamante non deve committare. Il ledger legacy usa ancora `ensureTable`; questa PR non cambia il suo schema storico.
2. `PrivacyErasureOutboxWorker.status()` distingue `pending`, `unqueued` (eventi del ledger mai accodati), `invalidReceipts` (marcatori localmente invalidi). `ready=true` e' un'indicazione LOCALE: non certifica l'esistenza dell'oggetto B2 né che il DB contenga tutti gli eventi realmente prodotti.
3. `PrivacyErasureB2Journal.verifyArchivedReceipt` verifica il VersionId specifico senza PUT, con readback del corpo, SHA256, dati di evento, retention e Object Lock COMPLIANCE. Non riscrive automaticamente una versione B2 mancante.
4. `verifyOutboxRecoveryReadiness` e' un controllo OFFLINE: richiede attestazione manuale della quarantena, un client PostgreSQL DEDICATO (non `pool.query`), un exporter B2 configurato, e scorre il ledger in una transazione `REPEATABLE READ READ ONLY` senza modificare lo schema. Per ogni evento esige outbox consegnata e ricevuta B2 coerente e verificata. Fallisce con tabella mancante, eventi non accodati, pendenti, ricevute false, versioni remote non disponibili o limite di sicurezza superato. Restituisce solo conteggi aggregati.

## Limite critico

**Anche quando questo test passa, non autorizza il rilascio o un restore:** non puo' vedere eventi GDPR perduti prima di essere registrati nel database sopravvissuto, e non può dimostrare che un checkpoint esterno sia il piu' recente. Un DB ripristinato potrebbe mostrare `pending=0` con eventi completamente mancanti. Servono pin esterno fresco e indipendente (#299), continuita' verificabile della cronologia B2, integrita' anti-rollback, quarantena di tutte le API/worker Render/Supabase e DPIA/DPO.

## Sicurezza e utilizzo

- Nessun collegamento automatico all'app, alle route utente o alle procedure di deploy.
- Nessun client B2/DB reale disponibile o invocato dai test.
- Un controllo con `maintenanceConfirmed=true` e' una dichiarazione del chiamante: la funzione NON puo' dimostrare che Supabase Data API, altre istanze o vecchi client siano davvero isolati.
- **Semantica fail-closed del flag outbox (bozza):** `GDPR_ERASURE_OUTBOX_ENABLED` assente oppure esattamente `false` indica la modalità legacy; esattamente `true` richiede l'evento e la riga outbox atomici. Ogni altro valore configurato, anche stringa vuota o `TRUE`, causa errore **prima di qualunque query** in `recordEvent` e nel replay offline, invece di salvare eventi GDPR senza coda B2. Prima di attivare in produzione, verificare esplicitamente il valore effettivo del flag su **tutte** le istanze: non si deve assumere che il blocco HTTP o questa validazione dimostrino l'isolamento dei worker/Supabase.
- **Semantica fail-closed del flag HTTP (bozza):** `DEMOS_PRIVACY_RECOVERY_MAINTENANCE` non impostato o esattamente `false` lascia proseguire il normale traffico; esattamente `true` risponde 503. Qualsiasi altro valore **impostato**, compresi `TRUE`, `false ` (spazi), `0` o una stringa vuota, risponde **503**: un errore di battitura in una configurazione di recovery non deve sbloccare silenziosamente l'API. Per il normale servizio usare una variabile assente o `false`; non interpretare il blocco HTTP come prova di quarantena infrastrutturale.

- Per una prova corretta eseguire solo su database isolato con client dedicato e checkpoint esterno approvato. Non passare identita' o preferenze in log.
- Il controllo B2 completo richiede una lettura per evento: costi, latenza e limiti delle API vanno valutati a parte.

## Test sintetici previsti

PostgreSQL 17 su GitHub Actions: schema assente e SQL fail-closed, backfill, transazioni e retry, coda pendente, eventi ledger non accodati, receipt alterata, oggetto remoto eliminato, scansione paginata e limite massimo di verifica. Nessun dato di produzione.