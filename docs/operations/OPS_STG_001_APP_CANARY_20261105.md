# DEMOS — OPS-STG-001: gated read-only application canary (05/11/2026)

**Status: code prepared on a separate QA branch; NOT deployed or activated.**

## Why this is required

The shared Render service `demos-staging` is still `preflight_only`.
The real PostgreSQL advisory-lock audit previously passed, and P3/P4/P5
synthetic policies were applied successfully. A separate 05/11 read-only
catalog audit of the **35** application tables required by the unified staging
preflight found **21** with no `demos_staging_runtime` SELECT grant and no
runtime RLS policy (including `active_sessions`, `civic_processes`,
`eventi`, `programmi`, `parlamento`, `candidati` and voting/notification
tables). Thus "35 tables present" does not mean "app routes authorized".

The historical `api/server.js` imports the entire `api/app.js` route tree.
With `NODE_ENV=staging`, it previously treated staging like development:
it exposed dev/test/migrate/cleanup routes and started the audit manager,
performance monitor and optimizer by default. Its Firebase initialization was
also unconditional. Launching it as-is on Render would be unsafe.

## Changes in this branch

- A **pure, no-network** guard `unified_staging_app_safety.js` rejects the
  full application in staging unless all four explicit conditions are present:
  `NODE_ENV=staging`, `DEMOS_UNIFIED_STAGING_MODE=app_canary`,
  `DEMOS_STAGING_APP_CANARY_GO=I_APPROVE_STAGING_APP_CANARY`,
  and both `CIVIC_UNIFIED_STAGING_READY=true` and
  `CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED=true`.
- It validates the *already existing* password-only
  `CIVIC_STAGING_SESSION_DATABASE_URL` solely in memory for the exact
  authorized Supabase project and session pooler host/role, refuses a
  different `DATABASE_URL`, any unrelated cloud/Firebase/dispatch secret
  and any active worker/sync/notification switch. It never prints the DSN.
- `server.js` refuses unsafe staging **before importing the app**, sets
  the validated `DATABASE_URL` only in the running process, does not
  initialize Firebase and sanitizes staging import failures.
- `app.js` repeats the gate for direct imports, never enables the
  development/debug/migration/cleanup routes on staging (even with a
  malicious or mistaken `ALLOW_DEV_API_SURFACE=true`), does not run
  background managers and suppresses non-production debug logging there.
- The initial canary allows only GET/HEAD on a fixed list of civic
  read-only endpoints. Readiness remains HTTP **503**, liveness is **200**
  with `app_ready=false`, `notifications_enabled=false`. All writes,
  login endpoints, admin, worker dispatch and other paths are 404.
- Offline tests cover denial of missing approvals, other DB projects,
  production DSNs, every unsafe toggle/secret, entrypoint bypass and the
  HTTP allowlist. The CI workflow includes the new test and syntax checks.

## Operational prohibition and remaining gate

**Do not deploy this code yet**. It is a *prepared guard*, not evidence
that the route imports are free of all side effects or that the backend can
serve real app traffic. The 21 ungranted runtime tables need a separately
reviewed, synthetic-only access plan and actual route smoke/E2E tests.
The existing `preflight_only` Render command must remain unchanged until
a specific cutover and rollback are authorized. No env vars, Render,
Supabase, Firebase, scheduler, Android or production changes in this PR.

The source ECI/Ministero issue #589 and Android/FCM E2E 0/6 remain NO-GO.
