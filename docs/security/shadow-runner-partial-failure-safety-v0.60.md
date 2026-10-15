# CP-060 - ShadowRunner Partial-Failure Safety v0.60

Fault-injection tests now pin the persistence ordering and failure behavior of the shadow runner.

- Incident persistence runs before source-state persistence; an incident-store failure cannot advance durable source state.
- Source-state persistence runs before maintenance/prune; a state-store failure cannot proceed to maintenance.
- Persistence errors are reduced to the generic `SECURITY_RUNNER_FAILED` code and do not leak underlying error text.
- `inFlight` is always released after a failed cycle, so a later retry can run.
- A successful cycle preserves the explicit order: incidents → source state → maintenance.

No runtime change was required because the current implementation already satisfies these fail-closed invariants. Tests use fault-injected local objects only: no PostgreSQL, provider, network, migration, deployment or production write.
