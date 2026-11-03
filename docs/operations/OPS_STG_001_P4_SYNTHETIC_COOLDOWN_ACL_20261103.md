# DEMOS — OPS-STG-001: ACL P4 per cooldown sintetici (3 novembre 2026)

## Stato: preparata e collaudata in CI; NON applicata al database condiviso

Nella PR #565 è stata aggiunta la bozza SQL `api/database/staging/ops_stg_001_p4_synthetic_cooldown_acl_20261103.sql` per collaudare in isolamento l'operazione reale di `preferenceCooldownService.recordPreferenceChange()` sul database temporaneo di GitHub Actions.

**Contesto tecnico verificato prima dell'intervento:** Supabase `Demos-Staging` ref `fkeayjzvtuvzesljhjbc`, 50 tabelle `public`, guardia `civic_push_delivery_guard.blocked=true`, marker identità `0cbb6ace68a9f11956904e2a37898ec8`, nessuna policy sulla tabella `preference_change_cooldowns`, account `demos_staging_preflight` ancora assente. Il servizio Render `demos-staging` resta in bootstrap fail-closed con autoDeploy OFF.

### Perimetro dell'ACL preparata

- Nessuna modifica a produzione, Render o Supabase condiviso; nessuna credenziale, nuovo account, nuovo staging o nuova infrastruttura persistente.
- Prima di essere applicata, l'ACL richiede un **GO esplicito nella stessa transazione**: `SET LOCAL civic.p4_runtime_approval='I_APPROVE_P4_SYNTHETIC_COOLDOWN_ACL'`. Fallisce chiuso in assenza dell'approvazione.
- Convalida il database Demos-Staging tramite identità runtime, `blocked=true` su push, ruolo runtime non privilegiato, esattamente **due utenti con UUID sintetici noti**, nessun cooldown preesistente, RLS attiva, assenza di GRANT e policy preesistenti. Richiede inoltre le policy P3 già approvate per i ballot sintetici; non riutilizza credenziali di produzione.
- Permette a `demos_staging_runtime` solo `SELECT`, `INSERT` e **`UPDATE(last_changed_at)`** su `preference_change_cooldowns`. Non autorizza UPDATE di `user_id` o `scope`, né DELETE.
- Policy RLS limitate ai due utenti fittizi e agli scope `referendum-vote:<uuid>` che corrispondono davvero a un ballot del processo sintetico con `source_id` prefissato `staging-fixture-`. Una stringa che sembri un referendum ma non si riferisca a una scheda consentita è respinta.
- Nessun GRANT ai ruoli `anon`, `authenticated` e `PUBLIC`.

**Limite importante:** il ruolo SQL applicativo è condiviso e può leggere i timestamp di **entrambi** gli utenti fittizi. Questa policy vale solo per i test con fixture sintetiche; non rappresenta una soluzione di autorizzazione individuale per utenti reali. Gli E2E di autenticazione e separazione dei voti restano obbligatori.

### Test realmente eseguiti

È stato esteso `api/tests/test_ops_stg_001_p1_p2_p3_migrations_postgres.py` con `test_zz_fixture_cooldown_acl_is_restricted_and_upsert_works`, eseguito **esclusivamente su PostgreSQL 16 temporaneo `civic_ci` in GitHub CI**. Verifica:
- senza approvazione -> rifiuto; identità database sbagliata -> rifiuto; guardia push disabilitata -> rifiuto;
- approvazione con prerequisiti sintetici corretti -> GRANT di colonna e policy creati;
- UPSERT identico a `recordPreferenceChange` con due modifiche allo stesso timestamp senza duplicati, e lettura corretta del nuovo timestamp;
- rifiuto dei tentativi su ballot non consentito, UUID inesistente, scope non pertinente e utente esterno;
- divieto di modificare scope o cancellare record;
- rollback dell'intero fixture e conferma di **zero** righe residue e notifiche ancora bloccate;
- secondo tentativo di applicare l'ACL -> rifiuto, non reinstallazione silenziosa.

**Evidenza:** commit `4455e154a73e107d707ce7c1a34c337866f448f1`, workflow `Unified Staging Offline Safety`, run `41624648273`: **3/3 job SUCCESS**, **77/77 test Node PASS** (49+28), **3/3 test Python/PostgreSQL PASS**. Alla prima lettura del risultato del commit, 4 workflow satellite su 6 erano già SUCCESS, build frontend e Security Agent non ancora terminati; Snyk `success`. Non segnare tutti gli altri workflow PASS senza una verifica successiva.

### Blocchi ancora aperti

1. Audit credenziali e dipendenze legacy; provisioning e connettività read-only di `demos_staging_preflight`, senza aggirare blocchi dei servizi.
2. Approvazione operativa delle ACL P3/P4 solo per fixture sintetiche e verifica dell'isolamento applicativo, altri schemi/fixture E2E necessari. **Le ACL P3 e P4 non sono state applicate** al progetto Demos-Staging.
3. Collegamento Render `demos-staging` soltanto a Supabase `Demos-Staging` (session mode, TLS, identità DB, credenziali minime), test E2E auth/profili/opinioni/referendum/notifiche/privacy con FCM, email e cron OFF.
4. Regressioni specialistiche e rollback provati, poi eventuale dismissione dei nove web staging legacy, controllo backup PG/Key Value e delle dipendenze.

Nessun test applicativo è autorizzato sul servizio Render fino al GO. Stato `BOOTSTRAP LIVE — TEST APP SOSPESI`, `/health/ready=503`.

**Importanza dell'avanzamento: 7/10.** Il nuovo test certifica una porzione concreta del contratto di voto/cooldown e dell'autorizzazione SQL sintetica, ma nessuno dei quattro gate complessivi è stato chiuso.
