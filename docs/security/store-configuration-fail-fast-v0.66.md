# CP-066 - Store Configuration Fail-Fast Contract v0.66

Store constructor/configuration safety is now pinned by regression tests.

Both stores reject retention windows below one hour and non-integer/non-finite retention values. MemorySecurityStore rejects invalid `maxIncidents` values outside 1..100000. PostgresSecurityStore requires the runtime pool to expose both `query()` and `connect()`, and validates the optional maintenance pool eagerly with the same capability contract. Default configurations remain valid and bounded.

The existing runtime already satisfied these invariants, so no production code change was required. Tests use local mock pools only; no database, provider, migration, deployment or production write occurs.
