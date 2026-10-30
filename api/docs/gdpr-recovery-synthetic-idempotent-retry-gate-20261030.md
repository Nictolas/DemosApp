# GDPR recovery — synthetic idempotent-retry admission gate (2026-10-30)

**Status: TEST MODEL ONLY / RECOVERY NO-GO.** This note concerns
`api/tests/fixtures/gdprDurableRecoveryPrototype.js` on draft PR #374,
not the deployed DEMOS backend. No B2, Axiom, PostgreSQL production or
staging credentials, real journal versions, account data or restores were used.

## Problem addressed

An idempotent retry previously returned `{confirmed:true,reused:true}`
when it found a `commit` row and merely observed that the local SQL model
contained the same operation ID. This was not sufficient: a SQL marker with
a different operation payload, a truncated or altered journal, or an
unavailable independent witness could still cause a positive response.

## Synthetic invariant

Before either a retry acknowledgement or a new operation against a
non-empty journal, `validatePrefix()` now checks **the full existing
in-memory hash chain**: contiguous sequence, previous hash, epoch,
recalculated entry hash, permitted operation shape and phases, exact
prepare/commit matching, duplicate and per-subject pending constraints.
It then checks the current external-witness model against the complete
current journal head. Pending intents for unrelated subjects are allowed
for **live-prefix validation only**. The sealed restore verifier continues
to require all writers fenced, a sealed journal and zero ambiguous intents.

A committed retry additionally requires `db.hasExactCommit(operation)`,
which compares the original operation's canonical fingerprint, not just
the operation ID. Failure is closed, without reporting a successful
idempotent receipt. The tests cover a corrupted SQL marker, witness
offline/lost, journal truncation, modification of an earlier chain entry,
a valid retry with an unrelated pending intent, and rejection of a new
operation while the witness is unavailable.

## Test invocation

```sh
node --test --test-concurrency=1 api/tests/gdprDurableRecoveryProtocolSynthetic.test.js
node --test --test-concurrency=1 api/tests/gdprRecoveryConcurrencySynthetic.test.js
```

The GitHub workflow `GDPR B2 outbox worker retry and receipt regression
(synthetic PG17)` runs these as part of its broader synthetic regression.
The workflow result for the **final** commit must be checked separately;
a green run on an older SHA is not evidence for this change.

## Not proven — release gate remains NO-GO

The witness is a process-local HMAC fixture. Its `current()` and
`available` fields are not proof of an independently durable,
non-equivocating authority or a remote B2 Object Lock version. A
read-only synthetic-object metadata check is also insufficient to prove
completeness or freshness of the actual GDPR event stream. The model
assumes atomic append and witness acknowledgement, which remains
unproven across real PostgreSQL, Backblaze B2, and any external journal.
The in-memory SQL marker is not evidence of the real writer identity,
permissions or commit durability.

Before any real recovery GO, independently demonstrate the writer ACL
and exact commit identity, immutable versioned journal and external
head/checkpoint continuity, detection of missing or reordered versions,
complete retention and deletion coverage (including Axiom/B2 copies),
writer and ingress isolation, and a rehearsed quarantined restore on an
authorized isolated environment. Record the provenance of each
attestation. Do not merge, deploy, mutate a real bucket or run a real
restore solely on the strength of these tests.
