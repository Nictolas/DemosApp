# GDPR recovery: captured SQL events must be B2-archivable (synthetic, 2026-10-30)

## Scope

The Draft `PrivacyErasureLedgerService.recordEvent` validates the canonical immutable-B2 event envelope before writing SQL even when the B2 outbox is OFF. The separate operator recovery path `mergeCaptured` previously checked event identity, timestamp and JSON serialization, but not the maximum canonical 8192-byte B2 envelope or its strict event key and subject bounds.

Consequently a historic SQL capture containing an oversized event (or a noncanonical event key) could be accepted into a restored ledger but could not later be independently archived/verified as an immutable B2 event. Replay alone cannot establish a valid external archive.

## Draft mitigation

`mergeCaptured` now invokes the same `normalizeEvent` format preflight on the **serialized JSONB-shaped details**, within its all-rows-before-DML validation loop. If any event is invalid it returns `GDPR_LEDGER_INVALID_CAPTURED_EVENT` and refuses the batch **before its first INSERT**. It does not drop the bad event, alter its contents, choose a substitute timestamp, or claim that restore succeeded. This does not change the exporter, worker enablement or production database.

The regression `api/tests/gdprLedgerCapturedArchivePreflightIsolated.test.js` uses a SQL sentinel with zero real database operations. It covers oversized details, a valid event followed by invalid event, invalid key, overlong subject, valid millisecond and microsecond timestamps, and a toJSON object that serializes to valid JSONB. The isolated B2/PG17 workflow runs this test, but it provides no real backup, B2 or SQL recovery attestation.

## Operational boundaries / open gates

* **NO-GO** when legacy captured rows exceed the B2 envelope; review and explicitly decide a secure migration/retention plan. Do not silently delete or truncate historic privacy events to make them pass.
* This preflight validates individual events, **not** completeness of the ledger, witness independence/freshness, provider Object Lock, external version inventory, or the identity/authorization of the SQL writer.
* Recovery still requires external proof of durable comprehensive history, isolated SQL + data-plane writer fencing, a quarantined synthetic end-to-end restore, DPIA/retention review and explicit operator authorization.
* No credentials, personal data, real B2 bucket, production Supabase/Render SQL, merge, deploy or real restore were used.

**PR #374: Draft. Issue #296: OPEN. Recovery: NO-GO.**
