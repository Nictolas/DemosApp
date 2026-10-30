# GDPR B2 Draft — bounded version readback (synthetic, 2026-10-30)

## Defect and change

The Draft `PrivacyErasureB2Journal.readVerified` checked the event size (8192 bytes), hash, version identity and Object Lock retention, but its `GetObjectRetention`, `GetObject`, and async body iteration had **no total time bound**. A hung provider or endless body could hold the operator-invoked recovery preflight indefinitely, despite bounded memory.

The Draft now applies a **single 15-second upper limit** to retention read + exact-version GET + streaming verification. Both SDK calls receive the same `AbortSignal`; expiry aborts the requests, destroys any obtained stream and raises `GDPR_B2_READBACK_TIMEOUT`. A late response from a transport ignoring abort cannot start another GET or leave an unconsumed body. A constructor-injected shorter limit is used **only by isolated tests**; invalid/unbounded values are rejected. No retry, PUT, repair, configuration change or implicit recovery GO is introduced.

## Reproducible checks

`node --test --test-concurrency=1 api/tests/gdprB2JournalBoundedReadbackIsolated.test.js`

The tests use a fake S3 client and synthetic JSON: stalled retention, stalled GET, never-ending stream, late retention response, late GET response, normal exact-version read, and invalid timeout settings. They run in the existing PG17 B2 worker workflow alongside the archive receipt/version checks. They **do not** use a real bucket, credentials, network, SQL or personal data.

## Boundaries / remaining NO-GO

A local deadline is not proof that an already transmitted network request was cancelled at B2; SDK abort is best effort. This change does **not** establish independent B2 version provenance, Object Lock on a real bucket, durable journal completeness/freshness, real SQL writer identity, external quarantine, PITR/WAL consistency, or a successful isolated restore. The bucket metadata preflight is separate and still not a complete provider attestation.

**PR #374 remains Draft; issue #296 remains OPEN; production recovery is NO-GO.** No merge, deployment, provider access, secret handling or real restore is authorized by this change.
