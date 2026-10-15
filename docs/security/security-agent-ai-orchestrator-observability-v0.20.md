# CP-020 – AI Orchestrator Observability v0.20

## Obiettivo
Rendere osservabile il comportamento dell'orchestratore AI senza esporre identificatori, raw log, prompt, dati utente o segreti.

## Implementazione
- contatori cumulativi per analisi, deduplica, cooldown, soglia, incidenti chiusi, rate-limit, target non pronto, disabilitazione ed errori;
- timeline bounded delle decisioni aggregate, senza incidentId/findingId/ruleId;
- `listDecisions({limit})` read-only con limite 1–100;
- Security Center include stato e ultime decisioni dell'orchestratore;
- endpoint admin GET `/ai-orchestrator`;
- nessuna route write e nessuna capacità esecutiva aggiunta.

## Guardrail
Il provider reale resta assente; feature flag e gate di CP-017–019 restano invariati. Nessun deploy, migration, secret o accesso Identity↔Research.
