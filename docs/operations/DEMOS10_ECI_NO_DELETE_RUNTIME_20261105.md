# DEMOS 10 — ECI synchronization without PostgreSQL DELETE

**5 novembre 2026 — patch in staging QA, no cron/push/production deployment.**

## Production blocker identified by direct database inspection

The canonical Supabase `Demos-Staging` role
`demos_staging_runtime` has:
- `SELECT/INSERT/UPDATE` on `public.eci`;
- RLS policy `civic_stage_runtime_eci`;
- **NO DELETE privilege**, intentionally.
- `public.eci` has `eci_pkey (id)` as its stable unique index.

However `api/scripts/sync_eci.py::_replace_cache` performed
`DELETE FROM eci` on *every* scheduled write, including unchanged
official feed reads. Once the scheduler connects with least-privilege
staging credentials, it would fail before updating any record.

## Fix in the isolated PR

- Always verify `CIVIC_RUNTIME_DATABASE_ID` before any write, as
  enforced by the earlier PR #598.
- Refuse duplicate official EU IDs within the just-validated payload.
- **INSERT ... ON CONFLICT(id) DO UPDATE** current official ECI rows.
  Never require DELETE or TRUNCATE.
- Rows no longer in the authoritative `ONGOING` feed are retained
  with `status='NOT_ONGOING'` and updated timestamp rather than
  deleted. This status deliberately does not assert official closure,
  merely absence from the current ongoing list.
- Both public ECI/ICE read endpoints now explicitly filter
  `WHERE status='ONGOING'` so historical rows cannot be shown as
  signable initiatives.
- Persisted historic outbox rows are never removed or reactivated.
  When event collection is explicitly enabled, new ID discovery still
  runs within the same transaction, checks the blocked push guard with
  row lock, and uses `ON CONFLICT(category,official_id) DO NOTHING`.
- Offline Python tests verify the SQL contains **no DELETE**, correct
  upsert by official ID, suppression during emergency stop, duplicate
  rejection and the public route filters.
- The staging CI workflow runs the ECI suite, checks route syntax,
  and is triggered by ECI/ICE route changes. Intended PG16/17 schema
  jobs remain unchanged.

## Page-to-page source snapshot integrity (05/11/2026)

Additional guarded staging-only change: every official ECI search page must
report the same positive `recordsFound` value. A changed total, repeated
source ID across pages, missing/invalid ID, or too many returned items now
aborts the entire public-source fetch **before** any database connection or
cache/outbox update. This prevents a mixed pagination snapshot from wrongly
marking a genuinely ongoing ECI as `NOT_ONGOING` or affecting notifications.
Synthetic offline Python regressions cover mid-read total changes, overlapping
pages and invalid source metadata. A stable but internally incorrect official
total remains a provider-level limitation; no E2E is claimed.

## EU signature data and official signing links (05/11/2026)

The ECI cache normalizer now refuses fractional/boolean signature counts
instead of silently coercing them through Python `int()`. It accepts only
nonnegative integer values (or digit strings). If a detail response exposes
a `pubRegNum`, it must match the official search entry's ECI ID.

Direct signing URLs are allowed only on the European Commission's HTTPS
hosts `eci.ec.europa.eu` and `citizens-initiative.europa.eu`.
Untrusted or malformed URLs fall back to the canonical EU initiative detail
page. Offline regression cases cover deceptive subdomains, HTTPS userinfo,
nondefault ports, non-EU hosts and invalid numeric values. No users, devices,
credentials, or live endpoints are touched.

## Baseline and rollout limits

Readback of Demos-Staging before this change: ECI=12,
Ministero=87, outbox=48 `suppressed`, actionable=0,
devices=0, `civic_push_delivery_guard.blocked=true`. No cache or
database modification is required by this PR.

**An automatic scheduler still needs an authorized staging-specific
credential and an explicit staging GO.** The existing
`.github/workflows/eci_sync.yml` runs on the default branch, is
currently missing its DB connection and identity, and must never be
pointed at production or silently use a privileged token. GitHub
Actions scheduled workflows do not run on nondefault branches:
merging a workflow into the unified staging branch does not enable
periodic scheduling there.

The Ministry scheduler similarly awaits an authorized staging endpoint
and key. Full app staging, FCM, 6/6 Android E2E, publication and
production remain NO-GO. Do not unsuppress the 48 historical events.
