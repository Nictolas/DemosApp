# CP-057 - PostgreSQL Lifecycle Consistency v0.57

The durable-store upsert previously overwrote `severity`, `status`, and `event_count` with the incoming row. A stale write could therefore undo the IncidentManager safety invariants by lowering severity/count or reopening a resolved/acknowledged incident.

The PostgreSQL upsert contract now mirrors the in-memory monotonic model: severity can only increase, event count uses `GREATEST`, resolved remains resolved, acknowledged cannot be downgraded to open, `first_seen` keeps the earliest value, and `last_seen` keeps the latest value.

Validation uses only a mock PostgreSQL pool and SQL contract assertions. No database connection, migration application, production write, or schema change is performed.
