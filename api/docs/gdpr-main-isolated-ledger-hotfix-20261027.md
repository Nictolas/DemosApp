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
