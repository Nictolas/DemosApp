# Revocation relay replay guard (shadow)

This checkpoint is an in-memory shadow proof only. It adds no route, database table, cache, queue, scheduler, persistence or deployment.

The guard derives a domain-separated SHA-256 token from the opaque revocation capability and accepts that token only once during the guard lifetime. It does not receive or store account IDs, participant IDs, public keys, emails, opinion data or transport metadata.

The in-memory Set is intentionally not production architecture: process restart loses state and horizontal replicas do not share it. Production replay protection therefore requires a separately reviewed privacy-preserving store or protocol with bounded retention, concurrency-safe consume-once semantics, deletion policy and logs that do not recreate an Identity-to-Research mapping.

No production persistence should be introduced by this checkpoint.
