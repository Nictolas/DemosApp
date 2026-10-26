# DEMOS — collisioni temporali nei consensi GDPR durante il recovery

**26 ottobre 2026 — PR #306 in bozza, sopra #305.** Nessun deploy, merge, migrazione o accesso a dati reali.

## Rischio concreto

Il ledger contiene eventi `political_consent_granted` e `political_consent_revoked` con `occurred_at` e un `event_key` UUID. In precedenza `applyCurrentPrivacyState` sceglieva lo stato più recente con `ORDER BY occurred_at DESC, event_key DESC`. Quando due eventi contraddittori per lo stesso soggetto hanno timestamp identico, il valore casuale dell'UUID determina quale dei due risulta ultimo: **non è una prova dell'ordine delle azioni**.

La normalizzazione dei manifest usa `Date#toISOString()` (precisione millisecondi), mentre PostgreSQL conserva microsecondi. Per questo la collisione viene verificata anche quando due eventi distinti nel database cadono nello stesso millisecondo.

## Comportamento fail-closed

1. Durante la validazione del manifest firmato, se lo stesso soggetto ha una concessione e una revoca nello stesso millisecondo, la validazione fallisce **prima di qualsiasi query SQL**.
2. Anche chi richiama direttamente `PrivacyErasureLedgerService.applyCurrentPrivacyState` riceve un errore in caso di collisione temporale: la verifica SQL precede cancellazioni di account, dati politici e risposte.
3. L'operatore non deve scegliere il risultato confrontando gli UUID, modificare a mano gli eventi o far passare un manifest abbreviato. Occorre isolare il ripristino, ricostruire l'ordine con prove indipendenti e far approvare una procedura coerente con DPIA/titolare/DPO; se non è possibile stabilirlo, non riaprire l'app.
4. La correzione non risolve il problema generale della **completezza** degli eventi esterni a PostgreSQL, della verifica B2, della quarantena delle API o della freschezza del checkpoint.

## Prove sintetiche

- Unit test: eventi grant/revoke a 500 microsecondi di distanza, identici dopo normalizzazione JavaScript, manifest rifiutato senza DB.
- PostgreSQL 17: replay diretto con eventi contraddittori e timestamp a precisione microsecondi, rifiuto prima della cancellazione e verifica che i dati personali preesistenti non cambino.
- CI della PR #306 da considerare autorevole soltanto quando tutte le suite pertinenti sono concluse; nessun dato reale usato.

**La PR resta in bozza e non costituisce autorizzazione al recovery di produzione.**
