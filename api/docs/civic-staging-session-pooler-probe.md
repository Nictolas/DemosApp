# DEMOS civic — T-55: session-pooler check on isolated Render backend

**Status:** Prepared and CI-tested, **not run against live Render/Postgres**
until a dedicated *Demos-Staging* credential is securely configured. Never
unblock push delivery, publish an AAB or merge PR #539 as a consequence of this
probe alone.

## 1. Obtain the *exact* endpoint

The staging database's direct hostname is **IPv6-only**, while Render outbound
is IPv4-only. From the **Demos-Staging** Supabase Dashboard, choose
**Connect → Session pooler**. Do not guess the pooler host from the region:
Supabase uses different pooler cluster indices even within one region.

The shared Supavisor session endpoint uses port **5432** (IPv4) and custom
database user format `demos_staging_runtime.<PROJECT_REF>`. Do not substitute
transaction pooling port **6543**, the direct `db.<PROJECT_REF>.supabase.co`
host, or `postgres.<PROJECT_REF>`: this script deliberately rejects them.

The role must be the pre-existing synthetic staging role whose grants and RLS
are restricted to two test accounts. Verify its login credentials through the
approved secret-management workflow; **do not reset the role password**
without checking existing staging users of that role.

## 2. Only on a separate, manually authorized staging runtime

Do **not** attach a database to
`demos-civic-deploy-probe-staging`: that deploy-only probe is deliberately
credential-free and must stay that way. Use a separately reviewed
short-lived Render staging runtime, with auto-deploy disabled and no
production environment groups.

Required environment entries (set through Render's protected environment
settings, **never** in commits, scripts, logs, Sheet cells or chat):

- `CIVIC_STAGING_SESSION_CHECK_APPLY=true`
- `CIVIC_STAGING_SESSION_CHECK_CONFIRM=I_APPROVE_READONLY_CIVIC_STAGING_SESSION_CHECK`
- `CIVIC_STAGING_SESSION_CHECK_ENV=staging`
- `CIVIC_STAGING_PROJECT_REF=<the Demos-Staging project ref>` (nonsecret)
- `CIVIC_STAGING_EXPECTED_POOLER_HOST=<exact host from Supabase Connect>` (nonsecret)
- `CIVIC_STAGING_SESSION_DATABASE_URL=<protected staging-only connection URL>`
  (secret, URL-encode special password characters).

Forbidden on that process: `DATABASE_URL`, `PGHOST`, `PGUSER`,
`SUPABASE_SERVICE_ROLE_KEY`, `CIVIC_PUSH_ENABLED=true`,
`CIVIC_NEW_INITIATIVE_EVENTS_ENABLED=true`, or
`CIVIC_SESSION_LOCK_CONNECTION_VERIFIED=true`.
The check refuses them **before opening a socket**.

Command: `node api/scripts/checkCivicStagingSessionOnRender.js`.

Without the explicit apply/confirmation flags, the command is a **preview**:
it imports no PostgreSQL pool and reports `NOT_TESTED`.

## 3. Exactly what is tested

With approved credentials the script creates a **separate** `pg.Pool` of at
most two SSL-certificate-verified connections, with bounded timeouts. It
does not load DEMOS's API, production pool, Firebase, user tables or service
role secrets, and executes only `SELECT pg_backend_pid()::text AS pid` twelve
times (six rounds on each checked-out client).

It never runs advisory locks, `INSERT`, `UPDATE`, `DELETE` or FCM calls.
It never prints connection URLs, passwords, IDs or PostgreSQL PIDs.

- `UNSAFE_AFFINITY_OBSERVED` → **NO-GO**.
- `INCONCLUSIVE` (distinct PIDs stayed stable) → still **NO-GO** until
  independent operator verification of the exact Supavisor session mode and
  backend runtime configuration; stability alone cannot prove session
  affinity in every failure case.
- `NOT_TESTED` / `UNAVAILABLE` → **NO-GO**.

The earlier SQL migration, 7/7 structure, runtime permissions 6/6, 3-category
outbox rehearsal and DNS-only Render probe are necessary *separate* controls;
none alone closes this one.

## 4. CI is intentionally *not* a live staging login

`api/tests/civicStagingSessionOnRender.test.js` tests strict URL, tenant,
role and environment gating with mocked clients, including error redaction.

`api/tests/civicSessionAffinityPostgres.integration.test.js` runs against
the disposable, localhost-only PostgreSQL 16 `civic_ci` in GitHub Actions to
exercise two actual TCP clients and confirm that stable backend IDs always
return `INCONCLUSIVE`, never `GO`. It does **not** connect to Demos-Staging
or certify Supavisor on Render.

## 5. Completion record

T-55 remains **OPEN** until a protected stage-only URL is configured on a
separate isolated Render runtime, the real read-only probe is executed and
the DPO records provider configuration and negative-test results. Keep the
global delivery guard `blocked=TRUE` throughout.

References:
https://supabase.com/docs/guides/database/connecting-to-postgres
https://supabase.com/kb/troubleshooting/tenant-or-user-not-found
