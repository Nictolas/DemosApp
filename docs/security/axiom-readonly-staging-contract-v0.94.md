# CP-094 – Dedicated Axiom Read-Only Staging Provider v0.94

## Scope

Security Agent telemetry is isolated from the application's generic Axiom integration.
The Security Agent no longer inherits `AXIOM_API_TOKEN`, `AXIOM_ORG_ID`, or `AXIOM_REALTIME_DATASET` for its shadow source.

## Dedicated non-production contract

The Security Agent uses only the dedicated `SECURITY_AGENT_AXIOM_*` namespace:

- `SECURITY_AGENT_AXIOM_ENABLED`
- `SECURITY_AGENT_AXIOM_QUERY_ONLY`
- `SECURITY_AGENT_AXIOM_REGION`
- `SECURITY_AGENT_AXIOM_DATASET`
- `SECURITY_AGENT_AXIOM_API_TOKEN`
- `SECURITY_AGENT_AXIOM_ORG_ID`
- `SECURITY_AGENT_AXIOM_TIMEOUT_MS`

When the shadow source is enabled under staging isolation, the provider fails closed unless:

- environment class is `staging`;
- query-only is explicitly declared;
- region is `eu`;
- dataset name is explicitly non-production and is not `real-time`;
- a dedicated API token and organization ID are present;
- runtime remains memory-only;
- database writers, retention writers and Action Runner remain disabled.

## Runtime behavior

`SecurityAxiomReadOnlyProvider` exposes only bounded query behavior to the Security Agent. It exposes no ingest/write method, reports `writeAccess=false` and `executable=false`, and collapses provider errors to generic codes.

The staging start command now boots a combined read-only stack. With `SECURITY_AGENT_PROCESS_ENABLED=false`, behavior remains Security Center-only. With the process flag enabled and all isolation gates passing, the same dedicated staging service can run the shadow worker and bind Security Center to its in-memory runner/store/runtime state. Startup fails closed if the worker cannot start.

The existing source heartbeat remains deterministic: successful Axiom polls refresh source state; stale telemetry can only create the internal `DET-TELEMETRY-GAP` incident. It does not write to Axiom or production systems.

## Local validation

- dedicated Axiom provider tests: PASS;
- staging isolation/provider readiness/stack/server targeted suite: 30/30 PASS;
- secret scan: PASS;
- `git diff --check`: PASS;
- full security pre-CI including client production build: PASS.

## Pending live validation

Live Phase 1 closure still requires a dedicated EU non-production Axiom dataset and a dedicated query-only token. Those credentials must be supplied only to `demos-security-staging`; production services and generic Axiom credentials must remain untouched.
