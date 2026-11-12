# DEMOS — audit e correzione della sicurezza Supabase, 19 ottobre 2026

## Stato verificato sulla produzione

Progetto Supabase `Demos` (`wxnblcqoyjqxktwkcqok`, PostgreSQL 17, `eu-central-1`).

**La correzione della superficie di accesso delle tabelle e delle 29 funzioni PL/pgSQL è applicata in produzione.**
Questo documento distingue le modifiche verificate dai controlli che restano da completare.

| Controllo | Prima | Dopo |
| --- | --- | --- |
| Tabelle `public` senza RLS | 100 su 111 | **0 su 111** |
| Tabelle `public` con RLS | 11 su 111 | **111 su 111** |
| Tabelle leggibili da `anon` | 0 | **0** |
| Tabelle leggibili da `authenticated` | 0 | **0** |
| Privilegio `CREATE` sullo schema `public` per `anon`/`authenticated` tramite `PUBLIC` | Sì | **No** |
| Privilegio `CREATE` su `public` per il proprietario `postgres` | Sì | **Sì** |

**Nota interpretativa:** il precedente avviso «100 tabelle senza RLS» non dimostrava da solo un'esposizione della Data API. Una verifica diretta di `has_table_privilege` ha dimostrato che già prima delle modifiche tutte le 111 tabelle erano senza privilegi `SELECT/INSERT/UPDATE/DELETE` per `anon` e `authenticated`. La modifica RLS aggiunge difesa in profondità nel caso di futuri `GRANT` accidentali, ma non sostituisce un audit completo.

### Modifiche eseguite con migrazioni Supabase

Le migrazioni sono presenti nella cronologia del database:

1. `20261019094315 demos_revoke_public_schema_create_20261019`: `REVOKE CREATE ON SCHEMA public FROM PUBLIC`; `USAGE` non modificato.
2. `20261019094500 demos_sensitive_tables_rls_phase1_20261019`: RLS su `users`, `user_profile`, `user_consents`, `opinioni_risposte`, `identity_verifications`, `user_rights_requests`.
3. `20261019094610 demos_rls_no_public_grants_batch_01_20261019`.
4. `20261019094645 demos_rls_no_public_grants_batch_02_20261019`.
5. `20261019094646 demos_rls_no_public_grants_batch_03_20261019`.
6. `20261019094649 demos_rls_no_public_grants_batch_04_20261019`.
7. `20261019094651 demos_rls_no_public_grants_batch_05_20261019`.

Le cinque migrazioni in batch hanno abilitato RLS solamente sulle tabelle di proprietà `postgres` che non avevano alcun privilegio `SELECT/INSERT/UPDATE/DELETE` per `anon` e `authenticated`. Ogni batch utilizzava un `lock_timeout` di 2 secondi e il limite di 20 tabelle. Nessun record, mandato, schema di colonne o policy esistente è stato riscritto.

### Verifiche successive

- Query di controllo PostgreSQL: **111 tabelle su 111 con RLS**, zero senza RLS.
- `anon` e `authenticated`: zero privilegi `SELECT` sulle tabelle.
- `postgres` mantiene `CREATE` su `public` ed è un ruolo con `BYPASSRLS`; letture di controllo eseguite con successo.
- Query aggregate di verifica: `users` 1.839 righe, `opinioni_risposte` 758 righe; nessun dato individuale trasferito.
- Nessun utente, preferenza, sessione o dato politico modificato.

**Limite:** non è stato possibile eseguire un test end-to-end pubblico dell'app (login, scrittura e lettura opinioni dall'interfaccia) né controllare le variabili Render in questa sessione. La buona riuscita delle query PostgreSQL non equivale a una verifica dell'intera applicazione.

## Residui da gestire separatamente

1. **111 notifiche informative «RLS enabled no policy».** Le tabelle sono intenzionalmente chiuse ai ruoli senza permessi. Non creare policy `USING (true)` per far sparire il messaggio: aprirebbe l'accesso qualora venissero concessi privilegi. Verificare quali eventuali ruoli futuri avranno bisogno di policy specifiche.
2. **Avvisi «function search path mutable»: 0.** Tutte le 29 funzioni PL/pgSQL segnalate, di proprietà `postgres` e non `SECURITY DEFINER`, hanno ora un `search_path` esplicito `pg_catalog, public, pg_temp` (migrazione `demos_secure_public_function_search_paths_20261019`). Verificati prima/dopo risultati equivalenti per `normalize_slug`, `compress_log_level`, `decompress_log_level`, `compress_ip_address`, `decompress_user_agent`.
3. **3 estensioni in `public`.** Valutare migrazione verso schema `extensions` solo dopo un controllo delle dipendenze: spostare `pgcrypto`, `pg_stat_statements` o altre estensioni alla cieca può interrompere le query.
4. **Due viste dell'estensione `pg_stat_statements` hanno `SELECT` concesso a `PUBLIC`.** Sono di proprietà `supabase_admin`; l'utente `postgres` non ha `GRANT OPTION` su tali viste. Verificare se l'esposizione tramite Data API sia effettivamente attiva e se debbano essere spostate o escluse dalla superficie API attraverso una procedura supportata.
5. **Data API:** non disattivata. Le tabelle applicative sono protette da RLS e dall'assenza di GRANT; prima di spegnere la Data API occorre escludere consumatori esterni / RPC e testare l'app.

