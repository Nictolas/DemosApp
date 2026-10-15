# Phase 7 L3 Approval-Bound Control-Plane Pre-Gate v0.114

Issue: #173
Checkpoint: CP-114

## Scope

This pre-gate advances Phase 7 only at the control-plane level. It does not authorize or enable operational L3 automation.

The implementation must remain:

- shadow / non-executable;
- dry-run only;
- without production provider adapters;
- without provider credentials or environment changes;
- without external writes or side effects;
- fail-closed on malformed, expired, replayed or context-mismatched approvals.

## Binding contract

Every approval is bound to the exact tuple:

`incidentId + action + targetHash + policyVersion`

The raw target is not stored in the approval record or audit log. The human actor reference is also represented only by a SHA-256 hash in audit evidence.

A boundary may be issued only when:

1. the approval was explicitly decided by a human source;
2. the approval is approved and not expired;
3. the supplied incident, action, target and policy snapshot match the original binding;
4. the approval has not previously been consumed;
5. the global kill switch is not engaged.

Even after all checks pass, the returned boundary is explicitly:

- `authorized: false`
- `executable: false`
- `actionRunnerAvailable: false`
- `dryRunOnly: true`

## Required negative tests

- wrong incident -> deny;
- wrong action -> deny;
- wrong target -> deny;
- wrong policy snapshot -> deny;
- expired approval -> deny;
- replay / second consume -> deny;
- rejected approval -> deny;
- AI or missing human decision source -> deny;
- kill switch engaged -> deny;
- malformed or unknown action -> deny;
- audit must not contain raw target, actor reference, token or secret values.

## Production invariant

This branch must not alter production configuration or connect the control plane to GitHub, Render, Neon, Firebase or any other write-capable provider. A future least-privilege adapter, if ever introduced, requires a separate gate, dedicated credentials, dry-run qualification, human approval, rollback and kill-switch evidence.
