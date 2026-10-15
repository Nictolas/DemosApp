# CP-065 - Source-State Read Parity v0.65

Source-state read behavior is now pinned across Memory and PostgreSQL stores.

The contract verifies identical source-name normalization (control whitespace collapsed, trimmed, maximum 80 characters), blank/missing names returning `null` without a PostgreSQL query, parameterized `WHERE source_name = $1` lookup with `LIMIT 1`, missing rows mapping to `null`, and defensive copies from the Memory store so caller mutation cannot alter stored state or nested totals.

The existing runtime already satisfied these invariants; no production code change was required. PostgreSQL validation uses a mock pool only. No real database, provider, migration, deployment or production write occurs.
