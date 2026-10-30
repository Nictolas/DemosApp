# DEMOS — Correzione autonoma e minimale del registro GDPR, basata su main

**27 ottobre 2026 — Solo PR Draft; nessun merge/deploy.** È una proposta di rilascio limitata, non la migrazione dell'outbox o l'autorizzazione al ripristino.

## Gate distinto: revoca delle selezioni personali (#295) — verificato 27 ottobre 2026

**Questa hotfix di sicurezza del ledger NON costituisce il completamento
dell'erasure delle scelte politiche personali.** La
[PR #295](https://github.com/Nictolas/DemosApp/pull/295) è una correzione
ancora **OPEN/DRAFT, stacked su altri rami**, distinta dalla #366.

Il codice `main` / #366 di `cleanupConsentScopedPoliticalData` cancella
opinioni e voti collegati al consenso, ma non cancella attualmente le **scelte
personali** nelle tabelle `political_selections` e
`user_representatives`, né la relativa proiezione di campi legacy di
rappresentanti/candidati in `users`. La #295 propone di eliminare in
transazione solo le selezioni appartenenti alla persona che revoca il
consenso, preservando quelle altrui, e di applicare la stessa pulizia
anche al replay GDPR dopo restore; richiede una separata review DPIA e
approvazione del perimetro giuridico.

**Evidenza effettiva solo da cataloghi SQL Supabase di PRODUZIONE
(27 ottobre, nessuna riga personale letta):**
- `public.political_selections` è una tabella con `user_id` e
  `selected_user_id`;
- `public.user_representatives` è una tabella con `user_id` e 10
  colonne con prefissi `rappresentante_` / `candidato_`;
- `public.users` contiene 11 colonne con tali prefissi.
Questa verifica **non attesta che esistano utenti revocanti con selezioni
residue**: dimostra soltanto che le strutture interessate sono reali.
**Non eseguire query sulle scelte individuali per cercare conferme**.

Non integrare la #295 tramite l'intera catena stacked senza review.
Non aggiungere automaticamente questa modifica alla #366: una
correzione del protocollo tecnico del ledger e un ampliamento dello scope
dell'erasure sono decisioni di rilascio distinte. Un eventuale GO
circoscritto al bootstrap ledger deve escludere esplicitamente qualsiasi
dichiarazione di **GDPR erasure completo**; il recovery rimane NO-GO.

### Catalogo reale del ledger: cosa è già verificato

Le SELECT di soli cataloghi su Supabase PROD hanno attestato per
`public.privacy_erasure_ledger`: relazione esistente, **RLS attiva**,
proprietario `postgres`, **zero policy**, nessun grant `PUBLIC` su
tabella/colonne, nessun DML per i ruoli API `anon`,
`authenticated` e `service_role`, 5 colonne essenziali, 1 PK e
l'indice `idx_privacy_erasure_ledger_subject_time`. **Non sostenere che
il registro sia attualmente esposto.** Non è ancora stata accertata
l'identità SQL con cui Render scrive, poiché lo SQL Editor/connector
Supabase usa un'altra sessione e non sostituisce il pool runtime.

Stato al controllo: `main=e98153f`; backend produttivo LIVE
sull'ultimo commit applicativo `35586fb` (i commit successivi
hanno modificato solo la CI GitHub). La PR #366 è DRAFT, il branch
diverge da `main` e mostra 8 file di diff, compresi due file Sondaggi
già allineati come blob al contenuto attuale di `main`. **Revisionare
sempre il diff finale e le CI prima di qualsiasi merge con deploy
automatico**.

## Perché separarla dalla catena Draft

