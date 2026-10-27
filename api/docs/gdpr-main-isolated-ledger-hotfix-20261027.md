# DEMOS — Correzione autonoma e minimale del registro GDPR, basata su main

**27 ottobre 2026 — Solo PR Draft; nessun merge/deploy.** È una proposta di rilascio limitata, non la migrazione dell'outbox o l'autorizzazione al ripristino.

## Perché separarla dalla catena Draft

Il confronto GitHub `main...06fb2e0c` (#365) registra **468 commit / 237 file** di differenza rispetto a `main`. Render backend live utilizza ancora `main` commit `77cfd862`; i deploy automatici sono attivati. Non è prudente integrare tutta la catena per risolvere un singolo rischio.

Questa PR **nasce direttamente da `main`** e modifica soltanto il servizio principale del ledger, una fixture test, e due file nuovi (workflow PG17 e test; più questa nota). Non introduce worker, API, flag, migrazione Supabase, B2 o dipendenze dal resto dei 468 commit.

## Problema e modifica

La `PrivacyErasureLedgerService.recordEvent` già in produzione richiama `ensureTable` durante una normale cancellazione/revoca. Se il database fosse appena ricreato senza ledger, il servizio potrebbe creare `public.privacy_erasure_ledger` **privo di RLS** mentre sta elaborando una richiesta. In produzione attuale la tabella esiste ed è RLS-protected, ma il ripristino costituisce una casistica distinta.

- `recordEvent` **non esegue più DDL**: su schema non preparato fallisce `42P01` e non crea nessuna tabella. Richiede un `privacy_erasure_ledger` preinstallato con privilegi SQL corretti.
- `ensureTable`, da chiamare **solo intenzionalmente in una manutenzione autorizzata**, emette in **un'unica query PostgreSQL** `CREATE TABLE IF NOT EXISTS public.privacy_erasure_ledger`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `REVOKE ALL FROM PUBLIC` e revoche condizionali per ruoli esistenti `anon`, `authenticated`, `service_role`, prima del commit. Indicizzazione separata in seguito.
- Gli altri helper legacy `captureCurrent`, `mergeCaptured`, `applyCurrentPrivacyState` mantengono per ora la chiamata esplicita a `ensureTable`; questi sono percorsi di manutenzione/restore e **devono essere eseguiti offline con una connessione SQL autorizzata**, non esposti via HTTP.
- La fixture `legacyLinkedRows.integration.test.js` prepara il ledger protetto prima della simulazione di cancellazione; una nuova prova PostgreSQL 17 disposable controlla il fallimento di `recordEvent` a tabella mancante, protezione RLS al primo commit, revoca idempotente dei grant API e conservazione dell'evento già salvato.

**Impatti da revisionare prima di integrare:** chiamate da ambienti appena creati senza tabella dovranno essere precedute da installazione/DDL approvati. La revoca `service_role` impedisce accesso diretto tramite Data API Supabase al registro: il servizio SQL deve usare una identità con autorizzazioni deliberate (nell'attuale Supabase produzione il ledger è del ruolo `postgres`, ma l'identità effettiva del backend Render non è stata verificata). Nessun bypass RLS, nessuna policy aperta e nessuna mutazione in produzione.

**Condizione operativa:** il backend Render ha `autoDeploy=yes`; anche una PR minima direttamente su `main`, se integrata, potrebbe innescare un deploy non coordinato. È vietato integrare senza pianificazione del rilascio, verifiche runtime e autorizzazione operatore. La issue #296 resta aperta; restore **NO-GO**.

## Nuova protezione runtime: ledger già esistente ma insicuro (27 ottobre 2026)

È stata individuata una seconda modalità di guasto durante un ripristino: il database può contenere già `public.privacy_erasure_ledger` ma avere **RLS disabilitato** o concessioni SQL inattese. La sola eliminazione del `CREATE TABLE` da `recordEvent` non basta: una `INSERT` sul registro già esistente avrebbe scritto senza verificarne la sicurezza.

La PR isolata richiede quindi, **prima di ogni registrazione ordinaria**, una singola `SELECT` sui cataloghi `pg_catalog` che verifica: presenza della relazione (con `regclass`, quindi assenza → `42P01`), `relrowsecurity=true`, assenza di qualunque privilegio tabellare concesso a `PUBLIC`, e assenza di permessi DML per `anon`, `authenticated`, `service_role` ove esistenti. In caso di incongruenza la registrazione rifiuta con `GDPR_LEDGER_SCHEMA_NOT_PROTECTED`. **Nessuna DDL o scrittura correttiva viene eseguita automaticamente**, e gli errori non includono righe o identificativi di utenti.

Sono state aggiunte prove su PostgreSQL 17 sintetico che disattivano RLS e concedono volontariamente privilegi a `PUBLIC` e `anon`, verificando ogni volta il rifiuto delle scritture, la rimozione degli accessi con provisioning esplicito e la conservazione del percorso ordinario protetto. Le verifiche dei cataloghi reali Supabase produzione mostrano `rls_on=true`, `public_acl_exists=false`, `api_role_dml_grant_count=0`, quindi lo schema osservato è compatibile con il nuovo requisito. **Non è verificata l'identità del writer SQL effettivo di Render**, e questa verifica dei cataloghi non esclude una modifica DDL concorrente fra controllo e inserimento: stop writer, freeze, isolamento e autorizzazione restano indispensabili per un vero restore.

**Costo:** `recordEvent` aggiunge una lettura di metadati SQL per evento (non per normale richiesta utente). Verificare in fase di review il comportamento dei client pool/transazioni reali e l'effetto sulla latenza. Nessuna distribuzione né modifica del database reale da questa PR Draft.

## Regressione sulle transazioni applicative (27 ottobre 2026)

La cancellazione account canonica e le concessioni/revoche del consenso politico effettuano il salvataggio dell'evento GDPR dentro una transazione e gestiscono il fallimento con `ROLLBACK`. La nuova prova su PostgreSQL 17 sintetico esercita **passaggi SQL equivalenti** (non istanzia HTTP/Express): aggiornamento del consenso, cancellazione delle scelte politiche o dell'utente, chiamata a `recordEvent`, e rollback in caso di ledger mancante (`42P01`), ledger con RLS disattivata oppure grant API `anon` improprio (`GDPR_LEDGER_SCHEMA_NOT_PROTECTED`). Controlla che tutti i record originari restino intatti e che dopo il provisioning autorizzato una transazione valida committi **un evento**. Nessun dato reale né nuova migrazione.

**Interpretazione corretta:** la regressione prova la semantica transazionale del servizio e del database sintetico, mentre l'esecuzione dell'effettiva route API, i ruoli reali, la concorrenza con modifiche DDL e l'eventuale outbox esterna richiedono controlli indipendenti. In particolare non è attestato alcun write through la connessione Render di produzione.
