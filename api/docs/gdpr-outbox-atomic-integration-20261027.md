# DEMOS — GDPR ledger + outbox atomici sulla catena sicura (27 ottobre 2026)

**Stato: DRAFT / NO-GO / funzione disattivata.** PR #373 sopra la #372 → #371 → #366. Nessun merge su `main`, deploy, provider write, password, migrazione Supabase o copia di dati reali.

## Integrazione effettuata (risolve il conflitto tra i due rami)

È stata modificata **solo** la versione del ledger già protetta dalla #371 (`api/services/privacyErasureLedgerService.js`), invece di sostituirla con la vecchia versione contenuta nel ramo complessivo di recovery #365.

- `recordEvent()` conserva la preflight read-only `assertProtectedLedger()`, la modalità precedente predefinita e la compatibilità con revoche/cancellazioni già testate.
- Nuova `GDPR_ERASURE_OUTBOX_ENABLED`: assente/`false` = modalità precedente; `true` = scrittura transazionale ledger+outbox; qualunque altro valore è un errore **prima di interrogare il DB**. **Nessun codice abilita il flag automaticamente.**
- Nella modalità outbox il payload viene serializzato una sola volta, verificato dal contratto B2 e trasmesso con la stessa copia JSON a PostgreSQL; `null`, array, falsi, serializzazioni invalide e contenuti oltre il limite B2 vengono rifiutati **prima delle scritture**.
- `recordEvent` richiede che **entrambe** le relazioni esistano e siano protette da RLS/ACL; **non esegue DDL** da nessuna richiesta utente. La scrittura usa una singola istruzione PostgreSQL con due CTE di modifica e inserisce l'evento e la riga di coda atomicamente. Funziona anche dentro una transazione di consenso/cancellazione del chiamante.
- `ensureDeliveryOutbox()` è esclusivamente un installer per una **futura** finestra di manutenzione autorizzata: crea `privacy_erasure_delivery_outbox`, applica RLS e `FORCE RLS` e revoca nello stesso comando SQL i permessi non necessari a `PUBLIC`, `anon`, `authenticated` e `service_role`.
- `assertProtectedOutbox()` verifica esclusivamente i cataloghi (RLS e grant); non ispeziona utenti o eventi. Un outbox mancante o esposto causa errore e impedisce nuove scritture in modalità outbox.
- `mergeCaptured()` conserva il **fail-closed sui `details` JSONB nulli/mancanti** della #371 e l'arresto sui conflitti di chiave evento. Non è stato importato `row.details == null ? {} : row.details` dal vecchio codice di recovery.

## Evidenza PostgreSQL 17 — SOLO CI usa-e-getta

`api/tests/gdprOutboxAtomicIsolated.pg17.test.js` richiede una stringa di connessione *esattamente locale* con nome DB fittizio, `GITHUB_ACTIONS=true` e `GDPR_OUTBOX_CI=isolated`. Rifiuta `DATABASE_URL` e configurazioni Supabase/Render. Workflow `.github/workflows/gdpr-atomic-outbox-on-ledger-ci.yml`.

Casi superati:

1. Flag inattivo per impostazione predefinita; valore errato respinto prima di SQL.
2. Payload non JSONB o troppo grande rifiutato prima di qualsiasi query.
3. Ledger/outbox assenti: l'API non crea tabelle automaticamente.
4. Outbox bootstrap sintetico `RLS=true`, `FORCE=true`, **zero grant DML** ai ruoli Data API.
5. Evento + outbox scritti nella **stessa transazione**, `ROLLBACK` li elimina entrambi.
6. Writer `LOGIN NOBYPASSRLS`, non owner, con policy fittizie su identità sintetica: evento/outbox persistono entrambi.
7. Rimuovendo il diritto `INSERT` sull'outbox, la scrittura è rifiutata con `42501` e **non** lascia l'evento nel ledger.
8. La policy sul soggetto respinge eventi di altri utenti senza effetti collaterali.
9. `mergeCaptured` continua a rifiutare `details` nulli, `undefined`, falsi e array senza importazione parziale.
10. La modalità legacy OFF salva il solo evento anche quando una tabella outbox è presente, confermando la retrocompatibilità.

CI su commit di introduzione `82d4829`: **4/4 SUCCESS** (political erasure, GDPR ledger, privacy erasure, transactional outbox); **Snyk SUCCESS**.

## Limiti e decisione sul rilascio

La PR **non** abilita outbox né esportazione B2 in alcuna istanza reale, **non** modifica il database `Demos-Staging` già creato (la sua tabella outbox resta assente), non crea credenziali e non include un worker di consegna. Non prova la completezza/freschezza del ledger esterno, la retention reale B2, il pool effettivo di Render o l'isolamento di tutte le fonti dati.

**Sequenza sicura successiva**: estrarre worker+retry B2 in un'altra tranche sulla medesima catena; testare retry/ack con B2 finto e PostgreSQL effimero; progettare e approvare separatamente migrazione outbox di staging con policy minime per writer+worker, senza apertura HTTP; solo dopo attestare bucket/versioning/retention/backup esterno e fare recovery quarantinato. Tutti i passaggi provider richiedono autorizzazione operativa specifica e non conseguono dalla CI verde.

**Recovery GDPR issue #296: NO-GO**; PR Draft #373 non deve essere unita direttamente a `main` con auto-deploy.
