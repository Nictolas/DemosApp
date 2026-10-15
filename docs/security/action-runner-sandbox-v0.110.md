# DEMOS Security Agent – Action Runner Sandbox v0.110

## Scope
This checkpoint introduces only an isolated synthetic Action Runner sandbox for defensive validation of Phase 5 / RT10. It is not wired into the DEMOS production application, Security Center, Render production services, databases, Redis, Firebase, deployment APIs, or any external provider.

## Hard guardrails
- Disabled unless `SECURITY_ACTION_RUNNER_SANDBOX_ENABLED=true`.
- Requires `SECURITY_AGENT_STAGING_ISOLATION_REQUIRED=true`.
- Requires `SECURITY_AGENT_ENVIRONMENT_CLASS=staging`.
- Requires memory-only runtime.
- Production writes are always forbidden.
- External clients are always forbidden.
- Targets must start with `synthetic:`.
- Only reversible synthetic representations of `propose_rate_limit` and `propose_session_revocation` are allowed.
- Runner starts with kill switch engaged.
- Explicit sandbox authorization is required before execution.
- Approved action record is required for every synthetic action.
- Every effect has a TTL and supports rollback.
- Kill switch rolls back every active synthetic lease and blocks further execution.
- Audit output contains only bounded synthetic identifiers and never secrets or payloads.

## RT10 acceptance target
RT10 is considered technically testable when the isolated sandbox demonstrates all of the following without touching production:
1. one or more reversible synthetic actions can be activated after explicit sandbox authorization;
2. the emergency kill switch rolls back all active actions;
3. the kill switch blocks subsequent action execution;
4. TTL expiration rolls back temporary effects;
5. non-synthetic targets, unsupported actions, missing approval, and production configuration fail closed;
6. audit evidence records execution, rollback, and emergency stop.

## Non-goals
This checkpoint does not authorize L1/L2 automation in production. It does not change the existing production execution boundary, which remains non-executable, and does not enable Security Center or an Action Runner in production.
