# GDPR/B2 offline inventory reconciliation — synthetic boundary (2026-10-30)

## Why

A collection of apparently successful immutable B2 receipts does not prove that all SQL privacy-erasure events have an external copy. Conversely, an SQL capture may be incomplete or rolled back. A deterministic one-to-one comparison is a **necessary** cross-check, not a sufficient recovery attestation.

## New bounded offline check

`api/services/privacyErasureB2Reconciliation.js` exports `reconcileInventories({ledgerEvents, archivedReceipts})`. It accepts two explicitly supplied arrays, performs **no network or SQL operations**, and validates canonical events against the journal format. It rejects duplicate ledger keys, duplicate receipts, missing receipts, orphan receipts, hash mismatch, archive key mismatch, malformed receipt version IDs and retention timestamp syntax. Inventories are capped at 100,000 entries each; this is a fail-closed resource limit, **not** an assertion that 100,000 events is a complete history.

A matching inventory returns `{comparedEvents,matchedReceipts,complete:false,independent:false,recoveryReady:false}`, including the empty-vs-empty case. The caller must NOT treat this as a restore authorization or provider proof. This utility deliberately does not contact B2, inspect SQL, trust supplied receipts, or infer snapshot consistency.

Tests: `api/tests/gdprB2InventoryReconciliationIsolated.test.js` runs in the isolated B2 worker CI workflow. All inputs are synthetic and no real credentials or user data are involved.

## Remaining independent NO-GO gates

1. Acquire both inventories from independently verified sources, using consistent transaction cut and immutable provider version IDs, and prove they are not stale or incomplete. A caller-supplied list is not evidence.
2. Independently read back **each exact provider version**, check content hashes, retention and object lock, with a trusted source of expected event IDs. This utility checks only supplied metadata.
3. Demonstrate durable writer fencing and a quarantined end-to-end restore with full completeness proof, rollback resistance and explicit operator authorization.
4. Handle conflicting or unarchivable historic events explicitly; do not silently truncate, filter or invent receipts.

**PR #374 Draft. Issue #296 open. Recovery NO-GO.** No merge, deployment, B2 write, production access or real restore.