Il confronto GitHub `main...06fb2e0c` (#365) registra **468 commit / 237 file** di differenza rispetto a `main`. Render backend live utilizza ancora `main` commit `77cfd862`; i deploy automatici sono attivati. Non è prudente integrare tutta la catena per risolvere un singolo rischio.

Questa PR **nasce direttamente da `main`** e modifica soltanto il servizio principale del ledger, una fixture test, e due file nuovi (workflow PG17 e test; più questa nota). Non introduce worker, API, flag, migrazione Supabase, B2 o dipendenze dal resto dei 468 commit.

## Problema e modifica

La `PrivacyErasureLedgerService.recordEvent` già in produzione richiama `ensureTable` durante una normale cancellazione/revoca. Se il database fosse appena ricreato senza ledger, il servizio potrebbe creare `public.privacy_erasure_ledger` **privo di RLS** mentre sta elaborando una richiesta. In produzione attuale la tabella esiste ed è RLS-protected, ma il ripristino costituisce una casistica distinta.

- `recordEvent` **non esegue più DDL**: su schema non preparato fallisce `42P01` e non crea nessuna tabella. Richiede un `privacy_erasure_ledger` preinstallato con privilegi SQL corretti.
- `ensureTable`, da chiamare **solo intenzionalmente in una manutenzione autorizzata**, emette in **un'unica query PostgreSQL** `CREATE TABLE IF NOT EXISTS public.privacy_erasure_ledger`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `REVOKE ALL FROM PUBLIC` e revoche condizionali per ruoli esistenti `anon`, `authenticated`, `service_role`, prima del commit. Indicizzazione separata in seguito.
- Anche gli helper offline `captureCurrent`, `mergeCaptured`, `applyCurrentPrivacyState` ora richiedono un ledger **già installato, con RLS e grant verificati** tramite `assertProtectedLedger`: se il registro manca o è insicuro, falliscono senza creare una cronologia vuota o correggere automaticamente le ACL. Il bootstrap `ensureTable` è un'operazione **separata, intenzionale e autorizzata**, da eseguire prima della raccolta/importazione/replay; questi helper non devono essere esposti via HTTP.
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


## Gate integrità: nessuna cronologia GDPR vuota creata implicitamente (27 ottobre 2026)

Ulteriore scenario di restore: `captureCurrent` e `applyCurrentPrivacyState` potevano chiamare `ensureTable` su un database senza registro. Un recupero erroneo avrebbe quindi prodotto un ledger appena nato e vuoto e nessun replay, facendo passare per assenza legittima di revoche/cancellazioni quella che era una **perdita della cronologia**. Anche `mergeCaptured` creava automaticamente una nuova tabella a fronte di un'importazione che avrebbe dovuto richiedere provisioning esplicito.

Le tre operazioni si arrestano ora con `42P01` quando manca `public.privacy_erasure_ledger`, oppure con `GDPR_LEDGER_SCHEMA_NOT_PROTECTED` se RLS/grant non rispettano la policy. Il test PostgreSQL 17 esegue tutte e tre le chiamate prima del bootstrap e con RLS disattivata, dimostrando l'assenza di creazione e importazione silenziose; verifica poi la sequenza autorizzata `ensureTable` → capture/import/replay con dati esclusivamente sintetici. **Attenzione:** il bootstrap separato non restituisce da solo eventi perduti; ogni ripristino resta NO-GO senza evidenza esterna completa e verificata (B2), controllo di freschezza, quarantena e autorizzazioni DPO/titolare.

## Parità tra revoca live e replay dopo restore — 27 ottobre 2026

**Difetto concreto:** il percorso HTTP già presente su `main` usa `cleanupConsentScopedPoliticalData` per eliminare, nella transazione di revoca, opinioni, voti politici personali, campi opinione legacy e collegamenti a proposte. Il replay `enforcePoliticalRevocation` cancellava invece **solo** `opinioni_risposte`: un backup vecchio poteva far riapparire voti e campi personali dopo un restore anche se il ledger conteneva la revoca.

La correzione isolata riutilizza nel replay lo **stesso helper** già usato dal percorso live, senza importare la catena Draft. Due `UPDATE users` del helper sono stati qualificati `public.users` per impedire che un `search_path` ostile devii la cancellazione su una tabella temporanea. Un nuovo test PG17 sintetico verifica la rimozione di opinioni, voti `voti_ice`, campo opinione legacy e collegamento a proposta, l'azzeramento dei consensi e la conservazione della tabella temporanea ombra.

**Limiti espliciti:** la parità riguarda **il perimetro già implementato su `main`**. Le selezioni personali `political_selections` e `user_representatives` e i campi legacy dei candidati/rappresentanti sono coperti dalla separata PR Draft #295, **non** da questa modifica: la convergenza tra le due PR dovrà essere verificata prima di un futuro rilascio. Il campo di ritorno `opinionsRemoved` conta solo le opinioni, non tutte le righe politiche eliminate. Il test non dimostra una vera quarantena, un writer Render autorizzato, un ledger B2 completo né il corretto deploy. Questa correzione amplia il delta della PR a **6 file**, restando basata direttamente su `main`; nessun merge o deploy.

## Offline recovery requires unfiltered ledger visibility (28 October 2026)

A protected RLS ledger may return a partial or empty history to a
subject-scoped SQL operator. Previously `captureCurrent`, `mergeCaptured`
and `applyCurrentPrivacyState` checked RLS and ACL configuration but not
whether the executing SQL role could see **all** tombstone events. The
result could appear to be a complete export or successful replay.

These offline-only functions now call `assertUnfilteredLedger`, which
checks `pg_catalog.row_security_active` for the exact
`public.privacy_erasure_ledger` relation under the executing SQL role.
If RLS would filter the view, it fails closed with
`GDPR_LEDGER_VISIBILITY_INCOMPLETE`, before reading or modifying rows.
Live `recordEvent` is unchanged, retaining least-privilege RLS support.

A disposable PostgreSQL 17 regression creates two synthetic events and
grants a separate non-owner role a SELECT policy for just one event.
Export, import and replay reject the partially visible role without
mutating records; owner export still sees both events. This never reads
real records or accesses Render, Supabase or B2.

Global SQL visibility is a *necessary*, not sufficient, recovery gate.
It does not prove no events were lost upstream or that a complete,
fresh and independently signed B2 archive exists. Provider quarantine,
writer identity, isolated restore and explicit GO remain open.
The stacked #371–#374 descendants must be realigned/retested before
any integration. Issue #296 remains NO-GO.

## Replay of restored application rows must also be unfiltered

An SQL role can own and fully read the GDPR tombstone ledger while still
being subject to row-level security on **restored user/application tables**.
In that case a DELETE or UPDATE could silently see zero matching rows,
then report a successful replay while leaving sensitive data behind.

The offline `applyCurrentPrivacyState` operation therefore now performs
an additional catalog-only `assertUnfilteredReplayTables` preflight
**before any user-data mutation**. It conservatively rejects when any
restored `public` application table (excluding the separately checked
ledger and delivery-outbox bookkeeping) has RLS active for the current
SQL role, raising `GDPR_REPLAY_DATA_VISIBILITY_INCOMPLETE`.
This intentionally may block recovery even for an unrelated RLS-enabled
table: a controlled offline restore must use a reviewed operator identity
with verified global data visibility, never bypass per-user policies in a
live HTTP process.

The new disposable PG17 test creates an account and its deletion event.
A non-superuser SQL role owns the ledger (so the tombstone is fully
visible), but RLS hides the restored account in `public.users`.
Replay must refuse before the DELETE; the original account remains.
A separate privileged synthetic replay can then delete the row.

These guards do not make a recovery end-to-end safe or attest external
backup completeness. Review all other restored schemas, permissions,
B2 receipts and independent checkpoints before any authorized restore.
NO-GO remains in force.
