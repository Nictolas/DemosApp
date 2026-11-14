# DEMOS — OPS-STG-001 / Preflight PostgreSQL a privilegi minimi (3 novembre 2026)

## Stato: codice e verifiche preparati; connessione NON autorizzata, NON attiva

Il backend Render `demos-staging` resta con `autoDeploy=no` e `cd api && node staging/unified_staging_bootstrap.js`. Il bootstrap continua a non usare PostgreSQL o il servizio push; `/health/ready` resta 503. Nessuna infrastruttura permanente nuova, nessun costo, nessuna modifica alla produzione.

### Modifiche in PR #565

- `api/scripts/unifiedStagingPreflight.js` ora richiede **esclusivamente un ruolo PostgreSQL dedicato**, `demos_staging_preflight`, e non accetta più il superutente `postgres` né le credenziali applicative di `demos_staging_runtime`.
- Il segreto futuro deve essere memorizzato **solo** in `STAGING_PREFLIGHT_DATABASE_URL`, separata da `DATABASE_URL` (attualmente vuota nel servizio condiviso). Non inserirlo in GitHub, Google Sheet, file di documentazione, log o chat.
- L'endpoint Supabase deve essere il **solo** progetto `fkeayjzvtuvzesljhjbc`, via collegamento diretto oppure pooler **session mode 5432**; sono respinti transaction pooling 6543, host di produzione, database diversi, opzioni URL non ammesse e identità del DB non corrispondenti.
- Il controllo richiede ancora `NODE_ENV=staging`, `DEMOS_UNIFIED_STAGING_MODE=preflight` e un GO esplicito `DEMOS_UNIFIED_STAGING_PREFLIGHT_GO=APPROVED_READ_ONLY_PREFLIGHT`. Non impostare questo GO in Render prima di aver verificato il ruolo e il collegamento.
- La verifica catalogo usa **pg_catalog** invece di `information_schema`, così può leggere metadata delle tabelle senza concedere `SELECT` sui dati applicativi. Le uniche due letture di righe previste sono `civic_runtime_identity` (solo id=1) e `civic_push_delivery_guard` (solo id=1).
- La connessione è avviata in **`BEGIN READ ONLY`**, con verifica TLS e timeout. Ogni fallimento dell'identità, dello schema, dei privilegi di sicurezza, delle colonne necessarie o del blocco push nega l'esito positivo. Nessun test applicativo viene autorizzato da questo preflight.

### Gate della credenziale dedicata NON ancora superato

Un tentativo di predisposizione automatica del ruolo e della credenziale è stato **bloccato dai controlli di sicurezza dello strumento**. Non è stato aggirato.

Verifica successiva read-only: `demos_staging_preflight` **assente** nei ruoli del database. Non è stata salvata alcuna `STAGING_PREFLIGHT_DATABASE_URL` valida su Render. Il ruolo già esistente `demos_staging_runtime` possiede privilegi applicativi di lettura/scrittura, perciò **non deve essere riutilizzato** per il preflight.

Provisioning operativo ancora da autorizzare: creare una credenziale forte nel sistema segreti autorizzato, creare ruolo con `NOINHERIT`, `NOBYPASSRLS`, nessun privilegio DDL, login limitato e default transaction read only, concedere solamente `USAGE` di `public`, `SELECT` sulle due tabelle identificative e policy RLS `id=1`, poi configurare segretamente la connessione alla pooler session mode reale del progetto staging. Verificare **dal contesto runtime** il rifiuto di scritture, l'identità DB e lo stato blocked. Evitare password in testo nel repository e nelle risposte dei tool.

### Evidenza remota ottenuta senza credenziali nuove

Query read-only eseguite tramite connettore Supabase già autorizzato:

- **22/22** tabelle richieste presenti in `public`.
- **18/18** tabelle riservate protette con RLS attiva e accesso diretto anon/authenticated negato.
- **18/18** colonne critiche coerenti con le specifiche del preflight.
- `civic_push_delivery_guard` con `blocked=true` e identità esatta di `Demos-Staging`.
- **27/27 test Node offline PASS** per bootstrap, preflight e contratto SQL; worktree temporanea eliminata.
- PostgreSQL `demos_staging_preflight` **non ancora creato**. Queste evidenze MCP **non sostituiscono** una connessione reale dal servizio Render.

### Quanto manca

