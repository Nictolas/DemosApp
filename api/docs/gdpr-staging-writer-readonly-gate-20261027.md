# DEMOS — prerequisiti del gate GDPR writer (27 ottobre 2026)

**Stato: NO-GO.** Nota operativa della PR #371, basata su PR #366.
Nessuna modifica a Render, Supabase, dati utente, credenziali o recovery.
Questa nota non approva un merge o un deploy.

## Evidenza provata (metadati soltanto)

- Workspace Render **Nicolas**, ID `tea-d2gs3eadbo4c73ag95rg`, già confermato dall'operatore.
- Produzione: `demos-backend`, servizio `srv-d2gt3dodl3ps73fmereg`, branch `main`, `rootDir=api`, `autoDeploy=yes`. Nessun test dell'identità SQL del suo pool.
- `demos-functional-staging`, servizio `srv-db52l1g473hc739ld250`, branch `staging/functional-integration-v0`, `autoDeploy=no`, avvio `cd api && node index.js`. Non è attestato il suo collegamento a Supabase Demos-Staging; pertanto non usarlo per prove GDPR finché la destinazione non è verificata.
- Supabase **Demos-Staging** project ref `fkeayjzvtuvzesljhjbc`: query **esclusivamente pg_catalog** il 27/10/2026, nessuna delle seguenti sei relazioni in `public`: `privacy_erasure_ledger`, `users`, `user_consents`, `opinioni_risposte`, `political_selections`, `user_representatives`. **Non è un clone validato, non è pronto per test di revoca/account deletion/recovery**. Il solo esito dei cataloghi non dimostra che altre tabelle non esistano; non sono state lette righe personali.
- La PR #366 verifica su PostgreSQL 17 *sintetico* che un ruolo `NOBYPASSRLS` non proprietario, pur con `GRANT INSERT`, non possa scrivere il ledger RLS con zero policy. Questo non identifica il ruolo runtime usato da Render.

## Strumento di sola lettura incluso nella #371

`api/scripts/attest-gdpr-writer-readonly.js` legge **solo** `current_user`, `session_user`, `current_setting('role', true)`, `current_database()` e cataloghi `pg_class` / `pg_roles` / `has_table_privilege` attraverso il medesimo modulo `api/config/database.js` impiegato dal backend. Non legge eventi GDPR o utenti e non invia DML/DDL.

Il controllo **rifiuta a monte** qualunque `DATABASE_URL` che non punti esattamente alla destinazione Supabase Demos-Staging attraverso l'hostname diretto o un username Supavisor suffissato col project ref, e richiede la variabile esplicita `GDPR_WRITER_ATTESTATION=demos-staging-readonly-20261027`. Non mostra mai il database URL, password, host o altri segreti. Il test di sicurezza su CI è in `api/tests/gdprWriterReadonlyAttestation.test.js`.

**Esecuzione futura, non compiuta e non autorizzata da questo documento:** soltanto dopo isolamento della risorsa Render *e verificata in anticipo la destinazione del database*, eseguire in un processo staging che possieda già le sue normali variabili riservate:

```sh
GDPR_WRITER_ATTESTATION=demos-staging-readonly-20261027 node api/scripts/attest-gdpr-writer-readonly.js
```

Non passare mai credenziali SQL come parametri di comando, non pubblicare l'output su endpoint HTTP né committare valori d'ambiente. Questo processo usa lo stesso **modulo/configurazione** del pool Render, ma apre una propria connessione: il rapporto `live_render_pool_verified=false` resta intenzionalmente **false**. La prova dell'identità *dentro il processo backend attivo* richiederà un controllo indipendente e privato, mai un endpoint pubblico.

Se il registro è assente, `NO_GO_MISSING_LEDGER`. In presenza di registro, il rapporto `READONLY_IDENTITY_ONLY_NOT_RELEASE_GO` **non** equivale a prova di `recordEvent` funzionante: grant statici + RLS non certificano le policy, né il percorso transazionale e il rollback, né integrità/outbox/B2.

## Gate ancora richiesti prima del rilascio

