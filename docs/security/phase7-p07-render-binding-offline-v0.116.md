# DEMOS Security Agent – Phase 7 P07 Render Binding Contract v0.116

## Objective
Bind an already human-approved P07 dry-run rollback plan to the provider name `render` without creating any Render API client or network capability.

This is an offline contract only. It exists to prove that provider-specific rebinding can remain fail-closed before any future adapter is considered.

## Input requirements
- a valid P07 plan produced by the provider-unbound planner;
- `approvalBound=true`, `singleUseBoundary=true`, `humanApprovalRequired=true`, `dryRunOnly=true`;
- provider state of the plan must still be `unbound`;
- `authorized=false`, `executable=false`, `actionRunnerAvailable=false`, `externalWrite=false`;
- raw service/current/healthy deploy references are accepted only transiently in memory to recompute SHA-256 and verify they match the plan hashes.

## Forbidden input
Any payload field named as a credential/client/network primitive is rejected recursively, including credential(s), client, fetch, baseUrl, header(s), token, apiKey, authorization, password and secret.

## Output
The descriptor contains only minimized metadata and hashes:
- provider=`render`;
- mode=`offline_descriptor`;
- networkEnabled=false;
- transportEnabled=false;
- externalWrite=false;
- credentialFieldsAccepted=false;
- providerClientAvailable=false;
- authorized=false;
- executable=false;
- actionRunnerAvailable=false.

No URL, provider token, authorization header, credential or raw service/deploy reference is retained in the descriptor or audit.

## Safety gates
- service/current/healthy deploy hash mismatch -> deny;
- altered action/provider/capability state -> deny;
- non approval-bound plan -> deny;
- replay of the same binding -> deny;
- local kill switch -> deny all new bindings;
- audit remains hash-only and non-executable.

## Non-goals
- Render API calls;
- HTTP/fetch transport;
- API keys or service credentials;
- rollback/redeploy execution;
- staging or production write;
- Action Runner production activation.

Any network-capable Render adapter requires a later separate gate and explicit authorization, beginning with the narrowest possible read-only scope before any write permission is considered.