Quattro gate rimasti: (1) completare l'audit delle credenziali/servizi legacy e il provisioning del ruolo/collegamento di sola lettura; (2) integrare soltanto lo schema ancora indispensabile agli E2E, senza clonare i dati della produzione; (3) attivare con gate separato una connessione applicativa esclusiva a Supabase staging e passare E2E multiutente in modalità safe/dry-run; (4) provare compatibilità, rollback e poi smantellare gradualmente i nove vecchi staging e le risorse ridondanti. Nessuna dismissione o GO anticipato.

Valutazione del progresso di questo intervento: **5/10** (miglioramento tangibile alla sicurezza del codice e verifiche remote, ma il collegamento runtime resta bloccato).


## Ulteriore hardening preflight — controlli per-colonna e sequenze (03/11/2026)

Il preflight **non si limita più** a `has_table_privilege` sulle tabelle:
verifica anche `has_any_column_privilege` per INSERT/UPDATE/REFERENCES e
`has_sequence_privilege` per USAGE/UPDATE sulle sequenze `public`. Sono controlli
di **metadati** che impediscono di scambiare una credenziale con permessi
per-colonna per una credenziale read-only. Lo stesso controllo per-colonna
è stato aggiunto alle protezioni anti-accesso diretto per `anon` e
`authenticated`: basta un permesso a una colonna per rifiutare il GO.

I test Node controllano che le funzioni PostgreSQL siano presenti nelle query
reali del preflight. Una prova PostgreSQL 16 effimera concede UPDATE su una
singola colonna e USAGE su una sequenza a un ruolo CI, verifica che il
controllo di tabella da solo non li rilevi, e che i controlli estesi li
identifichino; conferma anche il caso `anon` su una singola colonna.
I ruoli/oggetti temporanei vengono eliminati dal runner. Nessun ruolo o
permesso viene creato nello staging Supabase, nessun test E2E applicativo
è autorizzato e il GO rimane bloccato fino al provisioning approvato della
credenziale `demos_staging_preflight`.


## Preflight: sequenze public e grant anon/authenticated (03/11/2026)

Audit read-only di Demos-Staging: 51/51 tabelle public con RLS, 0 concessioni
dirette ai client su tabelle e colonne; **una sequenza su sei**, denominata
`public.user_auth_providers_id_seq`, conserva invece `SELECT/USAGE/UPDATE`
concessi direttamente a `anon` e `authenticated`. Le sequenze hanno permessi
separati dalla RLS della tabella. L'audit non dimostra che la sequenza sia
raggiungibile tramite Data API o sfruttata in pratica.

Il preflight controlla ora **tutte le sequenze public** e rifiuta il GO con
qualsiasi `SELECT/USAGE/UPDATE` concesso ad `anon` o `authenticated`.
La correzione DCL mirata è versionata in
`api/database/staging/ops_stg_001_revoke_public_auth_provider_sequence_20261103.sql`:
richiede approvazione esplicita di sessione, hash esatto dell'identità staging,
push bloccati, due utenti esclusivamente sintetici, tabella con RLS e permessi
pubblici non concessi. Revoca soltanto `PUBLIC`, `anon` e `authenticated`
sulla singola sequenza, senza cambiare i grant a `postgres` o `service_role`.
Un controllo successivo conferma la revoca; una seconda applicazione è rifiutata.

Il test PostgreSQL16 su runner usa il vero SQL con identità fittizia:
nega approvazione assente, nega database errato, revoca i grant
deliberatamente aperti, verifica assenza di permessi e blocca una seconda
esecuzione. Nessun test applicativo e nessuna apertura del runtime
`demos-staging`; PR #565 resta Draft e lo staging applicativo NO-GO.


## Provisioning sicuro del ruolo preflight: script approvabile, non applicato (03/11/2026)

Verificato su **Supabase Demos-Staging** (read-only): il ruolo
`demos_staging_preflight` non esiste; `civic_runtime_identity` e
`civic_push_delivery_guard` hanno RLS attiva e policy esistenti per
`demos_staging_runtime`, che devono rimanere inalterate. La versione
database staging è PostgreSQL 17; la CI copre PostgreSQL 16 e 17.

Nuovo script **preparatorio**, versionato in
`api/database/staging/ops_stg_001_preflight_role_disabled_20261103.sql`,
che richiede una separata attestazione di sessione
`civic.preflight_role_approval='I_APPROVE_DISABLED_PREFLIGHT_ROLE'`,
hash esatto del DB staging, guardia invii `blocked=true`, esattamente
due utenti test sintetici, RLS sulle due tabelle di controllo, nessun grant
diretto ai client `anon/authenticated` e nessuna collisione con policy/ruoli.
Qualunque violazione interrompe la transazione prima di creare il ruolo.