1. Collegamento certificato dello staging Render al DB **effettivamente isolato** da quello produzione; attestazione della configurazione senza esposizione di segreti.
2. Provisioning separato e autorizzato **solo in staging** dello schema sintetico necessario (nessuna copia PII) e installazione intenzionale del ledger protetto da ruolo owner adeguato; checklist rollback.
3. Prova runtime del ruolo SQL con il pool del processo effettivo, poi cancellazione/revoca con utenti *inventati* e `ROLLBACK` in staging isolato. Non concedere `BYPASSRLS`, policy permissive o GRANT in produzione per aggirare gli errori.
4. Recovery end-to-end #296 con quarantena fail-closed, ledger esterno completo e fresh, verifica ordine degli eventi, attestazione senza dati personali e approvazione titolare/DPO.
5. Revisione DPIA e piano di deploy/rollback con `autoDeploy=yes`. **Nessun merge/deploy prima del GO dedicato.**

**Conclusione:** la sola certificazione del codice e di CI sintetica non autorizza il recovery di produzione.

## Nuova prova del pool reale, ma esclusivamente su CI sintetica (27 ottobre 2026)

La PR #371 aggiunge `api/scripts/verify-gdpr-writer-pool-ci.js`. Il workflow GitHub usa **PostgreSQL 17 temporaneo su 127.0.0.1**, già inizializzato dal test di cancellazione, crea un ruolo SQL `LOGIN NOBYPASSRLS` distinto dal proprietario del ledger, e lo connette **tramite `api/config/database.js` e `getPool()` identici al backend** (nessuna stringa di connessione di Render/Supabase è letta o richiesta). La guardia iniziale richiede esplicitamente runner GitHub Actions, marker, database, hostname, username e password tutti **sintetici e locali**, ed esclude variabili Render/Supabase e un `DATABASE_URL` ereditato.

Il test prova:
- `recordEvent` fallisce `42501` senza policy RLS, nonostante `GRANT INSERT/SELECT`;
- `ROLLBACK` non aggiunge eventi;
- policy sintetiche limitate a **un solo identificativo inventato** permettono una transazione `ROLLBACK` e una `COMMIT`, distinguibili;
- l'inserimento su un **altro** identificativo inventato è rifiutato ancora da RLS.
- L'esito riporta `realRenderWriterAttested=false` per evitare equivalenze improprie con il ruolo effettivo Render.

Questa prova è più vicina al comportamento runtime del codice rispetto alle simulazioni che creano direttamente un `new Pool()`, ma **non sostituisce l'isolamento e la verifica del servizio Render di staging**.

## Discovery delle risorse staging esistenti (sola lettura)

Render ha `demos-civic-staging-db` (ID `dpg-db4id8id0e5s73cfb0cg-a`), **PostgreSQL 17**, piano **free**, region `frankfurt`, in stato disponibile. La risorsa indica una **scadenza 8 novembre 2026**: non va usata come ledger GDPR persistente senza verificare il ciclo di vita della risorsa. L'IP allowlist è vuota; il tool di query esterno ha rifiutato la connessione. **Non è stato modificato l'allowlist**, né sono state lette o modificate tabelle Render. La semplice esistenza di questo DB non prova che `demos-functional-staging` lo utilizzi o che contenga solo dati fittizi.

Il catalogo Supabase `Demos-Staging` include già **altri schemi e tabelle**, tra cui `demos_private` (1 tabella) e `op37_sondaggi_ci` (4 tabelle). L'assenza delle 6 tabelle core GDPR in `public` **non** significa che l'intero progetto sia vuoto o che sia liberamente azzerabile. Nessuno schema di staging esistente può essere eliminato o sovrascritto senza una separata analisi d'impatto.


## Cancellazione account senza dipendere dai vincoli FK (27 ottobre 2026)

La query di sola lettura su **pg_catalog**, Supabase progetto **Demos** di produzione, ha verificato che `public.user_representatives.user_id`, `public.user_consents.user_id` e `public.political_selections.user_id`/ `selected_user_id` hanno ciascuno un vincolo `REFERENCES users(id) ON DELETE CASCADE`. Non sono state lette righe personali o modificate tabelle. **La produzione già beneficia dunque del cascading**, non è corretto sostenere che gli account cancellati abbiano automaticamente lasciato righe residue.

Per evitare di dipendere **soltanto** dal fatto che una copia o uno schema ricostruito preservi i vincoli, il percorso `PrivacyErasureLedgerService.cleanupAdditionalAccountData` della #371 cancella ora esplicitamente per proprietario anche `user_representatives` e `user_consents`, oltre alle cancellazioni già previste di `political_selections`. Questo si applica sia alla cancellazione ordinaria tramite gli helper già usati sia al replay di un evento `account_deleted`; lo scopo è la difesa in profondità, non una prova di residui reali.

