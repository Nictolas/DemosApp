# DEMOS — Protezione del replay GDPR da writer concorrenti (26/10/2026)

**Proposta su PR DRAFT, dipendente da #326 → #325 → #324 → #302. Non autorizza alcun recovery produttivo.**

## Difetto e correzione

`reconcileRestoredPrivacyState` validava un manifesto firmato e indipendentemente pinnato, cercava eventi non approvati nel ledger ripristinato e importava/applicava le revoche. In precedenza l'advisory lock `pg_advisory_xact_lock(170026, 296)` coordinava soltanto i componenti che usavano **lo stesso advisory lock**. Un'altra istanza o connessione con permesso di scrittura al ledger/outbox poteva modificare quelle tabelle durante i controlli; le diverse query del replay usavano `READ COMMITTED`. Un evento non incluso nel manifesto avrebbe potuto essere inserito dopo il controllo degli eventi sconosciuti.

Il replay, **dopo** aver verificato che lo schema richiesto sia preinstallato e che la modalità outbox corrisponda, ottiene ora nella **stessa transazione**:

1. l'advisory lock di recovery condiviso con l'esportatore offline;
2. un `LOCK TABLE privacy_erasure_ledger, privacy_erasure_delivery_outbox IN SHARE ROW EXCLUSIVE MODE NOWAIT` quando l'outbox e' abilitata; se disabilitata e assente, blocca solo `privacy_erasure_ledger`;
3. esegue l'intera verifica di eventi/orfani e il replay prima di `COMMIT`.

La sequenza advisory → tabelle e' uguale a quella dell'esportatore della PR #326. `NOWAIT` deve interrompere il replay con errore PostgreSQL `55P03` davanti a un writer concorrente su una delle tabelle, prima dell'importazione. In caso di errore, la transazione viene annullata.

## Test sintetico

Il workflow di recovery esegue un drill PostgreSQL 17 in un database temporaneo e isolato. Una seconda connessione apre una transazione `UPDATE` sul ledger, poi sulla outbox, senza usare l'advisory lock. Ciascun replay deve fallire con `55P03`; il test verifica che gli eventi non siano importati e che i dati politici fittizi non siano cancellati. Terminata la transazione del writer, il replay ordinario continua e i controlli precedenti di importazione, idempotenza e rollback devono superarsi.

## Limiti

Il lock su due tabelle **non** congela le tabelle di consenso, voti, opinioni e account. Non puo' impedire traffico da tutti i backend Render, Supabase Data API, connessioni dirette o altri worker, ne' certificare la completezza e freschezza di eventi mai archiviati. La quarantena verificata di tutta l'infrastruttura e' ancora obbligatoria prima di un ripristino reale. Non attribuire a questo controllo approvazioni DPIA/DPO, decisioni su retention/costi o validazione B2 Object Lock.

Solo codice in bozza e dati sintetici. Nessun merge, deploy, migrazione, credenziale, servizio attivato, accesso a produzione o a dati reali.
