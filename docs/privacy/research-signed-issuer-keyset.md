# Research signed issuer public-key set — shadow

Status: shadow only. No production key-set endpoint, no production trust root, no route mount and no runtime fetch from Identity.

## Goal

Research must be able to verify Privacy Pass credentials while accepting issuer public-key rotation without introducing an online Identity dependency that could correlate redemption traffic.

The shadow design therefore treats the issuer key set as an authenticated snapshot that is prepared out of band and installed atomically into Research.

## Snapshot contract

A signed snapshot contains:

- schema `version`;
- monotonically increasing `sequence`;
- `issuedAt` and `expiresAt` timestamps;
- one or more issuer public keys, each bound to a 32-byte `tokenKeyId` and an explicit epoch list;
- one Ed25519 signature over a domain-separated canonical serialization of the payload.

The token key ID must equal SHA-256 of the exact public-key bytes carried by the snapshot. The snapshot is rejected if the key ID and public key do not match.

## Trust and rotation boundary

Research receives only:

1. a pinned Ed25519 trust-root **public** key used to authenticate snapshots;
2. issuer public-key bytes contained in a valid signed snapshot;
3. a verification-only loader that converts those bytes into the Privacy Pass public-key representation.

No issuer private key, signing API, account session, JWT or Identity callback is required at credential-redemption time.

The existing key-ring policy still applies after snapshot authentication: at most two issuer public keys may overlap for the same epoch and unknown/ambiguous keys fail closed.

## Freshness and rollback

- maximum snapshot lifetime: 7 days;
- snapshots issued more than 5 minutes in the future are rejected;
- expired snapshots cannot be installed;
- sequence numbers must increase monotonically;
- replay or rollback to the same/older sequence is rejected;
- once the currently installed snapshot expires, readiness becomes false and key resolution returns no key.

A replacement is fully verified and materialized before it becomes current. If signature verification, parsing, public-key loading or key-ring construction fails, the previously installed valid snapshot remains active until its own expiry.

## Operational model

The intended production flow is **not** a request-time fetch from Identity. A separate distribution process may deliver the signed snapshot to the Research environment, where it is verified against the pinned trust root and swapped atomically.

Emergency revocation is represented by a higher-sequence signed snapshot that removes the compromised issuer key. If no fresh authenticated snapshot is available after expiry, Research must fail closed rather than continue indefinitely with stale key material.

## Activation gates

Before production use:

- independently review the canonical snapshot format and Ed25519 trust-root lifecycle;
- define secure distribution/storage of the signed snapshot and pinned trust root;
- define alerting for approaching expiry, rollback attempts and failed refreshes;
- integrate the snapshot loader with the concrete Privacy Pass public-key importer;
- test crash/restart persistence semantics and emergency-revocation rollout;
- complete distributed rate limiting, DB readiness, security review and DPIA decisions;
- mount/deploy Research routes only after an explicit production-readiness checkpoint.
