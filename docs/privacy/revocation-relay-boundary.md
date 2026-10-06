# Revocation relay boundary (shadow)

This checkpoint adds only a boundary helper and tests. It creates no route, queue, persistence, scheduler, service or production deployment.

A relay item may contain only an opaque revocation capability. Identity identifiers, Research participant identifiers/public keys, credential digests, opinion vectors, contact fields and per-request timestamps must not cross this boundary.

The helper also requires a minimum batch size (default 8) to prevent an accidental one-event/one-request relay. This is a guardrail, not an anonymity guarantee.

Before activation, the transport must be separately reviewed. Prefer client-mediated delivery or an independently separated delayed/batched relay. Any server relay needs replay protection, bounded delay/batching, deletion-latency objectives, abuse controls, and logging/retention rules that do not recreate an Identity-to-Research mapping.

Production routes, queues/services, persistence and key-management wiring require a separate approved checkpoint.
