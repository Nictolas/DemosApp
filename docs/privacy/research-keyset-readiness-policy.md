# Research issuer key-set freshness gate — shadow

Status: shadow only. No production mount, distribution channel, trust-root configuration or key material is introduced by this checkpoint.

## Goal

A correctly signed issuer key-set snapshot can still be operationally too close to expiry to be safe for continued credential verification. This gate adds an explicit freshness margin on top of the authenticated snapshot store.

## Contract

The caller must provide `minimumRemainingValidityMs` explicitly. The shadow code deliberately does not choose the production value.

The gate reports readiness only when:

- the authenticated snapshot store itself reports ready;
- `sequence` and `expiresAt` are structurally valid;
- the snapshot has not expired according to the gate clock;
- remaining validity is at least the configured freshness margin.

If the snapshot is inside the freshness window, readiness is false with reason `freshness-window`, and key resolution returns no key without calling the underlying resolver.

Missing, expired, malformed or unavailable snapshot state remains fail closed.

## Bootstrap wiring

`createResearchPrivacyPassKeySetBootstrap` now requires the freshness margin explicitly and wraps the authenticated issuer key-set store with this gate before exposing any verification capability. The bootstrap readiness surface is therefore the freshness-gated readiness surface, and the Privacy Pass credential provider resolves issuer public keys only through the gate.

This means a snapshot can remain cryptographically authentic and not yet absolutely expired while Research already refuses credential verification because the configured safety margin has been crossed. The margin is not read from environment state and is not hard-coded to a production value in this shadow path.

## Atomicity relationship

The signed snapshot store already materializes and validates a full candidate key ring before replacing its current snapshot. The freshness gate is read-only and observes only the store's published readiness state; it does not partially update key material or introduce a second mutable key-set copy.

## Privacy boundary

The gate sees only key-set sequence/expiry metadata and public-key resolution inputs. It has no Identity auth, account identifiers, network fetch, environment lookup or issuer signing capability.

## Production decisions still open

Before activation, Demos must separately decide and document:

- the production freshness margin based on distribution cadence and recovery objectives;
- alerting before entering the freshness window;
- crash/restart persistence for the last authenticated snapshot;
- rollback and emergency-revocation distribution;
- the trust-root provisioning and rotation process;
- behavior during a prolonged distribution outage.

Those decisions may trade availability against revocation/freshness guarantees and therefore remain outside this shadow-only checkpoint.


## Crash-safe persistence and multi-writer boundary

The shadow persistence layer uses a separate monotonic high-water mark as the anti-rollback anchor. Snapshot publication advances that anchor before the atomic file rename, verifies exact equality before publication, and verifies it again after rename plus directory fsync. Recovery reads the anchor before the file, after the file read, and after cryptographic/freshness revalidation; any change fails closed.

Writes are serialized only inside one process. The repeated high-water checks also detect several external-writer races, but they are not a distributed transaction and do not provide cross-replica mutual exclusion. A production deployment must therefore use an independently protected high-water backend whose monotonic advance/read semantics are strong enough for concurrent writers, or introduce explicit distributed coordination.

A crash after advancing the high-water mark but before publishing the matching snapshot intentionally leaves recovery unavailable rather than accepting the older file. Likewise, if another writer advances the floor immediately after publication, the publishing call reports failure and later recovery rejects the now-stale file.

No production backend, quorum model, lock service, database transaction, KMS/HSM integration or deployment topology is selected by this shadow design.
