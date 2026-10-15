# CP-052 - Phase 0/1 Evidence Consolidation v0.52

## Scope
Local-only evidence consolidation for Roadmap Phase 0 (inventory) and Phase 1 (observability). This checkpoint does not claim staging, production, provider, or infrastructure validation.

## Phase 0 inventory and classification
The Security Agent boundary is intentionally narrower than the whole DEMOS application. Assets relevant to this checkpoint are classified as follows:

| Asset / flow | Classification | Agent access | Local evidence | Status |
| --- | --- | --- | --- | --- |
| Application security events | Security telemetry, minimized | Read-only | `securityEvent.js`, `securityCollector.js` | Implemented locally |
| Axiom security source | External telemetry source | Read-only, feature flag OFF by default | `readOnlySecuritySource.js` | Implemented locally; runtime/provider not verified here |
| Incident summaries | Minimal security metadata | Read/write only inside isolated Security Store contract | `securityStore.js`, `postgresSecurityStore.js` | Contract implemented; production migration not applied |
| Identity / CIE data | Restricted identity data | No direct access | foundation privacy boundary + event redaction tests | Excluded from Agent payloads by design |
| Political opinions / Research data | Special-category/high sensitivity | No direct access | foundation privacy boundary + event redaction tests | Excluded from Agent payloads by design |
| Security Center | Operational security metadata | GET/read-only surface | Security Center route/response contracts | Implemented locally |
| AI Analyst | Redacted incident context | Shadow/read-only | analyst contract/model gateway tests | Implemented locally; real provider not connected |
| Policy / approval / execution boundary | Security decisions | Simulation/non-executable | policy, approval and boundary modules | Implemented locally; Action Runner unavailable |

### Data-flow boundary
`telemetry source -> privacy-safe adapter/collector -> deterministic detection -> incident summary -> isolated store -> read-only Security Center -> optional shadow AI analysis`.

No Identity-to-Research mapping, raw political content, raw request body, token, secret, session identifier, email, or IP is required by this flow. The local evidence gate checks that the documented shadow/execution guardrails still exist.

### Threat-model scope
The current deterministic controls explicitly cover authentication bursts, admin authentication failures, suspicious application requests, rate-limit surges, unauthorized access signals, breach signals, integrity failures, audit failures, and telemetry gaps. The broader application threat model remains represented by `Gap Assessment v1`; this checkpoint does not mark its infrastructure remediation items complete.

## Phase 1 observability evidence
Locally demonstrated components:
- bounded `SecurityCollector` and privacy-safe `SecurityEvent` contract;
- read-only source with explicit shadow feature flag and bounded polling;
- deterministic heartbeat gap detection;
- minimal incident store contract and retention behavior;
- runtime health model with sanitized failure states;
- read-only Security Center contracts with bounded query/response policies.

Not claimed by this checkpoint:
- live Axiom credentials or current provider availability;
- 100% production P0 source coverage;
- production retention configuration;
- applied PostgreSQL security-store migration;
- production dashboard/deployment status.

Therefore Phase 1 remains operationally **in progress** even though its local software evidence is complete enough to gate subsequent local work.

## Local gate
`scripts/security-phase-evidence-gate.js` verifies that every required Phase 0/1 local evidence item has a repository or Sheet mapping and that shadow/non-executable guardrails remain present. Sheet references are evidence pointers, not proof of live infrastructure state.

## External validation backlog
Before either phase can be declared operationally complete, verify in an isolated/staging context: actual telemetry-source coverage, provider heartbeat, retention, deployed read-only access boundaries, and the relevant infrastructure items from Gap Assessment v1. No such validation is executed in CP-052.
