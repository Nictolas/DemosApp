# CP-062 - Shared Store Contract v0.62

A shared regression contract now checks the invariants that must remain aligned between `MemorySecurityStore` and `PostgresSecurityStore`.

The contract covers incident monotonic severity/count/time dimensions, acknowledged/resolved lifecycle protection, source-state monotonic watermark/timestamps/cumulative counters, and intentionally resettable current-state fields (`enabled`, `consecutiveFailures`). PostgreSQL behavior is inspected through its generated upsert SQL using a local mock pool; Memory behavior is executed directly.

This creates a single parity tripwire for future store changes while retaining the narrower implementation-specific suites. No real database, provider, network, migration, deployment or production write is used.
