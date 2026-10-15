# CP-064 - Store Read/Stats Parity v0.64

The Memory and PostgreSQL stores now share explicit read semantics for incident listing and aggregate statistics.

The parity contract covers status/severity filtering, newest-first ordering, parameterized PostgreSQL predicates, bounded limits (1..1000), rejection of invalid filters, and the common stats shape (`incidentCount`, `sourceCount`, `bySeverity`, `byStatus`).

The contract exposed one real dev/test divergence: MemorySecurityStore silently accepted invalid status/severity filters while PostgreSQL rejected them. Memory now fails closed on invalid filters too, preventing local tests from hiding malformed queries.

PostgreSQL validation uses mock pools only. No real database, provider, migration, deployment or production write occurs.
