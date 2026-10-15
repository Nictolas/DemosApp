# CP-063 - Store Retention/Prune Parity v0.63

A shared retention contract now pins the temporal boundary and maintenance semantics across the in-memory and PostgreSQL stores.

- Retention is strict: records with `updatedAt < cutoff` are removed, while a record exactly at the cutoff is retained.
- PostgreSQL prune uses the same cutoff and only the dedicated maintenance pool; without maintenance credentials it performs no DELETE.
- Both stores reject retention windows below one hour.
- Memory capacity enforcement keeps the newest `maxIncidents` by `updatedAt`, preventing unbounded local/test growth.

The existing runtime already satisfied these invariants, so no production code change was needed. PostgreSQL checks use local mock pools only; no database, migration, provider, deployment or production write occurs.
