# CP-026 – Approval Observability Integration v0.26

Integra nel Security Center l'audit simulato dell'Approval Gate in sola lettura. La risposta `GET /approvals` continua a usare la route admin già esistente e ora include anche un audit bounded; l'overview include gli ultimi eventi di approval.

L'audit resta minimizzato: timestamp, tipo evento, approvalId tecnico, tipo proposta, priorità, stato ed `executable=false`. Raw log, prompt, identità, IP, token e secret non vengono acquisiti dal modello di osservabilità.

Non viene aggiunta alcuna route write. `approved` resta una decisione simulata: `executionEnabled=false`, `actionRunnerAvailable=false`, nessuna mitigazione reale, nessun deploy e nessun provider LLM reale.
