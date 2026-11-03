# DEMOS — P0 composite privacy/consent/Admin integration (2026-11-03)

## Context

This **DRAFT-only** integration branch combines two independently tested
workstreams without publishing or changing shared staging:

- PR #562 `integration/p0-release-gates-20261102`: canonical political
  consent read isolation, Admin retention/backup/erasure fail-closed gates,
  error redaction, Android catalog and Render manual-deploy protections.
- PR #579 `fix/ops-data-export-supabase-20261103`: Supabase Admin UI,
  read-only Data Export, removal of legacy Neon migration/deletion controls,
  three legacy POST routes returning 410, blocked service entrypoints,
  twelve legacy CLI scripts, and their synthetic contract tests.

The DPO expressly approved the **privacy measure** in conversation and the
approval is recorded on PR #579. This is not an automatic release
authorization, a GitHub formal review or acceptance of outstanding GDPR,
staging or QA gates.

## Composition and conflict resolution

The integration is constructed using #562 as the base tree. It overlays
**21 files** from #579 that are new or semantically required. Three
overlapping files already have **identical Git blob SHAs** in #562 and #579
and are preserved unchanged from #562:

- `api/routes/admin/data-export.js`
- `api/routes/admin/axiom-migration.js`
- `api/tests/legacyDataExportAuthIntegration.test.js`

`client/src/pages/DataExport.tsx` is taken from #579 because it removes
both hidden and disabled obsolete export/delete controls rather than leaving
unreachable state and DOM actions. The associated
`api/tests/legacyDataExportRetirement.test.js` from #579 checks this
stronger UI contract.

All remaining files and security protections from #562 stay in the base
tree, including `api/app.js`, consent routes, deletion/retention/backup
contracts, `render.yaml`, and the release/Android workflows. The commit
has two parents and is versioned only on an isolated branch; **neither
parent PR, main, Render nor Supabase is updated**.

## Gates

A new GitHub Actions workflow runs, on the **combined tree**, full synthetic
legacy HTTP, Admin redaction/auth, GDPR deletion, political consent and
matching tests; TypeScript/Vite frontend build; and **actual PostgreSQL 17**
consent-read isolation against a disposable CI database. No production or
staging credentials, external provider writes, migrations, emails or pushes.

Do not mark any REL/staging gate as complete merely because the combined CI
passes. Still required: review of all overlap and migration/backup paths,
audit of external cron/CLI copies and historical credentials, separate
authorization of staging preflight role and P3/P4/P5 ACLs, authenticated
Render→Supabase E2E with delivery disabled, user privacy QA and explicit
rollback/release decision.

Release decision: **NO-GO**, Draft.
