# Demos Security Agent Foundation v0.1

## Scopo

Primo nucleo deterministico e **shadow/read-only** del futuro Demos Security Agent.
Questa fase non modifica Render, Supabase, GitHub, account, sessioni o dati applicativi.

## Componenti

- `SecurityCollector`: normalizza e mantiene un buffer limitato di eventi security.
- `SecurityEvent`: schema minimo e privacy-safe; scarta metadata direttamente identificativi o sensibili.
- `DetectionEngine`: regole deterministiche indipendenti da qualsiasi LLM.
- `IncidentManager`: deduplicazione e lifecycle degli incidenti in memoria.

## Guardrail v0.1

1. Nessuna write verso produzione.
2. Nessuna credenziale provider richiesta.
3. Nessun accesso a Identity↔Research, opinioni politiche, token, secret o request body.
4. Metadata evento limitati a primitivi e sottoposti a allow-by-exclusion per chiavi sensibili.
5. Detection primaria deterministica: un futuro LLM potrà spiegare/correlare, non sostituire le regole P0.
6. Incident storage solo in memoria in questa fase; persistenza e audit immutabile saranno introdotti separatamente.

## Prime regole

- burst di login falliti;
- burst di login admin falliti;
- surge di rate-limit;
- failure di integrity/security check;
- perdita di heartbeat/telemetria.

## Non incluso

- AI Analyst;
- Policy Engine;
- Action Runner;
- blocco IP/sessioni;
- dashboard Admin;
- notifiche esterne;
- persistenza incidenti;
- deploy automatico.

Queste capacità verranno aggiunte solo dopo aver validato qualità degli eventi e delle regole in shadow mode.
