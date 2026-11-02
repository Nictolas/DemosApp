# DEMOS civic notifications — isolated Render deployment-only canary

This runbook covers the Render **deployment gate** only. It is not a
database connection or Firebase delivery test, and never grants permission to
enable civic pushes.

## Dedicated free Render canary

Create a new isolated Node web service on the draft branch
`feat/civic-new-initiatives-push-20261101`. Do **not** change the
`demos-backend` production service or the existing
`demos-functional-staging` service. Disable auto deploy. Choose the free
plan only, and do not add a paid instance.

- Build: `cd api && npm ci --ignore-scripts --no-audit --no-fund`
- Start: `cd api && node staging/civic_render_boot_probe.js`
- The **only** custom environment variable is `CIVIC_STAGING_PROBE_ONLY=true`.
- **Never** attach environment groups or `DATABASE_URL`, `PGHOST`, service
  role credentials, Google/Firebase secrets, or push enable flags. The
  application aborts if it detects a database credential or a send flag.
- The app imports only Node core HTTP, never the DEMOS API server, Firebase,
  or the PostgreSQL pool. Its `GET /health` must return
  `releaseGate: NO_GO`, `database: NOT_TESTED`,
  `sessionAffinity: NOT_TESTED`, `firebase: DISABLED` and
  `civicPush: DISABLED`.

A successful HTTP 200 on this isolated canary verifies that Render can
checkout/build/start this draft branch on the free plan, **not** that any
civic integration is functional in its real runtime.

## Additional gates required before connecting a database

1. Obtain a **staging-only**, session-affine PostgreSQL connection for
   `demos_staging_runtime` through an approved secure secret transfer.
   Never copy a production `DATABASE_URL` or put credentials into a
   GitHub issue, build log, chat or code.
2. Review the role's actual login and the staging marker
   `civic_runtime_identity` independently. Port 5432 by itself is
   insufficient to certify safe session-affinity locks; transaction pooler
   port 6543 is prohibited.
3. Design and deploy a **separate** backend read-only probe with
   transaction read-only and bounded two-session `pg_backend_pid()`
   observations, with results redacted. A stable result is
   `INCONCLUSIVE`, never `SAFE` or `GO`.
4. Only after backend integration passes, request DPO and canary device
   authorization for Firebase/Android/PWA tests. Keep
   `civic_push_delivery_guard.blocked = TRUE` throughout the current phase.

This deployment-only canary must **not** be repurposed by simply adding
`DATABASE_URL` to its environment: it is intentionally designed to refuse
all credentials and send-related flags.
