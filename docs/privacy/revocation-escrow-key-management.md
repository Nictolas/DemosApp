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
