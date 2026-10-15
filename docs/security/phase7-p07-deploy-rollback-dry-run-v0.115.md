# DEMOS Security Agent – Phase 7 P07 Deploy Rollback Dry-Run v0.115

## Objective
Represent P07 (`Deploy malevolo/anomalo`) end-to-end through the L3 approval-bound control plane, stopping at a provider-unbound dry-run plan. This checkpoint does not connect Render or any other deployment provider and cannot perform a rollback.

## Canonical action
`propose_deploy_rollback`

Catalog semantics:
- policy decision: `escalate`;
- approval eligible: true;
- execution-boundary eligible: true;
- effect class: `proposal_only`;
- authorized: false;
- executable: false;
- Action Runner available: false.

## P07 planner invariants
- accepts only an L3 boundary for `propose_deploy_rollback`;
- requires `approvalBound=true`, `singleUse=true`, `dryRunOnly=true`;
- rejects any boundary that claims execution capability;
- validates boundary expiry;
- validates that the hashed service reference matches the approval-bound target hash;
- rejects `currentDeployRef == healthyDeployRef`;
- rejects replay of the same approval binding;
- supports a one-way planner kill switch;
- stores only SHA-256 hashes of service/current/healthy deploy references;
- provider is always `unbound`;
- external writes are structurally false;
- no provider client, token, credential, URL, environment variable or deployment API is used.

## Exit gate
P07 is code-ready for this slice only when:
1. catalog/policy/approval/boundary/planner path is green;
2. wrong action, malformed binding, expiry, replay and kill switch fail closed;
3. no-op rollback is denied;
4. raw service/deploy references and token-like values are absent from plan/audit output;
5. GitHub Actions security validation is green on the exact PR head;
6. optional isolated staging validation, if executed, uses no provider credentials and performs no external writes.

## Non-goals
- Render adapter;
- GitHub deployment adapter;
- real rollback/redeploy;
- production credentials;
- provider write permissions;
- Action Runner production activation;
- AI auto-approval.

A future Render adapter requires a separate gate with least-privilege credentials, provider read/write scope review, explicit human authorization, rollback evidence and a production-specific kill switch.