La fixture di `api/scripts/verify-political-selection-erasure-ci.js` prepara intenzionalmente le quattro relazioni **senza alcuna foreign key** su PostgreSQL 17 effimero. Verifica l'eliminazione di `users`, `user_consents`, `user_representatives`, `political_selections` per l'account bersaglio, il rollback che conserva tutte le righe, il commit che le elimina e la preservazione di un altro account.

**Quattro workflow passati** sul commit applicativo `526826d`:
- [Political selection synthetic, PG17 #40561071712](https://github.com/Nictolas/DemosApp/actions/runs/40561071712)
- [GDPR ledger secure bootstrap #40561071556](https://github.com/Nictolas/DemosApp/actions/runs/40561071556)
- [Privacy erasure regression #40561071568](https://github.com/Nictolas/DemosApp/actions/runs/40561071568)
- [Civic identity regression #40561071716](https://github.com/Nictolas/DemosApp/actions/runs/40561071716)

**Limite:** la simulazione senza vincoli non verifica tutti i casi di uno snapshot malformato. In produzione restano non attestati il ruolo SQL runtime Render e il recovery esterno B2. Le quattro CI non autorizzano merge o deploy.

## Distinzione fondamentale: archivio Axiom/B2 e ledger di erasure (27 ottobre 2026)

**NO-GO finché non provato con evidenza esterna:** il documento `docs/operations/axiom-b2-log-archive.md` descrive e prova una pipeline Axiom → B2 per i **log** (dataset `centralized_logs` e `real-time`). La presenza di checkpoint/manifest/hash per quei log **non attesta** che i record del registro PostgreSQL `public.privacy_erasure_ledger` siano copiati, verificati e recuperabili indipendentemente dal database principale. Il codice `api/services/backupService.js` marca come ritirato il vecchio backup JSON applicativo, inadatto al disaster recovery. Non presentare il test `archive:axiom:verify-latest` come una prova di un *GDPR tombstone archive*.

**Evidenza necessaria prima di qualunque restore reale:** (a) origine indipendente, privata, con scope e permessi minimi, (b) manifest della cronologia `account_deleted` / `political_consent_revoked` / `political_consent_granted` con conteggio e hash verificati, (c) finestra temporale e ultimo evento/durata massima consentita di ritardo, (d) capacità di recupero verificata **in quarantena** su database isolato e ruoli autorizzati, (e) garanzia di fermare gli scrittori e importare/re-applicare la cronologia prima di servire utenti, (f) verifica fail-closed per copie incomplete, eventi duplicati con contenuti diversi e conflitti temporali, (g) validazione giuridica/privacy dell'eventuale retention indipendente dal backup dei log.

**Questa PR non crea un archivio aggiuntivo** né copia eventi personali in B2: fino a approvazione DPIA/operatore, creare copie esterne sensibili sarebbe una nuova attività di trattamento. Le suite PostgreSQL 17 sintetiche testano gli algoritmi del ledger, **non** la continuità o la freschezza dell'archiviazione fuori dal database.

### Read-only identity probe anche senza schema ledger

La sonda `api/scripts/attest-gdpr-writer-readonly.js` esegue ora una `SELECT` con singleton + `LEFT JOIN` a `pg_catalog`. In un database Supabase Demos-Staging ancora privo di `privacy_erasure_ledger`, restituisce **l'identità SQL della sessione** e `NO_GO_MISSING_LEDGER`, senza DDL, dati personali o falsa attestazione del ledger. La politica di destinazione non è cambiata: **solo** lo specifico progetto Supabase Demos-Staging e solo con marker di esecuzione esplicita; il report mantiene `live_render_pool_verified=false`.

La CI esegue tale SQL anche attraverso il modulo `api/config/database.js` contro PostgreSQL 17 usa-e-getta, verificando presenza e assenza artificiale della relazione. **Non equivale ancora** a esecuzione sul processo Render esistente. Nessun servizio o variabile di ambiente Render è stato modificato.

## Nuovo gate offline: evidenza del ledger firmata e ancorata (27 ottobre 2026)

`api/services/gdprExternalEvidenceVerifier.js` è un **modulo offline** introdotto nella PR #371. Non importa eventi nel database, non esegue DDL/DML, non apre connessioni a B2/Axiom/Supabase/Render, non crea una schedulazione e **non effettua copie di dati reali**. Il file contiene due funzioni pure per preparare e verificare un contenitore crittografico *solo se* un operatore, separatamente e con autorizzazione privacy, gli fornirà una copia legittima della cronologia.

Un involucro comprende `events` (contiene gli identificativi, pertanto **è esso stesso materiale personale sensibile**), `manifest` (sorgente, timestamp, contatore, hash SHA-256 canonico e firma della precedente evidenza se presente) e una firma HMAC-SHA256. `verifyOffline` richiede **una chiave segreta esterna di almeno 32 byte e una firma attesa ottenuta attraverso un canale indipendente**; non accetta semplicemente la firma autoindicata nell'archivio senza tale parametro. Confronta entrambe a tempo costante. Il verificatore controlla il conteggio e l'hash degli eventi, ordinamento, duplicati, conflitti di consenso a timestamp uguale, identità logica della sorgente, data futura e soglia di freschezza. L'esito pubblico riporta solo conteggio, timestamp e digest, **mai righe/identificativi**.

**Casi di test sintetici** in `api/tests/gdprExternalEvidenceVerifier.test.js`: evento cancellato o modificato, conteggio alterato, firma o chiave errata, ritaglio dell'archivio firmato nuovamente ma diverso dal riferimento attendibile, sorgente diversa, vecchia data, timestamp impossibile, duplicati, ordine invalido, conflitto grant/revoke, oggetti JSON anomali e perfino un archivio vuoto formalmente firmato. Lo script `api/scripts/verify-political-selection-erasure-ci.js` usa inoltre `Ledger.captureCurrent` sul **vero PG17 effimero di CI**, firma soltanto tali eventi inventati, verifica il riferimento esterno sintetico e dimostra che la rimozione di un evento fa fallire il controllo.

**Limite determinante:** una firma HMAC autentica prova l'integrità **soltanto del materiale effettivamente firmato**. **Non può dimostrare che il processo originario abbia catturato ogni evento, che la sorgente non abbia perso aggiornamenti o che l'archivio sia realmente indipendente dal database.** Un aggressore/errore che omette eventi *prima* della firma non viene scoperto da una nuova firma arbitraria. Neppure il timestamp nel manifest dimostra l'ultimo evento reale; serve un checkpoint indipendente con una continuità attestata e un limite RPO esplicito. Una firma HMAC **non cifra**: qualunque conservazione reale richiede anche cifratura, controllo accessi, retention approvata, segregazione dei ruoli e piano DPO.

Il risultato ritorna **sempre** `INTEGRITY_ONLY_NOT_RECOVERY_GO`, `externalLedgerCompletenessAttested=false` e `recoveryApproved=false`, anche con HMAC e pin validi. Il modulo non è collegato ad alcuna API, job o backup di produzione. La suite usa solo dati inventati e una chiave sintetica.

**NO-GO immutato** fino a una fonte esterna realmente verificata, prova di continuità/freschezza, ripristino quarantinato, attestazione vera del writer Render e approvazione titolare/DPO.

## Ricognizione provider live in sola lettura — 27 ottobre 2026

**Fonti interrogate:** Render `list_services`, `get_service`, `list_postgres_instances`, `list_deploys`, `list_logs` filtrato per parole relative al database; Supabase `list_projects` e `execute_sql` esclusivamente `SELECT` da `pg_catalog`. Nessuna credenziale letta/stampata, riga personale interrogata o risorsa modificata.

### Render: inventario e scelta responsabile dello staging

L'ambiente Render contiene **11 servizi totali**, di cui **9 denominati staging** e i due servizi di produzione `demos-backend` e `demos-frontend`, entrambi su `main` con `autoDeploy=yes`. Gli staging hanno `autoDeploy=no` e scopi distinti:

| Servizio | Natura attestata dal solo comando di avvio | Uso per prove GDPR su dati |
| --- | --- | --- |
| `demos-functional-staging` (`srv-db52l1g473hc739ld250`) | Backend completo `cd api && node index.js`, branch `staging/functional-integration-v0`, ultimo deploy live consultato commit `645d72d` del 15 ottobre | **NON UTILIZZARE** fino a identificazione esatta della connessione PostgreSQL; potrebbe non essere isolato |
| `demos-security-staging` | Stack specifico di test sicurezza | Da valutare; non è confermato come clone del backend con DB GDPR |
| `demos-security-gates-staging` | Test + endpoint di sola prova, status `executable:false` nel comando di start | Non sostituisce un vero backend + PostgreSQL |
| `demos-action-runner-sandbox-staging` | Suite test + endpoint sintetico `externalClientsAllowed:false` dichiarato nel comando | Non sostituisce un vero backend + PostgreSQL |
| `demos-first-four-playbooks-staging` | Suite test + endpoint sintetico P01–P04 | Non sostituisce un vero backend + PostgreSQL |
| `demos-p07-rollback-dryrun-staging` | Suite test + endpoint sintetico non eseguibile | Non sostituisce un vero backend + PostgreSQL |
| `demos-outbox-readonly-staging` | Health-check read-only outbox | Non prova l'isolamento della connessione di `demos-functional-staging` |
| `demos-b2-readonly-restore-staging` | Health-check archivio **log Axiom** B2 | Non prova il backup del ledger GDPR |
| `demos-sondaggi-op37-http-staging` | Sonda HTTP per sondaggi OP37 | Non è un ambiente GDPR |

Questa classificazione descrive **l'intento del comando di avvio**, non una certificazione crittografica dell'isolamento runtime di ogni servizio. **Non creare nuovi staging o eliminare quelli attuali** fino a verificare uso effettivo, dipendenze e possibili test ancora in corso. L'eventuale consolidamento richiede un inventario delle dipendenze e una conferma separata.

L'unico PostgreSQL attualmente elencato direttamente in Render è `demos-civic-staging-db` (`dpg-db4id8id0e5s73cfb0cg-a`), Postgres 17, piano free, accesso esterno bloccato dall'allowlist IP vuota, scadenza riportata **8 novembre 2026**. Nessun tool con accesso in lettura alla configurazione completa delle variabili dei web service è disponibile nel connettore Render; `get_service` **non espone alcun legame verificabile** fra `demos-functional-staging` e questa istanza. Le query ai log di staging filtrate per `database` e `Supabase` non hanno fornito prova del collegamento. **NON inferire il database dal nome del servizio**.

### Supabase Demos-Staging: prova reale del solo catalogo

Il progetto dedicato `Demos-Staging` (`fkeayjzvtuvzesljhjbc`) è **ACTIVE_HEALTHY**, PostgreSQL 17. Nel suo schema `public` non esistono le sei tabelle GDPR core, incluso `privacy_erasure_ledger`. I cataloghi confermano però la presenza di altre tabelle non-core negli schemi `demos_private` (1) e `op37_sondaggi_ci` (4); **non pulire né sovrascrivere** questi schemi.

Il 27/10/2026 è stata inviata alla connessione SQL amministrativa Supabase la **SELECT identica** alla `SQL` di `api/scripts/attest-gdpr-writer-readonly.js`. La query ha funzionato davvero su PostgreSQL di staging e ha restituito una sola riga con: `current_user=postgres`, `session_user=postgres`, `current_database=postgres`, `rolbypassrls=true`, `ledger_present=false`. **Questo è il ruolo del connettore Supabase**, privilegiato per l'amministrazione: **NON** è una prova che Render usi `postgres`, che il ledger sia idoneo o che la connessione effettiva del backend sia stata testata. La sonda rimane `NO_GO_MISSING_LEDGER`.

### Passaggio operativo minimo necessario

1. Certificare per ispezione **senza condividere il valore di `DATABASE_URL`** il solo riferimento del progetto/hostname e dell'utente DB usati da `demos-functional-staging` in Render, includendo eventuali environment groups; confrontare con il riferimento staging, **mai con la produzione**. Se il target è incerto o punta a produzione, fermarsi.
2. Decidere quale database di staging utilizzare **senza sovrascrivere le 5 tabelle già presenti in Supabase**, senza dipendere dal database Render free in scadenza. Preparare unicamente fixture sintetiche e lo schema necessario dopo review della migrazione.
3. Da un processo Render di staging esplicitamente attestato, eseguire la sonda SQL read-only sul target approvato, senza registrare credenziali o dati personali; verificare una **identità writer non privilegiata** e la configurazione del ledger. Un `postgres` amministrativo con `rolbypassrls=true` non è una soluzione per aggirare le policy.
4. Solo dopo eseguire una revoca+rollback sintetica sul database di staging segregato. Prima di qualunque recovery reale rimangono il ledger esterno indipendente e fresco, quarantena completa e approvazione GDPR/DPO.

**Decisione odierna: NO-GO invariato, motivato da un blocco di attestazione della connessione runtime.** Nessuna modifica a database, IAM, hosting, rete, trigger di deploy o archivi.
