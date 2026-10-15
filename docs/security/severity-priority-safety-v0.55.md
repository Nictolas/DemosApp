# CP-055 - Severity, Priority and False-Positive Safety v0.55

Local deterministic invariants now protect the Phase 2 severity model and its hand-off to alert/policy layers.

- Detection severities map monotonically: critical→P0, high→P1, medium→P2, low/info→P3.
- Adding lower-severity incidents cannot de-escalate a higher-priority alert.
- Invalid, zero and negative incident counts cannot create incident alerts.
- Unknown actions and invalid priorities fail closed.
- P0 and explicit human-review cases always escalate and remain `executable:false`.
- Policy status must continue to expose `actionRunnerAvailable:false` and unknown decisions default to deny.

These checks address local false-positive/priority safety only. They do not establish production thresholds, precision/recall, or staging RT completion.
