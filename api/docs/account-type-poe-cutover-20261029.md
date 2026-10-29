# DEMOS F12-12I — P/O/E cutover

Decision: account_type uses P = person, O = organization, E = institution in DATABASE. The legacy users.ruolo column is retained independently: its E means Elettore and its P means Politico. Status remains independent. Do NOT change status default to a; existing auth checks a exactly and unspecified inserts should fail closed.

## Production preflight verified read only, 29 October 2026

- 1,838 users: 1,825 PERSON, 11 ORGANIZATION, 2 INSTITUTION.
- No public view or RLS policy references account_type.
- The only public SQL function referring to account_type is refresh_users_legacy_role.
- The trigger users_capabilities_refresh_legacy_role is enabled (O).
- All 1,838 users have status a. On 29 October 2026, the production users.ruolo DEFAULT was independently changed from Elettore to E via Supabase migration users_role_default_e_20261029. Read-after-write confirmed DEFAULT E, 1,838 unchanged account rows, 138 electorate accounts, 1,674 P/CP role accounts. Account types are still descriptive labels.
- 1,524 legacy politician accounts lack independently sourced current mandates: do NOT recalculate their legacy roles during a bulk account-type migration.

## Release gates and ordering

1. Review the entire Draft PR #402. Ensure all active runtime API, app and batch paths accept BOTH descriptions and P/O/E codes. Check Render autoDeploy and supported Android clients.
2. Run CI, including auth, DPO/Admin, Sondaggi, Opinioni, organization and statistic tests; verify the synthetic PostgreSQL 17 forward AND rollback scripts. CI does not replace real E2E staging checks.
3. DEPLOY COMPATIBILITY CODE FIRST while the DB still has long labels. Test Google/Apple/passkey registration, login, /auth/me, user list/detail/admin update, political and organization listings, GDPR export, and poll/opinion statistics.
4. COMPLETED: role DEFAULT E was applied independently with an idempotent, guarded Supabase DDL migration users_role_default_e_20261029. No need to reapply this step; confirm the live default by read-only preflight. Remaining type cutover still requires a fresh backup and a separate approved deployment.
5. In a controlled migration window, after all deployed readers accept short codes, apply api/database/users-account-type-poe-20261029.sql. The migration snapshots historical roles, disables ONLY the legacy-role projection trigger transactionally, rewrites codes, updates the function and check/default, reenables the trigger and verifies role parity before commit.
6. Verify aggregate counts, current roles and statuses, authenticated API responses, Render logs and Android app screens. Never infer current office from LEGACY_BACKFILL.
7. If needed, use the separately tested api/database/users-account-type-poe-rollback-20261029.sql, with rollback authorization. It restores long type labels and preserves roles; role DEFAULT E remains a deliberate separate change.

## Additional post-migration role safeguard

The compact-migration role-projection function now reads the existing `users.ruolo` value. When a profile has an unverified historical `P` or `CP` role, changing `is_activist` or another unrelated capability must not silently downgrade the role to `E` or `C`. The PostgreSQL 17 fixture explicitly updates capability flags on synthetic P/CP profiles after the migration and checks both roles remain unchanged.

This safeguards existing user data, but it does **not** certify that those profiles currently hold political office. Canonical verified mandates remain a separate ongoing reconciliation task.

The dedicated CI additionally runs the Google/Apple OAuth registration tests and the passkey login-session policy tests after installing API dependencies. Those are isolated automated tests, not real identity-provider login sessions.

## Rollback semantic parity and function security (verified 29 October)

Read-only comparison against production PostgreSQL showed the historical
`public.refresh_users_legacy_role(uuid)` is an invoker-security function with
`SET search_path TO public, pg_temp`. Its legacy `P/CP` projection counts ALL
currently `ACTIVE` mandate rows, including provenance `LEGACY_BACKFILL`;
a legacy mandate in this projection is a historical UI label, **not** a
verification of a present political office. Approximately 1,524 of 1,674
current P/CP profiles have no active independently sourced mandate.

The previous rollback draft incorrectly filtered `LEGACY_BACKFILL` mandates,
so a subsequent unrelated flag update could downgrade P/CP despite a successful
migration snapshot check. The rollback has been corrected to restore the actual
production legacy semantics without filtering those rows. Forward migration
continues to preserve legacy labels explicitly and uses provenance-aware
checks for new role projections; both replacement functions now explicitly
retain the previous `search_path` configuration.

