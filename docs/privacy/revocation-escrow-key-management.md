# Revocation escrow key management — shadow boundary

The application depends on an injected key provider; it does not read an encryption key from environment variables or source code.

Contract:
- `getActiveKey()` returns exactly 32 key bytes plus a positive integer key version for new envelopes.
- `getKeyByVersion(version)` returns the historical 32-byte key needed to decrypt an existing envelope.
- Missing, malformed or retired key material fails closed.

Production requirements not implemented here:
- use a managed KMS/HSM or equivalent non-exportable key custody where practical;
- define rotation cadence, overlap window and re-encryption procedure;
- separate key-management permissions from Research service permissions;
- audit decrypt operations without logging plaintext capability or Research identifiers;
- define disaster recovery and destruction procedure.

No production key, Render environment variable, KMS resource or secret is created by this shadow step.

## Shadow service integration

The orchestration service now composes provider + AES-256-GCM envelope + Identity store. Rotation reads the historical key by envelope version, decrypts only in process memory, re-encrypts under the active version and overwrites the Identity envelope. The temporary plaintext buffer used during rotation is zeroed in a finally block. This is still not a production KMS integration or scheduled rotation job.

## Concurrent rotation guard

Re-encryption now uses compare-and-swap semantics on the stored key version. If another writer changes the escrow between read and write, the conditional update affects zero rows and rotation fails closed instead of overwriting the newer envelope. A production batch rotation job still needs retry/backoff, transaction/isolation policy and operational metrics.