Il codice `api/config/database.js` usa `pg` con `DATABASE_URL` per il backend; una ricerca nel repository non ha trovato uso applicativo diretto di `supabase-js` o `/rest/v1`. Questo è un indizio, non una verifica delle integrazioni esterne.

## Strumenti di controllo versionati nella PR #211

- `api/database/security/supabase_data_api_readonly_audit_20261019.sql`: audit dei permessi effettivi e dei `GRANT`, sola lettura.
- `api/scripts/verify-supabase-data-api-exposure.cjs`: probe HTTP `HEAD` verso 11 tabelle sensibili; limite zero righe, nessun dato personale scaricato, chiavi amministrative rifiutate.
- `api/tests/supabaseDataApiExposure.test.js`: test offline del probe.
- `.github/workflows/supabase-data-api-audit.yml`: test unitari offline, **senza** interrogazioni a Supabase.

Il test GitHub Actions ha terminato con `success`: https://github.com/Nictolas/DemosApp/actions/runs/39229635553

## Verifiche live riuscite e verifiche ancora necessarie

- **Pass GitHub Actions HTTP 200, `success=true` su entrambe le richieste:** `https://api.demos.community/api/health` e `https://api.demos.community/api/test-db`, test remoto non autenticato e in sola lettura, esecuzione https://github.com/Nictolas/DemosApp/actions/runs/39236160877.
- Restano da testare i flussi autenticati: login, amministrazione, aggiornamento opinioni, selezione rappresentanti, notifiche, sincronizzazioni programmate.
- Controllare il ruolo effettivo della variabile `DATABASE_URL` di Render senza esporre l'URI o la password.
- Verificare gli endpoint della Data API usando unicamente la chiave `anon` o publishable (mai `service_role`).
- L'estensione `pg_stat_statements`, `pgcrypto` e `unaccent` è ancora nello schema `public`, appartiene a `supabase_admin` e risulta relocatable secondo il catalogo. Non è stata spostata: occorre qualificarne le dipendenze e la procedura supportata, preferibilmente in staging.
- Proteggere in modo mirato le viste e le funzioni accessibili tramite RPC; preservare le integrazioni richieste.

## Rollback

Le operazioni DDL/DCL sono presenti nella cronologia migrazioni. Prima di ogni rollback, recuperare la versione pre-hardening e verificare in staging: **non** ripristinare indiscriminatamente il `CREATE` pubblico o disattivare RLS sulle tabelle con dati politici/personali. In caso di regressione, correggere il privilegio minimo del ruolo tecnico coinvolto, non aprire tutte le tabelle ai client.

## Riferimenti

- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public


## Collaudo applicativo pubblico ampliato (19 ottobre 2026)

Eseguito workflow GitHub Actions read-only senza credenziali utente: https://github.com/Nictolas/DemosApp/actions/runs/39237159322

| Chiamata | Risultato live | Esito |
|---|---|---|
| `GET /api/health` | HTTP 200, `success=true` | PASS |
| `GET /api/test-db` | HTTP 200, `success=true` | PASS |
| `GET /api/statistiche/utenti` | HTTP 200, JSON `success=true` | PASS |
| `GET /api/statistiche/opinioni` | HTTP 200, JSON `success=true` | PASS |
| `GET /api/auth/me` senza token | HTTP 401 | PASS |
| `GET /api/users/me` senza token | HTTP 401 | PASS |
| `GET /api/opinioni/profile` senza token | HTTP 401 | PASS |
| `GET /api/user/political-opinions-consent` senza token | HTTP 401 | PASS |

Le statistiche pubbliche verificano che il backend riesce a leggere aggregate dal database. Le risposte private non sono state lette né registrate dal workflow: è stato ispezionato solo lo stato HTTP.
L'URL corretto è `https://api.demos.community/api`; usare `www.demos.community/api` causa una risposta HTML di frontend, non un errore PostgreSQL.

### Audit estensioni (solo lettura)

- `pgcrypto`: relocatable, proprietario `supabase_admin`, **0 dipendenze esterne tramite `pg_depend`**.
- `unaccent`: relocatable, proprietario `supabase_admin`, **0 dipendenze esterne tramite `pg_depend`**.
- `pg_stat_statements`: relocatable, proprietario `supabase_admin`, due dipendenze normali delle regole interne delle viste `pg_stat_statements` e `pg_stat_statements_info`.
- Il ruolo `postgres` non è membro del ruolo `supabase_admin`, quindi non può presumere di poter alterare le estensioni gestite.
- Nel repository esistono riferimenti SQL non qualificati a `pg_stat_statements` in `api/services/performanceMonitor.js` e `api/routes/admin/monitoring.js`. Spostarla senza aggiornare e testare questi consumatori potrebbe interrompere il monitoraggio.
- Le tre estensioni **non sono state spostate**. Non ci sono evidenze sufficienti per farlo senza un ambiente di staging e la procedura approvata dal proprietario.

Rimangono non verificati i flussi autenticati end-to-end (scrittura opinioni, login reale, sessioni, selezione rappresentanti). Non dichiarare la chiusura completa di questi test soltanto sulla base dei controlli pubblici.
