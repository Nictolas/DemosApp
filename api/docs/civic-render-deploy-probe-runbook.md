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
- Required safety variable: `CIVIC_STAGING_PROBE_ONLY=true`.
- Optional **DNS-only** check: `CIVIC_STAGING_DNS_CHECK=true` plus
  `CIVIC_STAGING_PROJECT_REF=<staging-project-ref>` (non-secret). On process
  startup it resolves only the project's direct hostname, reports the address
  family as one of `DIRECT_IPV6_ONLY`, `DIRECT_IPV4_AVAILABLE`,
  `DIRECT_DUAL_STACK` or `DIRECT_DNS_UNAVAILABLE`, and **never** returns an IP,
  opens a database connection or queries a record. Public HTTP requests cannot
  trigger lookups. `database` and `sessionAffinity` remain `NOT_TESTED`.
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

## IPv4 transport requirement for Render

On 2 November 2026, the verified Demos-Staging direct endpoint had
**0 IPv4 A records and 1 IPv6 AAAA record**. Supabase direct connections
are IPv6-only without a paid IPv4 add-on, while Render outbound IPv6 is
unsupported. Do not try to solve this by using the Supavisor transaction
pooler on port **6543**, because the civic session-level advisory locks
require session affinity. On Render, obtain the **project-specific Supavisor
session pooler endpoint, port 5432**, from the Supabase Dashboard *Connect*
button, and validate that exact host, role, TLS and database identity.
A successful DNS-only check is not a Postgres login and cannot authorize GO.

Sources: https://supabase.com/docs/guides/database/connecting-to-postgres
and https://render.com/articles/how-to-connect-a-render-service-to-supabase-postgres

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