`api/tests/shortAccountTypeMigration.integration.sh` seeds an ACTIVE
`LEGACY_BACKFILL` mandate and ACTIVE candidacy for synthetic P and CP users,
asserts function configuration on both sides, and **after the rollback**
updates capability flags to verify those roles are still P/CP. This addresses
a post-rollback failure that the previous immediate row-count tests missed.
No production account rows or account-type DDL were changed by these fixes.

## Extended private Supabase staging profile data model, 29 October 2026

Applied `api/staging/f12_poe_canonical_profile_fixture_20261029.sql`
**only to Demos-Staging** (Supabase project `fkeayjzvtuvzesljhjbc`) in
migration `f12_poe_canonical_profile_fixture_20261029`. It extends the
existing non-exposed `f12_poe_ci` synthetic schema with the required
`users` profile columns, `user_profile`, and `user_representatives`.
No real names, emails, provider identities or credentials were inserted.

- Five private tables, each RLS enabled and with a primary key;
  `anon`, `authenticated` and `service_role` have no schema USAGE.
- Retained exactly seven invented account records, including one DPO
  that is **not** Admin. Performance advisor returned no missing PK or
  unindexed-FK findings for the new schema.
- Ran the **exact production /auth/me SELECT text** extracted from
  `api/routes/auth/profile.js`, replacing only the table schema and
  synthetic UUID parameter. Its 40+ selected fields executed successfully
  on Demos-Staging, returning the intended profile-region override
  (`Toscana`) and joined synthetic representative selection.
- Ran the exact account-subject SELECT from
  `api/services/accountCapabilitiesService.js` similarly; on an
  invented P/CP historical subject it returned code `P`, active status
  and separate `is_candidate`/`is_politician` projections.
- GitHub Actions' disposable PostgreSQL 17 HTTP integration now
  **also** creates both companion profile tables and checks the complete
  /auth/me query, DPO-vs-Admin separation, and resulting values with
  `account_type` in both long and compact form.
  Previously the HTTP test was passing via its legacy schema fallback,
  leaving the full profile query untested.
- Staging SQL is covered by `api/tests/compactAccountTypesStagingContract.test.js`
  which rejects public/auth/storage mutations or unprivileged grants.

**Not yet complete:** This private schema has intentionally no Data API
grants and is NOT bound to a running Render backend. The older Render
`demos-functional-staging` service still runs a separate older branch;
`public.users` in Demos-Staging remains incomplete. The above verifies
real Supabase database compatibility but is **not** live Google/Apple/
passkey sign-in or Android E2E. Do not merge PR #402 or change production
`account_type` before that separate gate is satisfied.

## Actual local HTTP authentication regression

The PR adds api/tests/compactAccountTypesHttp.pg17.integration.js, executed
during the isolated PostgreSQL 17 CI migration in both short and rollback/long
states. It starts a real Express HTTP server on 127.0.0.1, mounts the real
/api/auth/me route and real verifyToken/requireAdmin middleware, mints
ephemeral signed JWTs for invented fixture users, and checks accountType
remains descriptive, missing/invalid tokens are rejected, forged Admin JWT
claims cannot grant authorization, and inactive accounts cannot read their
profile. This runs the real route logic against a real local database,
but **not** actual OAuth providers or Android devices. No secret or production
identity is used.

## Why the order matters

A currently deployed query filtering account_type = PERSON will return no matching persons if the DB is prematurely converted to P. This could silently zero out charts and surveys, without an exception. Conversely, deploying an old backend against a compact DB will have the same problem.

An UPDATE to account_type invokes the existing role-projection trigger; for legacy political profiles it might downgrade P or CP to E due to incomplete verified mandates. Both the forward and rollback scripts snapshot all roles and suspend that trigger only within the transaction.

## Staging compatibility assessment (read-only, 29 October 2026)

Connected Supabase project Demos-Staging (PostgreSQL 17.11) is healthy, but is **not yet** a full mirror of the DEMOS user-account schema. At inspection it had 2 synthetic rows in public.users and:
- Present: id, ruolo, account_type.
- Missing: status, is_admin, is_activist.
- Missing: public.political_mandates, public.political_candidacies.

It also has its own OP37 private synthetic benchmark schema and other limited regression fixtures. Do not repurpose or rewrite these test fixtures without planning a separate schema.

Therefore an end-to-end OAuth/passkey authorization test against the Demos-Staging public schema would not represent production's canonical account capabilities. This is an **unmet staging gate**, not a successful E2E test.

