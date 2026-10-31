# GDPR B2 — bounded read-only synthetic version preflight (2026-10-30)

**Scope:** Draft PR #374, isolated operator-only checker of one committed, non-personal synthetic object version. This is a **code and synthetic-test change only**. No Backblaze, Supabase, Render, database, secrets, real event versions or production restore were accessed. **GH-296 / production recovery: NO-GO.**

## Failure mode and mitigation

The previous fixed-key/version preflight bounded downloaded **bytes** to 1024 but did not bound **time**. A network/SDK stall on `GetObjectRetention`, `GetObject` or an async response body that never ends could keep the operator process pending indefinitely. In a recovery procedure, a hanging preflight is not evidence and must never be mistaken for a passed gate.

`api/scripts/attest-gdpr-b2-synthetic-version-readonly.js` now:

1. Enforces a **single maximum 15-second wall-clock budget** covering both SDK reads and consumption of the response body. Invalid test-injected budgets are rejected before SDK construction. This is not a per-request timeout that resets after each successful step.
2. Supplies an `AbortSignal` to the AWS SDK's two allowed read commands; the read-only transport accepts only the exact `abortSignal` option, not arbitrary SDK controls. It still permits only the pinned bucket, synthetic key and version, with no write/list commands.
3. Uses a deadline race so that even an SDK stub ignoring the abort signal cannot block the checker forever. On timeout, aborts outstanding SDK operations, destroys the active body, and closes the client; reports only `NO_GO_GDPR_B2_SYNTHETIC_VERSION_UNVERIFIED` with no provider details.
4. Rejects a **backwards wall-clock jump** between the retention check and completion of the download, in addition to the pre-existing retention-expiry and SHA-256/byte checks.

## Test coverage

`api/tests/gdprB2SyntheticVersionReadonly.test.js` adds six synthetic test groups: invalid deadline preflight, forbidden SDK options, hung retention and hung GetObject, hung response body with stream destruction, backwards clock, and cleanup exceptions that must not leak provider details. All positive results continue to return `recoveryReady:false`, `completeGdprJournalVerified:false`, `restoreTestVerified:false` and `externalCheckpointVerified:false`.

**Operational limitation:** this is a process-level fail-closed deadline, not an independently audited provider network timeout, durable journal proof or signed attestation. An SDK transport may complete an operation after a local timeout if its underlying I/O does not honor cancellation; the operator must not treat such a late response as evidence. Real credentials, bucket policies, object retention, full journal coverage, independently fresh checkpoints, SQL lineage, writer isolation and an isolated restore all remain separate **NO-GO** gates. No deploy or merge is authorized.

**CI evidence:** record exact commit and completed workflow conclusions in PR #374 and issue #296 after GitHub Actions finishes.