La creazione proposta è **LOGIN con PASSWORD NULL**: il ruolo rimane
**senza credenziale operativa**, non è un login da abilitare su Render.
Attributi: `NOINHERIT`, niente superuser/BYPASSRLS/CREATEDB/CREATEROLE
o REPLICATION, limite di una connessione, default read-only e timeout di
cinque secondi. Privilegi limitati a `USAGE` dello schema e a **sole
colonne** `id,db_identity` e `id,blocked` delle due tabelle, con policy
RLS che consentono solo `id=1`. Le policy del ruolo applicativo sono
conservate. I test su database PostgreSQL effimero verificano rifiuto
senza approvazione, rifiuto del DB errato e guard push disattivata,
assenza password, impossibilità di leggere `users` o aggiornare
`civic_push_delivery_guard`, lettura ammessa dei soli campi autorizzati,
non ripetibilità e nessuna modifica agli utenti sintetici.

**Nessuna esecuzione su Supabase-Staging né produzione.** Manca ancora
l'autorizzazione di provisioning sul servizio condiviso, la generazione
e registrazione di una password tramite un **gestore di segreti autorizzato**
(senza copiarla in GitHub, Sheets, log o chat), la configurazione protetta
di `STAGING_PREFLIGHT_DATABASE_URL` e il GO separato per una connessione
remota read-only. Anche con un ruolo creato, l'app condivisa rimane
bootstrap/NO-GO. Lo script non equivale al collaudo Render→Supabase e non
chiude alcun macro-gate di rilascio.


## Preflight PostgreSQL reale con ruolo minimo (CI PG16/PG17)

Il CI collauda anche le query **effettivamente presenti** in
`api/scripts/unifiedStagingPreflight.js`, anziché simularne i risultati.
Sullo stesso PostgreSQL CI effimero che prepara le migrazioni P1–P5,
lo script di provisioning del ruolo viene applicato **esclusivamente a
una copia in memoria adattata a `civic_ci` e UUID sintetica**.
La versione nel repository conserva i blocchi sul nome DB `postgres` e
sull'identità Demos-Staging; la connessione CI è locale, senza password
per il ruolo preflight e senza credenziali Render/Supabase.

Il test Node `api/tests/unifiedStagingPreflight.postgres.test.js` usa
`BEGIN READ ONLY`, `SET LOCAL ROLE demos_staging_preflight`,
esegue le query SQL estratte dal vero preflight (identità, attributi
ruolo e membership, grant su tutte le tabelle/colonne/sequenze, schema,
metadata di RLS, contratti colonne e guardia push) e verifica le
valutazioni reali. Dimostra il rifiuto di `SELECT public.users` e
dell'aggiornamento della guardia push. Dopo rollback, due utenti
sintetici, zero voti e push bloccate.

Il risultato di preparazione schema CI è intenzionalmente
`ready=false` perché il database sintetico **non replica le 51 tabelle**
dello staging: non si finge un GO. Questo NON testa TLS, DNS/pooler,
connessioni da Render, password/gestore di segreti o staging reale.
Il ruolo condiviso resta **non creato**, senza GO.


## Superficie API trascurata: viste e funzioni RPC (`public`)

L'audit di sola lettura di **Demos-Staging** del 03/11/2026 conferma:
**51 tabelle public**, **0 viste/materialized views/foreign tables public**
e **0 routine nello schema public**. Non è stata rilevata un'esposizione
effettiva attraverso questi oggetti.

Il preflight controllava in precedenza tabelle ordinarie e sequenze,
ma una vista PostgreSQL può bypassare la RLS della tabella sottostante,
mentre le nuove funzioni PostgreSQL ricevono normalmente `EXECUTE`
da `PUBLIC` e possono diventare RPC in PostgREST. Per evitare
regressioni future, è stato aggiunto un audit **solo sui metadati**
per tutte le viste, viste materializzate e foreign table dello schema
`public`, comprese autorizzazioni per-colonna, e per tutte le routine
`public`. Qualunque accesso per `anon` o `authenticated` blocca
il risultato `ready`; assenza o dati catalogo malformati falliscono chiusi.
Non viene invocata alcuna funzione né letta alcuna vista.

Prove negative su PostgreSQL 16 e 17 CI: creare una vista fittizia e
concederne `SELECT` ad `anon` causa NO-GO; creare una funzione SQL
fittizia con `EXECUTE` implicito a `PUBLIC` causa NO-GO; le revoche
rimuovono l'allarme. Tutto avviene nella transazione CI e viene
annullato con `ROLLBACK`; nessun oggetto è creato su Supabase live.
Il ruolo preflight sullo staging reale resta assente.
