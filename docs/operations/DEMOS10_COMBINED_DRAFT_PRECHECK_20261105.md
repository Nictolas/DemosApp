# DEMOS 10 — Combined safety verification bundle (Draft, 2026-11-05)

## Scope, source and controls

This is a code-only review bundle of the chained DEMOS 10 safety work. It is
proposed **against the existing single staging branch**
`ops/demos-unified-staging-20261102` (PR #565), **not against `main`**.
The bundle was based on the verified head of PR #619:
`9a8d58542d1d50fbd5c23501eea8fde1a0394891`.
It must **not** be merged, deployed, published or used to enable any Firebase
notification on real accounts without separately satisfying the release gates.

### Cumulative dependencies already included in this branch

* #610 consolidates #607 (official Ministry source ID drift), #608 (ECI pagination/integrity), and #609 (cross-account FCM token revocation).
* #611: atomic preference and Firebase reconciliation controls and fallback block.
* #612: device mutation SQL commit before HTTP success; uncertain lock/guard failure.
* #613: dispatcher and FCM topic bootstrap cannot report success on unconfirmed unlock.
* #614: outbox sent/failed requires one acknowledged SQL row; accepted Firebase sends are never silently retried.
* #616: legacy cleanup cannot reassign another account's FCM token.
* #617: optional legacy token column compatible with PostgreSQL transactions.
* #618: canonical active device retained despite an empty/stale legacy token array.
* #619: inactive foreign owners protected and stale topic membership revoked before explicit transfer.

The stacked Draft PRs remain separate for traceability. This bundle allows the
combined changes to be tested against the staging base in one review context,
without integrating them into the shared staging deployment.

## Verification requirements

Offline CI on this exact branch commit must pass:
1. Unified Staging Offline Safety: all jobs including disposable PostgreSQL 16/17.
2. Civic new initiative notifications (draft): HTTP and contract jobs.
3. Any additional GitHub checks triggered by the comparison.

The CI uses synthetic accounts and ephemeral databases; it does **not** prove
Firebase connectivity, actual notifications, Android deep links or live staging.

## Hard NO-GO gates (unchanged)

* T-55 runtime preflight: `STAGING_PREFLIGHT_RLS_REJECTED`. The forbidden
  runtime change was blocked by a safety control; **do not retry/bypass**.
* Actual civic Android end-to-end gates: **0/6 passed** (official ingest;
  consent ON/FCM registration; backend delivery to physical tester;
  authenticated notification tap; consent OFF; logout/revocation).
* Android AAB for post-1.0.12 changes: unsigned; signing action previously
  refused by a safety control. Do not retry/bypass.
* No permission to merge, deploy, alter Render/Supabase/FCM, test on real users,
  sign a new AAB or publish to Play.

**Result of this bundle is a code review/CI gate, never a runtime GO.**
