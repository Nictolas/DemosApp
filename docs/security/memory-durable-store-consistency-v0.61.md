# CP-061 - Memory/Durable Store Consistency v0.61

The in-memory store used by local tests and development previously replaced incident and source-state snapshots wholesale, diverging from the monotonic PostgreSQL contract. This allowed local behavior to lower incident severity/count, reopen acknowledged/resolved incidents, and move telemetry watermark/totals backwards even though the durable store would reject those regressions.

MemorySecurityStore now mirrors durable invariants: incident severity/count/timestamps are monotonic, acknowledged cannot implicitly return to open, resolved remains resolved, source watermark/timestamps/storedAt and cumulative totals cannot move backwards. Current-state fields (`enabled`, `consecutiveFailures`) remain resettable.

This closes a test/dev parity gap only. It adds no network, database, provider, execution, deployment or production capability.
