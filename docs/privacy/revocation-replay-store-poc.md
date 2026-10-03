# Replay store adapter POC

This is a replaceable in-memory proof of the shared replay-store contract. It provisions no external storage and is not production architecture.

The POC demonstrates consume-once behavior for concurrent callers in one Node.js process, bounded expiration and explicit sweeping of expired opaque tokens. It stores only token -> expiry and receives no Identity or Research identifiers.

Its atomicity is limited to one JavaScript process. It does not prove correctness across multiple processes, hosts or regions. A production adapter must use a storage primitive with atomic create-if-absent/expiry semantics and must be separately reviewed before provisioning.

No production database, cache, route, queue, service or deployment is introduced here.
