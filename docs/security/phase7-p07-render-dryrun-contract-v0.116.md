# CP-117 – Phase 7 P07 Render Dry-Run Binding Contract v0.116

## Purpose

Advance P07 (`Deploy malevolo/anomalo`) by one provider-specific gate after the provider-unbound planner v0.115, while keeping DEMOS technically incapable of performing a Render rollback.

## Contract

`SecurityP07RenderDryRunContract` accepts only:

- a valid P07 provider-unbound plan already produced from the human-approved L3 boundary;
- an in-memory binding containing `serviceRef`, `currentDeployRef`, and `healthyDeployRef`.

The contract re-hashes the three raw references and requires exact equality with the hashes already frozen into the P07 plan. Raw references are never copied into the descriptor or audit.

## Hard guardrails

The returned descriptor always declares:

- `provider: render`
- `adapterMode: contract_only`
- `dryRunOnly: true`
- `networkEnabled: false`
- `credentialMode: none`
- `providerClientAvailable: false`
- `requestMaterialized: false`
- `externalWrite: false`
- `authorized: false`
- `executable: false`
- `actionRunnerAvailable: false`

The binding object is allowlisted to exactly three reference fields. Any extra field, including tokens, API keys, clients, `fetch`, base URLs, headers, or credentials, is rejected fail-closed.

## Safety checks

The gate rejects:

- non-P07 or modified plan kinds;
- provider already changed from `unbound`;
- missing approval binding / human approval flags;
- any execution-capability flag;
- malformed hashes;
- expired plans;
- service/current/healthy hash mismatch;
- no-op deploy targets;
- binding replay;
- local kill-switch state.

## Explicitly absent

This checkpoint does **not** contain:

- a Render API client;
- an HTTP request or provider URL;
- a Render API token or environment variable;
- rollback/redeploy calls;
- staging or production writes;
- an executable Action Runner path.

## Exit criterion

P07 can be translated from an approval-bound provider-unbound plan into a Render-specific, hash-bound, offline descriptor. A future network-capable adapter remains a separate gate and must not inherit approval merely from this checkpoint.