In contrast, PR #402's PostgreSQL 17 CI exercises the real getAccountSubject SQL using six synthetic users with legacy roles, canonical columns, active account statuses, a verified synthetic mandate, a forward compact migration, and rollback, including subsequent capability updates. The CI checks database protocol and data consistency, but is not a live provider authentication test.

Before deployment, provision a dedicated isolated and complete staging schema/application using safe synthetic data. Reuse of production identities, credentials or user PII is neither necessary nor authorized.

## Private Supabase Demos-Staging smoke: verified 29 October 2026

Created dedicated private schema f12_poe_ci on Demos-Staging PostgreSQL 17.11, using migrations f12_poe_isolated_synthetic_fixture_20261029 and f12_poe_synthetic_fixture_constraints_20261029. Both succeeded.

- Seven invented accounts: account_type P=5, O=1, E=1. Every status is a. No real identities, names, or emails.
- Distinct domains: account_type E with ruolo I; account_type P with ruolo E; legacy roles P/CP/A/AD stay intact.
- Verified defaults: account_type P; ruolo E; status pending (the latter deliberately fail-closed).
- Two P/CP legacy politicians with only LEGACY_BACKFILL mandates are not considered independently verified, but retain their historical labels. One active legacy candidacy is separate.
- In a ROLLED-BACK staging transaction, is_activist=true on P and CP profiles did not downgrade either legacy role. A subsequent read confirmed rollback restored both flags.
- In a separate ROLLED-BACK staging transaction, an invented OFFICIAL mandate temporarily enabled the verified politician predicate. After rollback OFFICIAL mandate count returned to zero.
- Schema USAGE was explicitly denied to anon, authenticated and service_role. All three tables use RLS with intentionally zero policies (deny all for unprivileged roles). Security advisor INFO notices for RLS without policies are intentional.
- Performance advisors found no missing primary keys or unindexed foreign keys in the new schema after second migration. Public staging users and the op37 private schema are separate and unaffected.
- Read-only smoke assertions were all true; access restriction assertions were all true.

Reproducible files: api/staging/f12_poe_isolated_synthetic_20261029.sql, api/staging/f12_poe_isolated_synthetic_index_20261029.sql, api/staging/f12_poe_readonly_smoke_20261029.sql.

Remaining gate: This private schema is not connected to a running DEMOS backend. Existing public staging tables are incomplete for auth, so the tests are real Supabase/PostgreSQL integration but NOT live Google/Apple/passkey or Android E2E. Production role DEFAULT E was already changed independently; NO account_type P/O/E DDL, merge or deploy is allowed until separate application compatibility gates pass.
## Real survey SQL regression across both account-type encodings

On the synthetic PostgreSQL 17 CI database, the real `api/utils/sondaggiTextBulk.js`
aggregate reads now run in BOTH modes: compact account_type P/O/E and
descriptive PERSON/ORGANIZATION/INSTITUTION after rollback. CI suite
`api/tests/compactAccountTypesSurvey.pg17.integration.js` confirms:

- Identical national opinion q01 counts in both modes: favorevole 7, contrario 4, indeciso 1.
- Identical Toscana subgroup counts: favorevole 7, contrario 3, indeciso 0.
- Lazio subgroup of 2 and question q02 with 9 responses are suppressed at the 10-response privacy threshold.
- Two organizations with consent are excluded from person-based aggregates.
- A revoked person's user-consent record overrides their older users table flag and excludes their answer.
- A consenting person whose consent is recorded in user_consents rather than users is counted.
- All fabricated survey rows are deleted from the disposable CI database before the subsequent rollback tests.

PR #402 CI run 40865011758 completed successfully; logs show both
`COMPACT_ACCOUNT_TYPES_SURVEY_PG17_PASS` (mode short and long). All 14
PR workflows succeeded at commit c6987d2f. This verifies SQL/data semantics,
not live provider OAuth or a production mobile build.
## Read-only postflight

SELECT account_type, count(*)::int FROM public.users GROUP BY 1 ORDER BY 1;
SELECT ruolo, count(*)::int FROM public.users GROUP BY 1 ORDER BY 1;
SELECT status, count(*)::int FROM public.users GROUP BY 1 ORDER BY 1;
SELECT column_name,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('account_type','ruolo','status');
SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.users'::regclass AND tgname='users_capabilities_refresh_legacy_role';

## Status

PR #402 remains DRAFT; no account_type DDL, merge or deployment. The separately approved role DEFAULT E production DDL has now succeeded through the supported Supabase migration path and was verified read-only. The canonical status and remaining gates belong in Google Sheet DEMOS – Roadmap – Tabella di Marcia, CHECKLIST MASTER F12-12I.
