# OPS-STG-001 — legacy Render PostgreSQL deadline and staging isolation decision (03 Nov 2026)

**Scope:** Render, PostgreSQL staging, indirect dependencies, Render–Supabase isolation, PR #565. Evidence-only update; no infrastructure change, paid service, production write, merge, deploy, permission change, network change, or deletion.

## 1. Legacy PostgreSQL: independently checked provider metadata

- Render workspace: `tea-d2gs3eadbo4c73ag95rg`.
- Database: `demos-civic-staging-db`, id `dpg-db4id8id0e5s73cfb0cg-a`.
- Render API: `available`, not suspended, `free`, PostgreSQL 17, Frankfurt, `ipAllowList=[]`, no managed connection pool.
- Provider `expiresAt`: **2026-11-08 17:38:42.884647 UTC** (18:38:42 CET).
- Render's Free Postgres documentation says it becomes inaccessible on expiry; after 14 days of upgrade grace it is deleted unless upgraded. A paid upgrade is NOT authorized. Source: https://render.com/docs/free
- This is a **service continuity deadline**, not an instruction or authorization to delete the instance.

## 2. Backup and restoration: reconcile existing evidence rather than rerun

In the Roadmap `STAGING — DIRETTIVA` rows 40 and 43, the prior operator reports that the archive was created and SHA-256 checked, `pg_restore --exit-on-error` successfully restored into a temporary isolated PostgreSQL 17, and 33 tables, 124 indexes, 26 foreign keys were validated. The temporary test cluster was removed. **This turn checked the existing register, not the original archive bytes or hash.** Retain the archive and restoration evidence; do not silently mark these checks as new or repeat already passed recovery testing.

## 3. Connection and dependency evidence (read-only)

Render `active_connections`, 2026-11-03 12:00–18:55 UTC, 5-minute resolution: **84 samples; 3 non-zero (maximum 1)** at **12:40, 12:45, 17:35 UTC**. Most 5-minute samples were zero, which is not proof of no short connections. Earlier logs and the current narrow log sample show repeated short authorized sessions; prior investigation described `postgres` as the connecting role, whereas Render lists a different default application database user. That distinction is consistent with a monitoring/probe hypothesis, **but does not independently identify the originating service**. No SQL query was run against the legacy DB; no IP/network rule was changed.

Inventory rechecked through Render `get_service`: 12 services total, including 2 production, 1 shared `demos-staging` bootstrap, and 9 old specialized staging web services. All 9 legacy services are `autoDeploy=no` and not suspended. Four deserve special scrutiny of indirect dependencies: `demos-sondaggi-op37-http-staging` (Supabase session pooler), `demos-outbox-readonly-staging` (DB/Axiom), `demos-b2-readonly-restore-staging` (archive-related; delegated to the other chat), `demos-security-staging` (security stack and external services). This is a **risk-ranked inspection list, not proof of production access**.

The Render connector available here can read service metadata and logs, **not actual linked Environment Groups or a safe keys-only env inventory**. Previous env audit reports that the shared service's legacy `DATABASE_URL` was cleared and the production backend uses Supabase production, not this legacy PostgreSQL. Those are prior recorded observations, not a fresh proof of every inherited secret or worker/job. Do not expose secrets to workaround the read limitation.

## 4. Shared staging vs isolated tests: conditional decision

| Test class | Appropriate boundary | Reason / gate |
| --- | --- | --- |
| HTTP app flows, multiuser login, privacy and notifications with all outbound effects OFF | Shared `demos-staging`, **only after explicit GO** | Exercises integrated runtime while keeping permanent resources minimal; avoid concurrent destructive test suites |
| SQL migration idempotency, negative grants, synthetic role and RLS regression | Ephemeral PostgreSQL 16/17 in GitHub Actions | Avoids mutating the shared staging schema and does not introduce persistent resources |
| Destructive rollback/recovery and concurrent migration experiments | Ephemeral isolated sandbox, if available at zero incremental cost and explicitly approved | Shared-state collision could invalidate tests or cause data loss |
| High load, provider failover, credential rotation and network fault injection | **Do not execute on shared bootstrap**; create a separate approved test plan first | Need realistic isolation, provider permissions and verified cost; no paid infrastructure authorized |
| Routine per-PR application builds and static checks | CI runners | Shared app not needed |

Therefore **one permanent shared staging environment is a good default, not a universal testing boundary**. Isolation is justified for dangerous/incompatible tests, preferably via ephemeral synthetic CI; no additional permanent staging is proposed.

## 5. Production isolation and release gates

- Live Render metadata: `demos-staging` runs branch `ops/demos-unified-staging-20261102` with `autoDeploy=no`, bootstrap start `cd api && node staging/unified_staging_bootstrap.js`; production backend runs `main` / `node index.js` and was not changed.
- Supabase lists `Demos` and `Demos-Staging` as distinct active, healthy projects. Distinct names and IDs are **not** proof of complete secret isolation across all services.
- PR #565 remains Draft; a passing offline CI job does not authorize a live Render→Supabase connection or production deploy.
- Four macro-gates remain **NO-GO**: (1) inherited credential and dependency isolation plus minimum preflight role, (2) runtime ACL / fixture approval, (3) TLS/identity and functional E2E, (4) rollback, parity and retirement authorization.

## 6. Required operator decision before 08 Nov 17:38 UTC

1. Preserve the validated archive/checksum and identify who can retrieve it after Render expires; the legacy instance must **not** be treated as durable after the deadline.
2. Attribute client activity using approved existing provider monitoring or internal read-only access, without opening the database IP allow-list.
3. Confirm all nine services' indirect Environment Groups, jobs/worker targets and production exclusion through an authorized keys/target-metadata-only audit.
4. If dependencies remain unknown on deadline, report continuity as **NO-GO** instead of assuming a zero connection sample is conclusive. No paid upgrade, network modification or retirement may be initiated without explicit operator authorization.

**Result:** better deadline evidence and a test-isolation decision; **no existing release blocker or dependency is asserted closed**. Canonical Checklist Master entries, production and infrastructure remain unchanged.
