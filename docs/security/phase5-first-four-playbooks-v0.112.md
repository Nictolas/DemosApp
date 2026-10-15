# DEMOS Security Agent – Phase 5 First Four Playbooks v0.112

## Objective
Qualify P01–P04 as reversible, synthetic-only playbooks inside the isolated Action Runner sandbox. This checkpoint does not authorize production automation and does not connect the sandbox to external services.

## Playbooks
- **P01 – Brute force login:** synthetic temporary rate-limit lease; TTL rollback.
- **P02 – Suspicious token/session:** synthetic session-revocation lease; explicit rollback.
- **P03 – Secret found in commit:** synthetic pipeline-block lease; explicit rollback after synthetic remediation.
- **P04 – Critical dependency CVE:** synthetic vulnerable-deploy-block lease; explicit rollback after synthetic remediation.

## Invariants
- staging isolation required;
- memory-only runtime;
- target must begin with `synthetic:`;
- explicit sandbox authorization required;
- approved playbook-matching action required;
- bounded TTL required;
- every action is reversible;
- emergency kill switch rolls back all active playbooks;
- `productionWriteAllowed=false`;
- `externalClientsAllowed=false`;
- no production adapters, deployment API clients, GitHub mutation clients, DB writers, Redis writers, or Firebase writers are used by the sandbox.

## Exit gate
Phase 5 first-four-playbook sandbox gate is green only if:
1. P01–P04 execute as synthetic leases;
2. P03/P04 rollback succeeds;
3. production-like targets and mismatched approvals fail closed;
4. kill switch rolls back all four active playbooks;
5. GitHub CI is green;
6. the same branch passes on isolated Render staging.

Production-capable automation requires a separate future authorization and least-privilege adapter review.
