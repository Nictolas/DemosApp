# Account activity migration plan (shadow)

This plan is intentionally non-executable in production until explicit approval.

1. Create `identity.account_activity` with forced RLS.
2. Backfill every account idempotently from `MAX(active_sessions.last_activity)`; when no session evidence exists, use the account creation timestamp so missing rows never become an accidental deletion signal.
3. Enable dual-write from successful auth activity to both the session store and lifecycle store.
4. Validate: every account has a lifecycle row and no lifecycle timestamp lags a known session timestamp.
5. Observe dual-write parity before cutover.
6. Cut the inactivity policy read from legacy session aggregation to `identity.account_activity` only after validation.
7. Rollback by switching reads back to legacy aggregation. Preserve lifecycle rows during rollback; deleting them would destroy evidence.

No schema application, backfill, dual-write activation or cutover is performed by this commit.

## Shadow dual-write and parity gate

A non-wired shadow mirror can copy successful Identity activity into the lifecycle store. Mirror failure returns `mirrored:false` and may emit only a fixed failure code, so enabling observation later does not require logging account identifiers. The legacy authentication write remains authoritative during this phase; mirror failure must not break login. A parity checker counts missing lifecycle rows and rows lagging `MAX(active_sessions.last_activity)`. Cutover is allowed only when both counts are zero. These helpers are not connected to production auth by this commit.

## Feature-gated shadow wiring

`IDENTITY_ACTIVITY_SHADOW_DUAL_WRITE` is exact opt-in and defaults OFF. The shadow writer performs no lifecycle write and records no mirror metric while disabled. When explicitly enabled after schema/backfill approval, it uses the non-blocking mirror and records only process-local aggregate counters (`attempted`, `mirrored`, `failed`). No account ID, activity timestamp, error text or database detail is exposed through this telemetry. This commit does not set the environment variable or connect the writer to production authentication.

## Auth hook with schema-readiness gate

The session service now contains the shadow hook after successful legacy session issuance/rotation/revocation. It remains inert because the feature flag defaults OFF. Even if the flag is set, the writer refuses lifecycle writes until this process has positively attested `identity.account_activity` with `to_regclass`. Attestation errors fail closed. No startup code currently performs that attestation and no environment value is set by this commit, so production behavior remains legacy-only.

## Cutover readiness orchestration

Cutover authorization now has four independent prerequisites: positive schema attestation, explicit process-local backfill attestation, live parity with zero missing/lagging accounts, and an explicit manual approval input. None is inferred from the others and none is automatically set by startup. Missing prerequisites fail closed. This is policy/test scaffolding only; it does not switch the inactivity reader or mutate production state.

## Durable migration evidence (shadow)

The shadow schema defines an Identity-only `lifecycle_migration_evidence` table with forced RLS. Evidence records contain migration version, schema/backfill booleans, aggregate missing/lagging counts, observation time, and a domain-separated SHA-256 integrity digest. They contain no account identifiers, session metadata, opinions, or Research identifiers. The digest detects accidental/tampered field changes but is not an operator signature; production approval must remain separate and stronger. No evidence table is created or written in production by this commit.

## Fresh evidence binding

A recorder can persist evidence only after the live readiness evaluator returns complete parity counts. Cutover policy now independently requires manual approval, integrity-valid evidence, evidence no older than 15 minutes (and not from the future), zero recorded defects, and a fresh live readiness check. The evidence therefore cannot replace live verification or human approval. Nothing invokes the recorder or cutover policy automatically.

## Bound approval proof (shadow)

The cutover policy no longer accepts a boolean approval. It requires an HMAC-SHA-256 approval proof bound to the exact migration version and evidence digest, carrying a nonce and an approval timestamp no older than 15 minutes. Missing, stale, tampered, or differently-bound approval fails closed. The 32-byte key is an injected interface for tests/future secret management; this commit creates no production key, secret, signer endpoint, or approval. A production design should move signing to a non-exportable KMS/HSM or equivalent controlled approval service rather than an application environment secret.

## Approval verifier boundary and replay protection

Cutover policy now consumes an injected verifier interface rather than raw approval key material. This boundary is compatible with a future non-exportable KMS/HSM verifier. After evidence, approval, and live readiness all pass, the approval nonce must be atomically consumed by a replay store before authorization is returned. The included in-memory replay store is test/POC only and stores only a domain-separated nonce digest; it is not durable or distributed and therefore must not be used as the production replay authority. No KMS, secret, or persistent replay backend is provisioned here.
