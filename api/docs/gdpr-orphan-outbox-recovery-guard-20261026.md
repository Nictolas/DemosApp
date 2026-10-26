# DEMOS — controllo bidirezionale ledger/outbox GDPR (26 ottobre 2026)

**Stato:** modifica sperimentale in PR DRAFT, basata sulla PR #310 → #309 → #308 → #302. Nessun merge, deploy, migrazione o accesso a dati reali.

## Rischio residuo

Il controllo di recovery verificava che ogni evento presente nel `privacy_erasure_ledger` avesse una ricevuta outbox valida e fosse presente nel manifest esterno approvato. Non verificava però l'inverso: un evento presente **solo** in `privacy_erasure_delivery_outbox` (senza più la riga nel ledger) non sarebbe stato scansionato. Il vincolo di chiave esterna previsto dallo schema attuale dovrebbe impedire questo caso in condizioni normali, ma un restore legacy/danneggiato o uno schema non conforme può invalidare tale assunzione.

La sola assenza di eventi orfani **non prova** la completezza del manifest esterno; rimangono indispensabili la verifica indipendente di freschezza e l'attestazione infrastrutturale.

## Correzione

- Prima di importare il manifest e di cancellare dati, `reconcileRestoredPrivacyState` (solo con outbox attiva) esegue un anti-join outbox→ledger e rifiuta la riconciliazione se trova una riga outbox priva di evento corrispondente. La transazione viene annullata, conservando l'evidenza del problema.
- `PrivacyErasureOutboxWorker.status` segnala anche il conteggio aggregato `orphaned` e imposta `ready:false` se maggiore di zero. È soltanto un riepilogo locale, non una certificazione del contenuto B2.
- `verifyOutboxRecoveryReadiness` esegue lo stesso controllo all'inizio della transazione `REPEATABLE READ READ ONLY`, prima della scansione ledger→outbox e prima di ogni GET di oggetti B2. L'errore non include identificativi utente.
- Il controllo non crea tabelle, non modifica il database e non contatta servizi esterni in autonomia. L'operatore deve ricostruire e approvare il registro completo con prove indipendenti; **non eliminare semplicemente la riga orfana** per far diventare verde il test.
- Aggiunta la dipendenza dal file `privacyOutboxRecoveryReadiness.js` ai path di attivazione del workflow recovery CI.

## Test

- Test unitario con database simulato che contiene un orfano: il recovery B2 rifiuta, esegue rollback, non legge alcun oggetto remoto e non procede alla scansione ordinaria.
- PostgreSQL 17 disposable: dopo il provisioning della tabella, la fixture crea intenzionalmente un orfano disabilitando temporaneamente i trigger FK **solo in CI locale isolata**; il replay deve fallire prima di importare o cancellare dati, preservare l'evidenza, e superare il replay normale dopo la pulizia della sola fixture sintetica.
- La CI outbox PostgreSQL 17 simula a sua volta un orfano, verifica che il riepilogo locale mostri `orphaned:1` e `ready:false`, che la verifica remota rifiuti l'incoerenza, e che la normale verifica sintetica torni positiva dopo la pulizia della sola fixture.
- Il ripristino fisico `pg_dump`/`pg_restore` e gli altri test privacy restano invariati. Gli esiti CI sono da riportare solo dopo l'esecuzione verificata.

## Blocchi di produzione ancora aperti — issue #296

La completezza e freschezza degli eventi mai esportati prima di un guasto totale PostgreSQL non sono dimostrabili da un semplice confronto locale. Restano non autorizzati il test su B2 reale, la quarantena effettiva Render/Supabase, credenziali, costi, retention/Object Lock e decisioni DPIA. Nessun codice in questa PR autorizza riapertura del traffico.
