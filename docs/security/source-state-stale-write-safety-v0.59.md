# CP-059 - Source-State Stale-Write Safety v0.59

The PostgreSQL source-state upsert previously replaced watermark, telemetry timestamps and cumulative totals with every incoming snapshot. A delayed poll writer could therefore move the durable watermark backwards, make healthy telemetry appear older, or reduce cumulative counters.

The durable contract now uses monotonic `GREATEST` updates for watermark, poll/success/failure timestamps, stored timestamp, and cumulative poll/fetched/accepted/duplicate counters. `consecutive_failures` intentionally remains a current-state value rather than a monotonic counter so a successful poll can reset it to zero. `enabled` also remains current configuration state.

All validation uses a mock PostgreSQL pool. No provider call, database connection, migration, deployment or production write occurs.
