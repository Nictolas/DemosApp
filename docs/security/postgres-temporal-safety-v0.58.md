# CP-058 - PostgreSQL Temporal/Stale-Write Safety v0.58

The durable incident upsert now treats `updated_at` monotonically, matching the existing earliest-`first_seen` and latest-`last_seen` guarantees. A delayed/stale writer therefore cannot move an incident backwards in operational time and distort `ORDER BY updated_at DESC` results or retention age.

The local contract verifies: `updated_at = GREATEST(current, incoming)`, bounded incident listing ordered by durable `updated_at DESC`, and the combined temporal invariant (`first_seen` minimum; `last_seen`/`updated_at` maximum).

Validation uses a mock pool only. No real PostgreSQL connection, migration, deployment, production write, or concurrent traffic is generated.
