# Research issuer public-key distribution and rotation — shadow design

Status: shadow only. No key distribution endpoint, remote fetch, production key, route mount or deployment is created by this design.

## Goal

Research must be able to verify Privacy Pass credentials across planned issuer-key rotations without ever receiving Identity private keys, signing APIs, account sessions or account identifiers.

## Key-ring contract

Research stores only verification-only public keys plus:

- the 32-byte Privacy Pass token key ID derived from the serialized issuer public key;
- an explicit bounded list of credential epochs for which the key is accepted.

The shadow key ring permits at most **two** public keys for the same epoch. This allows one controlled old/new overlap during rotation while preventing an unbounded collection of accepted verification keys.

At redemption, the token's key ID and credential epoch must resolve to exactly one public key. Unknown, malformed or ambiguous selection fails closed before signature verification.

## Distribution boundary

The future production distribution mechanism must deliver an authenticated, integrity-protected public-key set to Research. Request-time calls from Research to Identity are intentionally excluded: Research should verify against a locally validated snapshot so credential redemption does not become a timing/linkage channel back to Identity.

The production mechanism still requires a decision on:

- trust root / signature used to authenticate the published key set;
- refresh cadence and maximum staleness;
- atomic replacement and rollback rules;
- emergency compromise/revocation procedure;
- retention duration for retiring verification keys;
- monitoring that exposes key-set health without logging token/account linkage.

## Rotation sequence

1. Provision the new signing key only inside the Identity/issuer security boundary.
2. Publish its public verification key through the authenticated key-set channel.
3. Allow old + new public keys for the controlled overlap epoch.
4. Issue new credentials with the new key.
5. After the overlap policy is satisfied, remove the retiring key from subsequent epochs.
6. Keep historical verification only where the credential lifetime requires it; never retain private signing material in Research.

This policy does not itself activate production keys or solve emergency revocation of already-issued anonymous credentials. Those remain explicit security/DPIA decisions.
