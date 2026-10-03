# Research issuer key-set crash-safe persistence — shadow

Status: shadow only. No production path, storage backend, trust root, snapshot distribution channel, route, DB migration or deployment is selected by this checkpoint.

## Goal

Preserve the last authenticated issuer key-set snapshot across a Research restart without turning a local file into a new trust source.

The persisted JSON remains untrusted at boot. Recovery succeeds only after the caller revalidates the snapshot cryptographically and applies the normal freshness policy again.

## Write protocol

`createResearchIssuerKeySetSnapshotPersistence` requires:

- an absolute local snapshot path supplied by the caller;
- an independently supplied monotonic high-water-mark store;
- a snapshot that the caller has already authenticated;
- the authenticated sequence number, which must match the embedded payload sequence.

A replacement is written to a same-directory exclusive temporary file with mode `0600`, fsynced, and only then is the independent high-water mark advanced. After the monotonic floor is confirmed durable, the temporary file is atomically renamed over the visible snapshot and the directory is fsynced.

The ordering is intentional. If the process crashes after advancing the monotonic floor but before rename, recovery fails closed because the old file sequence is below the floor. It does not silently resume with the old key-set.

## Recovery protocol

Recovery:

1. requires an already-established monotonic floor;
2. opens the file without following symlinks where the platform supports `O_NOFOLLOW`;
3. rejects non-files, empty/oversized files, or group/world-readable permissions;
4. requires the embedded sequence to equal the independently stored high-water mark;
5. invokes a mandatory `revalidate(snapshotJson)` callback;
6. accepts the snapshot only if revalidation reports `ready: true` for the same sequence.

The intended callback must re-run signed snapshot validation and freshness/readiness checks. Therefore persistence alone never makes a snapshot trusted.

## Anti-rollback boundary

The high-water mark is intentionally an interface, not a local implementation. A local file and a monotonic anchor stored in the same rollback domain cannot provide strong anti-rollback against an attacker capable of restoring both together.

Production activation therefore requires an independently protected monotonic store whose durability and rollback resistance are reviewed separately. If that store is unavailable or inconsistent, Research must remain fail-closed.

## Privacy boundary

The persisted material is issuer public-key metadata and signatures only. This module does not read Identity sessions, account identifiers, participant identifiers, credentials, opinions or private signing keys, and it performs no network fetch.

## Still open before production

- choose the independently protected high-water-mark backend;
- choose the production filesystem/path and backup policy;
- define behavior after a high-water advance succeeds but filesystem rename fails;
- wire recovery to the authenticated Privacy Pass bootstrap;
- define refresh/freshness alerting and emergency key revocation;
- perform deployment and incident-recovery review.
