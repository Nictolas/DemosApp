# Demos Security Agent — guardrail architecture

Status: design / CI guardrail. No production autonomy.

## Purpose

The Security Agent is a defense layer around Demos, not a replacement for deterministic security controls, external review, penetration testing or human approval.

It reviews proposed changes and security signals against machine-checkable Demos invariants and can open findings or draft remediation PRs. It must not deploy, rotate production secrets, alter production databases, weaken controls, or merge its own changes.

## Non-negotiable Demos invariants

1. Identity may know the verified account/person but must never persist the mapping to a Research participant or opinions.
2. Research must reject direct Identity handles such as account_id, user_id, email and CIE/SPID/OIDC subject.
3. A verified real person may have only one active Demos account under the approved Identity uniqueness policy.
4. Citizen political vectors/opinions must not be sent to an identified backend for matching.
5. Public politician/candidate data may be used for matching, while ordinary user discovery remains constrained by the product's matching flow.
6. Aggregate/statistical outputs must be produced from the pseudonymous Research domain with freshness/TTL, methodology and anti-reidentification controls.
7. Logs, traces, analytics and error reports must not recreate the Identity-to-Research link.
8. Privacy/security schema, grants, RLS and production migrations require explicit human review.

## Layered checks

Deterministic CI should run before AI review:
- secret scanning;
- dependency/SCA and lockfile review;
- SAST;
- tests for Identity/Research boundary fields;
- tests for RLS/grant/schema invariants;
- logging/privacy regression tests;
- route/authentication and rate-limit regression tests;
- later, DAST against an isolated environment.

The AI layer then receives the diff plus sanitized findings and:
- explains likely exploit/privacy impact;
- checks architectural invariants that span files;
- identifies suspicious data flows;
- proposes tests and remediation;
- may prepare a draft PR.

## Permissions

Default permissions are read-only repository metadata/code plus permission to create findings or draft PRs.

Forbidden without explicit human action:
- production deploy;
- production DB/schema/data mutation;
- secret creation/rotation;
- changing branch protection;
- merging its own PR;
- suppressing a failing deterministic security gate;
- accessing raw citizen opinion datasets together with Identity data.

## Fail-safe behavior

A model error must not become a production security decision. Deterministic high-severity gates fail closed. AI findings are advisory until converted into a reviewed deterministic rule or explicitly approved remediation.

Inputs to an external model must be minimized and scrubbed of secrets and personal data. Production logs should be summarized/redacted before AI analysis.

## Implementation phases

1. Codify Demos invariants as tests/policies.
2. Add deterministic CI scanners and one consolidated security job.
3. Add an AI reviewer with read-only context and structured findings.
4. Allow draft remediation PRs, never self-merge.
5. Add isolated DAST/security test environment.
6. Add alert triage from sanitized security telemetry.
7. Periodically validate the agent itself with adversarial test cases.

This design is compatible with an OpenAI-powered component, but the security boundary must not depend on a ChatGPT Plus conversation. A continuously running agent should use a dedicated service/API identity with least privilege and auditable actions.
