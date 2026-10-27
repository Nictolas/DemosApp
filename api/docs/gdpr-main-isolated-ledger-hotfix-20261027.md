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

## Verifica ACL a livello di colonna e writer non proprietario (27 ottobre 2026)

La review ha individuato una lacuna concreta nel controllo `assertProtectedLedger`: `has_table_privilege` non rileva necessariamente i `GRANT SELECT/INSERT/UPDATE` assegnati **solo a singole colonne**. Con RLS e zero policy attuali tali grant non bastano per leggere il ledger, ma dopo un restore con policy diversa non sarebbe corretto certificare il registro come privo di privilegi API. Il controllo ora include `has_any_column_privilege` per i tre ruoli Supabase e ispeziona `pg_attribute.attacl` per eventuali grant a `PUBLIC` su colonne; in caso di anomalia `recordEvent` fallisce chiuso. Il provisioning `REVOKE ALL ON TABLE` rimuove anche i privilegi di colonna corrispondenti secondo PostgreSQL 17; la regressione sintetica lo verifica con grant fittizi a `anon`, `authenticated` e `PUBLIC`.

La stessa suite PostgreSQL 17 simula `SET ROLE gdpr_nonowner_ci` (NOLOGIN, NOBYPASSRLS) con `USAGE` schema e `GRANT INSERT/SELECT` sul ledger: senza una policy RLS applicabile, `recordEvent` fallisce con `42501` e non aggiunge eventi. Questa è una **prova negativa di compatibilità**, non l'identificazione del ruolo effettivo Render. Un operatore autorizzato deve attestare il writer SQL del vero backend prima del rilascio; nessun `GRANT`, policy o `BYPASSRLS` sul database reale viene proposto o eseguito automaticamente. Restore e deploy restano NO-GO.


## Gate operativi verificati in sola lettura — 27 ottobre 2026

**Evidenze dal controllo dei cataloghi (nessun dato utente e nessuna mutazione):**
- Supabase **Demos-Staging** (`fkeayjzvtuvzesljhjbc`): `to_regclass('public.privacy_erasure_ledger') IS NOT NULL = false`. Il bootstrap protetto **non è stato eseguito** e le route GDPR con il nuovo codice fallirebbero chiuse fino a provisioning autorizzato.
- Supabase **Demos** (`wxnblcqoyjqxktwkcqok`): tabella presente, `relrowsecurity=true`, proprietario `postgres`. Sono informazioni sulla **relazione**, non una prova del writer Render.
- Il controllo aggregato delle sessioni `pg_stat_activity` per `application_name='demos-app-performance-optimized'` o `demos%` non ha restituito connessioni attribuibili all'applicazione, né nello staging né in produzione. Questo **non prova** che il backend non sia connesso: il pooler può nascondere il nome dell'app e le connessioni potrebbero essere inattive.
- L'identità `postgres` vista usando lo strumento SQL di Supabase indica solo **la connessione di ispezione**. Non attribuirla al servizio Render.

**Attestazione necessaria del writer:** da una connessione temporanea in sola lettura che usi *esattamente il pool e la configurazione del processo backend* destinato allo staging, raccogliere esclusivamente `current_user`, `session_user`, `current_setting('role', true)`, `current_database()` e i risultati booleani dei controlli `has_table_privilege` / `pg_class.relrowsecurity` dopo il provisioning. Non registrare `DATABASE_URL`, password, indirizzi, query applicative, identificativi utenti o eventi del ledger. `current_user` richiesto via Supabase SQL editor **non è sostitutivo** della prova dal pool Render. Verificare il ruolo per l'endpoint effettivo (anche con Supavisor), e che il writer possa inserirvi un evento **soltanto in un database sintetico o staging quarantinato**; la prova non deve avvenire con dati personali reali.

**Sequenza proposta per staging, senza esecuzione automatica:**
1. Confermare un freeze dello staging e l'isolamento dei processi che scrivono/leggono dati personali; accertare che l'ambiente sia separato dalla produzione.
2. Verificare lo snapshot/sorgente, il catalogo del database, la disponibilità del ruolo manutentore e la possibilità di revertire codice senza far perdere il ledger. Approvare separatamente ogni DDL dello staging.
3. Solo dopo approvazione, l'operatore esegue il bootstrap intenzionale `ensureTable` sul database di staging con ruolo SQL autorizzato, e controlla RLS, privilegi tabella/colonna e assenza di accesso ai ruoli API.
4. Con lo stesso pool utilizzato dal backend di staging, verificare fingerprint del ruolo e risultato di una transazione sintetica con `ROLLBACK` per accertare autorizzazioni e RLS; eseguire gli endpoint reali solo su utenti di prova e ambiente isolato. Nessun invio reale ai provider esterni.
5. Compilare un verbale senza PII: progetto, commit, PG version, ruolo SQL, bootstrap, RLS, privilegi, output PASS/FAIL, rollback e responsabile. **FAIL su uno qualunque ⇒ NO-GO**.

