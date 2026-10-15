# CP-025 – Approval Decision Simulation v0.25

Aggiunge una simulazione deterministica delle decisioni umane `approved` e `rejected` e un audit in memoria minimizzato. Anche `expired` viene registrato.

L'audit contiene solo timestamp, tipo evento, approvalId tecnico, tipo proposta, priorità, stato ed `executable=false`. Non conserva raw log, prompt, identità, IP, token o secret.

La simulazione non è esposta da endpoint HTTP. Security Center resta GET-only. `executionEnabled=false`, `actionRunnerAvailable=false`, `simulationOnly=true`: una decisione approved non può produrre alcuna mitigazione reale.
