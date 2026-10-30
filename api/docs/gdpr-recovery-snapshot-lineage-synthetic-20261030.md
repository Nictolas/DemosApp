# GDPR recovery — synthetic SQL snapshot lineage gate (2026-10-30)

**Scope: test-only in-memory fixture on Draft PR #374. Production recovery: NO-GO.**
No B2 bucket, provider credentials, Supabase, Render, deploy, merge or real restore
were accessed. The marker and account models below are **not** SQL attestations.

## Newly exercised failure mode

The journal can contain two successive committed operations for the same
subject: consent **revoke**, then **grant**. If a damaged or mixed-age snapshot
contains the later grant's idempotency marker but has lost the earlier revoke
marker, a naive replay performs the revoke and skips the grant as
already-applied. The final restored consent becomes **false**, although the
witnessed journal ends with a grant. This is a silent replay-order inversion.

A similar inconsistency arises if a restored account is present even though
its snapshot contains the committed account-deletion marker: a replay that
skips that marker would silently resurrect the account.

## Synthetic guard

`validateSyntheticSnapshotLineage(snapshot,committed)` now runs **after**
the sealed journal/witness verification but **before** any snapshot replay:

- Every snapshot idempotency marker must match an exact committed operation
  fingerprint from the witnessed journal. Unknown IDs and mismatched
  fingerprints fail closed.
- **Per subject**, present markers must be a contiguous prefix of committed
  operations; a later marker with an earlier missing marker is rejected.
- For each subject with applied markers, the snapshot account's existence and
  consent must agree with the **last applied operation**. Inconsistent state
  and deletion-marker resurrection are rejected.
- **Across different subjects**, markers need *not* form a global prefix:
  independent SQL transactions may commit in a different order from external
  journal acknowledgements. A valid cross-subject interleaving is tested.

Rejections are `GDPR_MODEL_SNAPSHOT_LINEAGE_INVALID` and
`GDPR_MODEL_SNAPSHOT_STATE_DIVERGENCE`. The original snapshot is left
unchanged; no `productionRecoveryReady:true` is ever returned.

## Test cases

`api/tests/gdprRecoveryConcurrencySynthetic.test.js` adds six regressions:
same-subject gap; valid revoke/grant prefix; cross-subject commit-order
inversion; unknown/mismatched marker; deleted account with surviving marker;
and revocation marker with inconsistent consent state.

The tests belong to the existing synthetic B2 worker/PG17 workflow.
Record the exact final HEAD and CI conclusions in the PR/issue only after
GitHub reports them; a successful synthetic test is not a provider proof.

## Unresolved production gates

The synthetic database assumes account state and idempotency marker are
atomically updated. Its marker Map is not a durable independent SQL ledger;
it does not attest backup provenance, snapshot transaction boundaries,
PITR position, PostgreSQL WAL/LSN, or that the journal covers every
authorized mutation. The guard cannot detect a state change with **no**
marker or a consistently forged snapshot; it cannot independently prove
that B2 contains all historical object versions.

A real design must bind a transaction-consistent SQL backup and its
idempotency ledger to a verifiable recovery cut, independently inventory
all relevant B2 journal versions and retention evidence, prove writer
fencing and ingress isolation, and run a quarantined end-to-end restore.
Until those proofs pass: **GH-296 NO-GO / PR #374 Draft**.
