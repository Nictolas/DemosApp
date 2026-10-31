# GDPR recovery — witness ACK / journal publication crash gap (2026-10-30)

**Scope: synthetic fixture only. Recovery: NO-GO.** This document describes
failure injection in `api/tests/fixtures/gdprDurableRecoveryPrototype.js`
and `api/tests/gdprWitnessAckCrashGapSynthetic.test.js` on draft PR #374.
No B2 access, SQL connection, personal data, provider writes, deploy or
restore occurred.

## The missing cross-provider invariant

A witness can acknowledge a new head while the corresponding journal
record has **not** been durably published. Signing the exact record proves
its hash-chain contents, **not** that the record is recoverable from the
external journal. The current fixture attests before appending to its
in-memory array. That ordering avoids a locally unwitnessed append but
introduces an ACK-before-publication failure window.

Five synthetic regressions now inject failure after the witness ACK and
before journal publication or local seal acknowledgement:

1. **Prepare ACK, no journal record:** SQL is unchanged; the witness is
   one record ahead. Neither retry nor sealing nor recovery is admitted.
2. **Commit ACK, no journal record:** SQL was applied, but the journal
   still contains only the prepare. No committed receipt may be reused;
   unrelated writes also fail closed.
3. **Previously committed operation plus a later missing prepare:**
   the earlier committed retry is blocked when the global witness is
   ahead of the journal, preventing an apparently valid but incomplete
   journal prefix from being treated as current.
4. **Seal ACK, local seal flag not persisted:** the same signed head
   can be sealed again *in the fixture* and synthetic replay succeeds;
   this is not proof of writer fencing in a real deployment.
5. **Seal ACK, witness becomes unavailable:** a cached seal is
   insufficient; recovery and retry stay blocked.

The fixture uses `crashAt:'after_prepare_witness_ack'`,
`crashAt:'after_commit_witness_ack'`, and
`seal({crashAfterWitness:true})`. These options exist only in test
code and must never be used as production recovery controls.

## Important distinction

This change **does not close the atomicity gap**. It documents and
exercises the failure mode and makes the model fail closed. A real
implementation needs a recoverable durable journal record or
independently verifiable immutable object version *before* an external
checkpoint can authorize a write; a durable commit protocol must define
exactly how crashes, retries and divergent provider responses are
resolved. An HMAC checkpoint alone cannot attest B2 version availability,
Object Lock retention, journal completeness or SQL commit identity.

For any production recovery, the independent checkpoint and **all**
journal versions must be inventoried and compared from an authorized,
isolated environment. A witness ahead of the recoverable journal is a
hard **NO-GO** until independent evidence proves the missing entries and
the original-primary commit outcome. Never reconstruct a missing
commit merely from a restored user-profile field or from the witness
hash. SQL writer ACL, ingress fencing, B2 object integrity/retention,
end-to-end replay and restore quarantine remain unverified.

## Verification

The `GDPR B2 outbox worker retry and receipt regression (synthetic
PG17)` workflow executes:

```sh
node --test --test-concurrency=1 api/tests/gdprWitnessAckCrashGapSynthetic.test.js
```

Record the exact HEAD and workflow conclusions separately. Passing this
suite proves only the test model's fail-closed behavior, not any
provider-level durability or production readiness.
