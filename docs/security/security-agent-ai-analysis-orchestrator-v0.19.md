# Demos Security Agent — AI Analysis Orchestrator v0.19

## Stato

CP-019 collega la pipeline deterministica degli incidenti all'AI Shadow Integration senza abilitare alcun LLM reale.

## Flusso

`Detection Engine → Incident Manager → Shadow Runner → AI Analysis Orchestrator → AI Shadow Integration`

L'orchestratore non modifica incidenti, database, configurazioni o sistemi esterni. Decide soltanto se un insieme minimo di incidenti merita una nuova analisi AI shadow.

## Selezione predefinita

- solo incidenti `open`;
- severità minima `high` (configurabile, fail-closed se non valida);
- massimo 10 incidenti per analisi;
- massimo 4 analisi per ora;
- cooldown predefinito 15 minuti;
- un incidente identico già analizzato viene deduplicato;
- un incidente cambiato viene ri-analizzato solo dopo cooldown;
- un'escalation di severità può bypassare il cooldown.

## Privacy e minimizzazione

Le chiavi usate internamente per dedup/cooldown sono hash SHA-256 troncati; lo stato pubblico dell'orchestratore non espone `incidentId`, `findingId` o altri identificatori. L'input viene comunque nuovamente minimizzato dal contratto AI v0.15 prima di raggiungere mock runner o futuro gateway.

## Rate/cost guard

L'orchestratore limita la frequenza prima del livello AI. Il Model Gateway v0.17 mantiene in aggiunta i limiti economici per richiesta, budget giornaliero, request cap e timeout. Nessuno dei due livelli può bypassare l'altro.

## Fail-closed

- orchestratore OFF di default (`SECURITY_AI_ORCHESTRATOR_ENABLED`);
- AI Shadow Integration non pronta → zero chiamate;
- errori AI ridotti a `AI_ORCHESTRATOR_ANALYSIS_FAILED`;
- dopo un errore si applica comunque il cooldown per evitare retry aggressivi;
- il runner espone solo stato e conteggi dell'analisi, mai il contenuto raw.

## Variabili previste

- `SECURITY_AI_ORCHESTRATOR_ENABLED`
- `SECURITY_AI_ORCHESTRATOR_MIN_SEVERITY`
- `SECURITY_AI_ORCHESTRATOR_COOLDOWN_MS`
- `SECURITY_AI_ORCHESTRATOR_MAX_INCIDENTS`
- `SECURITY_AI_ORCHESTRATOR_MAX_ANALYSES_PER_HOUR`

## Guardrail invariati

- nessun provider LLM reale;
- nessuna API key aggiunta;
- nessun deploy Render;
- nessuna migration Supabase;
- nessuna write su produzione;
- nessuna azione automatica;
- nessuna notifica reale;
- nessun accesso a Identity↔Research o opinioni politiche.

## Verifica

Suite mirata CP-019: 15 test. Il nucleo orchestratore è stato anche eseguito localmente in isolamento con 14/14 test verdi prima della pubblicazione.