**Separare rilascio del fix da recovery completo:**
- Prima di qualunque merge: piano di finestra e comunicazione, valutazione `autoDeploy` Render su `main`, smoke test, backup, owner e procedura di arresto/rollback applicativo. Non effettuare automaticamente né merge né deploy.
- Non rimuovere o indebolire RLS per sbloccare uno scrittore non autorizzato; il test sintetico nonowner con errore `42501` è un limite di compatibilità intenzionale, non un difetto da eludere.
- Il ripristino GDPR resta **NO-GO** finché non esistono isolamento cross-provider, evidenza indipendente di integrità/completamento/freschezza del registro esterno B2, replay transazionale e controlli di readiness fail-closed, nonché autorizzazione DPO/titolare.


## Verifica Render nel workspace confermato — 27 ottobre 2026

Workspace Render **Nicolas** (ID `tea-d2gs3eadbo4c73ag95rg`), ispezionato in sola lettura con il consenso dell'operatore.

- **Backend produzione**: servizio `demos-backend` (`srv-d2gt3dodl3ps73fmereg`), branch `main`, root `api`, **autoDeploy=yes / trigger commit**. Ultimo deploy `live`, ID `dep-dbeihmuq1p3s73eam4f0`, commit esatto `77cfd86277e8a7c5c5540d42464fe5af46923d01`, completato il **24 ottobre 2026 alle 21:54:38 UTC**. Questo verifica che il backend reale **non contiene PR #366**.
- **Frontend produzione**: servizio `demos-frontend` (`srv-d2nm5pmmcj7s73cophhg`), branch `main`, root `client`, **autoDeploy=yes / trigger commit**. La finestra di merge deve considerare **entrambi** i servizi: eventuali build filter potrebbero essere configurati altrove ma non sono stati attestati; non assumere che un merge backend-only lasci il frontend invariato.
- **Staging HTTP funzionale**: `demos-functional-staging` (`srv-db52l1g473hc739ld250`), branch `staging/functional-integration-v0`, autoDeploy=no, ultimo deploy `live` commit `645d72d37b9178233b7f66c7433cb90e51bf585c` completato il 15 ottobre 2026. È **separato** dal rilascio #366; non assumere che usi il progetto Supabase Demos-Staging.
- **Altro database Render**: `demos-civic-staging-db` (PostgreSQL 17, ID `dpg-db4id8id0e5s73cfb0cg-a`) è una risorsa diversa dal progetto **Supabase Demos-Staging**. La sua esistenza non dimostra né il database né il ruolo SQL utilizzati dal backend.
- **Ruolo SQL effettivo backend**: **NON ATTESTATO**. Il servizio Render espone metadati del deploy e configurazione, ma le API di sola lettura disponibili non forniscono la connection string o il suo username. La ricerca nei log applicativi non ha restituito `current_user`/`session_user` del pool PostgreSQL: le voci `role` individuate erano ruoli applicativi, non database. Le sessioni `pg_stat_activity` Supabase mostravano servizi di piattaforma/Supavisor ma nessuna attribuzione univoca al processo backend. **Non inferire** il ruolo dell'app da `postgres` del SQL editor o dalle sessioni di sistema.

**Verifica futura obbligatoria e non ancora eseguita:** dal processo effettivo di staging (stessa configurazione di pool/driver e ruolo SQL previsto per Render), eseguire solo le query non sensibili `SELECT current_user, session_user, current_setting('role', true), current_database()` e controlli di privilegi; attestare il risultato senza URL, password, host, dati utente o eventi. Solo dopo isolamento e bootstrap staging autorizzato, eseguire test di scrittura su fixture artificiali, includendo rollback. Nessuna prova SQL runtime di produzione va usata come scorciatoia.

**CI del nuovo HEAD documentale:** i due workflow di #366 risultano ancora `success` sul commit `3995eb6` (documentazione). Non cambia il codice applicativo né risolve le verifiche operative.

**Stato e decisione immutati:** PR #366 OPEN/DRAFT, nessun merge, nessun deploy, nessuna mutazione del database; ripristino GDPR **NO-GO**.
