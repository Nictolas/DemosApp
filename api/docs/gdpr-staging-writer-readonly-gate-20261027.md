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
