# DEMOS — OPS-STG-001 / Migrazione P1 staging unico — 3 novembre 2026

## Intervento riuscito

Per il solo progetto Supabase **Demos-Staging** `fkeayjzvtuvzesljhjbc` è stata applicata la migrazione registrata `ops_stg_001_p1_routes_20261103`, sorgente `api/database/staging/ops_stg_001_p1_routes_20261103.sql` nella PR #565.

Sono state create **nove tabelle vuote** relative a funzionalità esplicitamente referenziate dal backend: `active_sessions`, `ice`, `comunicazioni`, `unita_elettorale`, `candidati`, `political_candidacies`, `political_mandates`, `parlamento`, `votazioni_parlamento`. Le due sequenze PostgreSQL `parlamento_id_seq` e `votazioni_parlamento_id_seq` sono associate alle relative tabelle, senza copiare valori della produzione.

La prima esecuzione si è fermata al vincolo FK `candidati_unita_elettorale_id_fkey` perché la PK della tabella referenziata non era ancora stata aggiunta; il blocco **BEGIN/COMMIT** ha annullato tutto (controllo successivo: 29 tabelle staging e 0 oggetti parziali). È stato corretto l'ordine: prima chiavi primarie e UNIQUE, poi CHECK, infine FK. La seconda esecuzione è **SUCCESS**.

## Verifiche al completamento

- **114 colonne su 114** uguali tra produzione e staging per nome, tipo, nullability, default e lunghezza.
- **29 vincoli su 29** creati, corrispondenti per nome e tipo; sei espressioni CHECK risultano serializzate con cast/parentesi diversi da `pg_get_constraintdef` pur usando gli stessi insiemi di valori ammessi. Non dichiarare identità byte-a-byte di queste sei espressioni.
- **48 indici su 48** con definizioni corrispondenti. Due sequenze correttamente associate via `pg_get_serial_sequence`.
- **9/9 tabelle vuote** (conteggi reali 0 righe), RLS abilitata **9/9**, privilegi diretti `SELECT,INSERT,UPDATE,DELETE` per `anon` e `authenticated` negati **9/9**. Nessuna riga personale importata.
- Supabase `public`: da 29 a **38** tabelle staging; la produzione contiene 115 tabelle, ma 80 nomi di produzione sono ancora assenti nello staging e NON sono necessariamente tutti requisiti applicativi.
- Il preflight statico è stato esteso dalle 9 tabelle minime a **22** (`REQUIRED_TABLES`), e la verifica delle tabelle riservate a **18** (`CIVIC_PRIVATE_TABLES`); mantiene il controllo dell'identità effettiva del database e richiede un GO esplicito prima di qualsiasi connessione. Non considera pronto il runtime applicativo.
- **26/26 test Node locali superati** per bootstrap, preflight e contratti SQL; worktree temporanea Git rimossa dopo i test.
- Il servizio Render `demos-staging` continua il bootstrap fail-closed, `autoDeploy=no` e comando `cd api && node staging/unified_staging_bootstrap.js`; nessuna modifica al backend pubblico, nessun nuovo staging o costo, nessuna risorsa cancellata.

## Lavoro restante e divieti

**Restano 4 gate operativi, di cui il primo sostanzialmente avanzato ma non interamente chiuso:**

1. Audit residuo dei quattro servizi staging con `NODE_ENV=production`, provider e segreti non diretti; evitare credenziali prod.
2. Selezione e schema delle ulteriori tabelle richieste dagli **E2E realmente pianificati**, senza clonazione indiscriminata delle 80 rimanenti.
3. Connessione del servizio condiviso a **Supabase Demos-Staging** con credenziali di privilegi minimi, TLS e prova di identità; nessun FCM/email/cron reale; E2E autenticazione, Opinioni, profilo, iniziative/ECI/referendum e sicurezza.
4. Parità dei test specialistici, piano rollback e dismissione progressiva dei nove vecchi web service; verifica KV e vecchio PostgreSQL Render (backup già archiviato su D:).

Il servizio **NON è ancora GO per i test applicativi** e `/health/ready` deve restare 503 finché non si completano i controlli. La migrazione SQL non deve essere rieseguita: è già nel registro delle migrazioni Supabase staging.
