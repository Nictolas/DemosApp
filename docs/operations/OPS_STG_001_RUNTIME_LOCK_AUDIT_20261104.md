# DEMOS 10 — T-55: runtime-role lock audit on unified staging

## Purpose
One-time, explicit opt-in diagnostic for the **existing** Render `demos-staging`
service while it remains in **isolated preflight mode**. It does not start the
DEMOS application, import Firebase, enable schedulers, send push, or write
application tables. It does acquire and release ephemeral PostgreSQL
**session advisory locks** (not a purely read-only SQL workload).

## Authorisation gate
Only when `CIVIC_STAGING_RUNTIME_AUDIT_GO` exactly equals
`APPROVED_ISOLATED_STAGING_RUNTIME_LOCK_TEST`. The service must already have
`NODE_ENV=staging`, `DEMOS_UNIFIED_STAGING_MODE=preflight`, the existing
preflight approval, and all seven push/sync/migration flags explicitly false.
Application readiness/permission flags must remain disabled. If any guard
fails, no runtime database socket opens.

## Connection restrictions
Uses the existing Render secret `CIVIC_STAGING_SESSION_DATABASE_URL`, never
logs or exposes it. Rejects every host except the independently confirmed
Demos-Staging Supabase session pooler
`aws-1-eu-central-1.pooler.supabase.com:5432`, exact project
`fkeayjzvtuvzesljhjbc` and role `demos_staging_runtime`; rejects production
variables and privileged usernames. TLS certificate verification is enabled
using the existing Supabase CA. Uses two connections, maximum 2, bounded
timeouts.

## Audit sequence
1. Read-only identity and blocked delivery-guard verification on authenticated
   PostgreSQL connection; no user rows are read.
2. Verify each session is `demos_staging_runtime` on database `postgres`.
3. Verify PID and temporary session state remain stable over distinct
   `BEGIN READ ONLY` / `ROLLBACK` transactions.
4. Test exclusive advisory-lock acquisition on session A, denied acquisition
   on B, persistence across transaction boundaries, release from A and
   subsequent acquisition/release on B.
5. In all cases rollback, `pg_advisory_unlock_all()`, discard client sessions,
   close the pool. Logs report only one of
   `STAGING_RUNTIME_LOCK_AUDIT_PASS` or
   `STAGING_RUNTIME_LOCK_AUDIT_NOT_VERIFIED`, without error details, PIDs,
   passwords, URLs or user information.

A failure **does not** change preflight liveness or enable application
readiness: `/health/ready` remains HTTP 503. The public health JSON remains
unchanged.

## Review and rollback
Review + CI first; merge only into the single staging branch #565, never
`main`. Set the audit flag via Render environment manager, triggering a
single safe deployment of `demos-staging` after CI. Verify the new Render
deploy is LIVE, the audit log is PASS, `/health/preflight` remains 200,
`/health/ready` remains 503, and the delivery guard remains blocked. If
unverified, clear the audit flag and deploy the previous good commit. Leave
`CIVIC_STAGING_SESSION_DATABASE_URL` secret managed by Render.

Even a PASS proves only isolated runtime-role/session-lock functionality in
staging. It does **not** prove app/Android E2E, ECI/Ministero ingestion,
authorization P3/P4/P5, or allow FCM delivery. **Release remains NO-GO.**
