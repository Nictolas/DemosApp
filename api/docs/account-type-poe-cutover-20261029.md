# DEMOS F12-12I — P/O/E cutover

Decision: account_type uses P = person, O = organization, E = institution in DATABASE. The legacy users.ruolo column is retained independently: its E means Elettore and its P means Politico. Status remains independent. Do NOT change status default to a; existing auth checks a exactly and unspecified inserts should fail closed.

## Production preflight verified read only, 29 October 2026

- 1,838 users: 1,825 PERSON, 11 ORGANIZATION, 2 INSTITUTION.
- No public view or RLS policy references account_type.
- The only public SQL function referring to account_type is refresh_users_legacy_role.
- The trigger users_capabilities_refresh_legacy_role is enabled (O).
- All 1,838 users have status a. Existing role default remains Elettore.
- 1,524 legacy politician accounts lack independently sourced current mandates: do NOT recalculate their legacy roles during a bulk account-type migration.

## Release gates and ordering

1. Review the entire Draft PR #402. Ensure all active runtime API, app and batch paths accept BOTH descriptions and P/O/E codes. Check Render autoDeploy and supported Android clients.
2. Run CI, including auth, DPO/Admin, Sondaggi, Opinioni, organization and statistic tests; verify the synthetic PostgreSQL 17 forward AND rollback scripts. CI does not replace real E2E staging checks.
3. DEPLOY COMPATIBILITY CODE FIRST while the DB still has long labels. Test Google/Apple/passkey registration, login, /auth/me, user list/detail/admin update, political and organization listings, GDPR export, and poll/opinion statistics.
4. With authorized DDL access and a fresh DB backup, apply api/database/users-role-default-e-20261029.sql. Verify role default E, no existing roles modified.
5. In a controlled migration window, after all deployed readers accept short codes, apply api/database/users-account-type-poe-20261029.sql. The migration snapshots historical roles, disables ONLY the legacy-role projection trigger transactionally, rewrites codes, updates the function and check/default, reenables the trigger and verifies role parity before commit.
6. Verify aggregate counts, current roles and statuses, authenticated API responses, Render logs and Android app screens. Never infer current office from LEGACY_BACKFILL.
7. If needed, use the separately tested api/database/users-account-type-poe-rollback-20261029.sql, with rollback authorization. It restores long type labels and preserves roles; role DEFAULT E remains a deliberate separate change.

## Additional post-migration role safeguard

The compact-migration role-projection function now reads the existing `users.ruolo` value. When a profile has an unverified historical `P` or `CP` role, changing `is_activist` or another unrelated capability must not silently downgrade the role to `E` or `C`. The PostgreSQL 17 fixture explicitly updates capability flags on synthetic P/CP profiles after the migration and checks both roles remain unchanged.

This safeguards existing user data, but it does **not** certify that those profiles currently hold political office. Canonical verified mandates remain a separate ongoing reconciliation task.

The dedicated CI additionally runs the Google/Apple OAuth registration tests and the passkey login-session policy tests after installing API dependencies. Those are isolated automated tests, not real identity-provider login sessions.

## Why the order matters

A currently deployed query filtering account_type = PERSON will return no matching persons if the DB is prematurely converted to P. This could silently zero out charts and surveys, without an exception. Conversely, deploying an old backend against a compact DB will have the same problem.

An UPDATE to account_type invokes the existing role-projection trigger; for legacy political profiles it might downgrade P or CP to E due to incomplete verified mandates. Both the forward and rollback scripts snapshot all roles and suspend that trigger only within the transaction.

## Read-only postflight

SELECT account_type, count(*)::int FROM public.users GROUP BY 1 ORDER BY 1;
SELECT ruolo, count(*)::int FROM public.users GROUP BY 1 ORDER BY 1;
SELECT status, count(*)::int FROM public.users GROUP BY 1 ORDER BY 1;
SELECT column_name,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('account_type','ruolo','status');
SELECT tgname,tgenabled FROM pg_trigger WHERE tgrelid='public.users'::regclass AND tgname='users_capabilities_refresh_legacy_role';

## Status

PR #402 remains DRAFT; no live DDL, merge or deployment. Current direct DDL operation was blocked by tool safety controls. The canonical status and remaining gates belong in Google Sheet DEMOS – Roadmap – Tabella di Marcia, CHECKLIST MASTER F12-12I.
