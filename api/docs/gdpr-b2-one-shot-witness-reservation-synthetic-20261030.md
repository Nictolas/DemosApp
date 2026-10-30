# Synthetic one-shot B2 PUT reservation — 30 October 2026

**Scope:** api/tests/gdprB2WitnessSingleUseReservationSynthetic.test.js is a test-only, in-memory protocol sketch. It performs no provider I/O, SQL access, deployment, or recovery. **Recovery remains NO-GO.**

## Problem
A SQL claim committed before an immutable B2 PUT prevents retries only while that SQL history survives. A database restore to an older snapshot can erase the claim. An ACK-lost PUT can already have produced a COMPLIANCE version; repeating it may create a second immutable version.

## Proposed requirement, NOT implemented
Before any remote PUT, an independent, durable, atomic, single-use reservation keyed by immutable event identity and payload SHA-256 must be committed outside the restored SQL failure domain. Competing workers must not both obtain permission. A reservation with unknown remote outcome must **not** be reset automatically; a read-only provider version inventory plus independently pinned receipt and retention proof are prerequisites for any reconciliation. No provider write is safe merely because SQL has no claim or a process restarted.

The test sketch covers initial permit, retry after ACK loss, crash after reservation, restart, stale SQL, offline witness, conflicting hash, changed SQL phase and two competing synchronous workers. **Negative regression:** replacing the witness with an empty instance permits a second PUT in the model. This deliberately demonstrates that an unverified durability flag cannot prove continuity: independently anchored anti-rollback, retained witness history and a cross-system recovery barrier remain mandatory.

## Limits and release gate
The mock reservation is synchronous and in memory. It does **not** demonstrate atomicity across processes, B2 SDK semantics, durability, independent provenance, anti-rollback, journal completeness, SQL writer identity, network isolation, or quarantined restore. Its first-permit path is **not** connected to the actual worker, which must stay blocked. Do not promote this fixture to production or treat passing CI as permission to enable B2 writes.

**NO-GO until:** a reviewed external witness protocol with independently verified continuity and rollback resistance; durable claim integration; provider/version/COMPLIANCE attestation; complete ledger proof; isolated rehearsal with synthetic snapshots and closed ingress; DPO approval and explicit deployment authorization.
