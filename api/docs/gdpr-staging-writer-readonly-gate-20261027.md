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
