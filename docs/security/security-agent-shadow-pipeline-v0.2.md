# Demos Security Agent — Checkpoint 2: Shadow Pipeline

## Stato

**Shadow/read-only. Non collegato al runtime di produzione.**

Questo checkpoint collega il nucleo v0.1 alle forme di evento già prodotte da Demos, senza leggere direttamente provider esterni e senza eseguire azioni.

## Fonti compatibili

1. `api/middleware/securityMonitoring.js`
   - `failed_login`
   - `admin_access`
   - `suspicious_request`
   - alert derivati come `brute_force_attempt`, `excessive_admin_access`, `rate_limit_exceeded`
2. `api/services/violationDetectionService.js`
   - `SECURITY_BREACH`
   - `UNAUTHORIZED_ACCESS`
   - `SUSPICIOUS_ACTIVITY`
   - `DATA_BREACH`
   - `CONSENT_VIOLATION`
   - `RETENTION_VIOLATION`
   - `AUDIT_FAILURE`
   - `SYSTEM_ERROR`

## Privacy boundary

Gli adapter NON trasferiscono alla pipeline:

- `user_id` / `account_id` / `participant_id`
- email
- IP
- session ID
- token/cookie/authorization
- descrizioni raw che potrebbero incorporare identificatori
- opinioni o contenuto politico
- request body/payload

Sono ammessi solo metadati tecnici minimizzati (es. contatori, metodo HTTP, finestra temporale).

## Pipeline

`legacy event -> privacy adapter -> SecurityCollector -> DetectionEngine -> IncidentManager`

La pipeline mantiene solo memoria volatile in questa fase. Nessuna tabella, nessun deploy, nessuna API admin e nessun sink esterno sono attivati.

## Deduplicazione

Gli adapter generano un `eventId` deterministico usando solo campi non identificativi. Poll ripetuti della stessa fonte non devono gonfiare i contatori.

## Regole aggiunte

- brute force già rilevato dal monitor Demos
- accessi admin eccessivi
- suspicious request
- unauthorized access
- security breach
- data breach
- audit failure

Restano attive anche le regole v0.1 per burst login, rate-limit, integrity failure e telemetry gap.

## Guardrail invariati

- nessuna write Render/Supabase/GitHub
- nessun deploy
- nessun LLM nel detection path
- nessun accesso Identity↔Research
- nessuna lettura di opinioni politiche
- nessun secret nel Security Agent

## Prossimo checkpoint

Aggiungere una `ReadOnlySecuritySource` dietro feature flag **off di default**, con cursor/watermark e heartbeat, per leggere in shadow mode da Axiom senza duplicare eventi e senza inviare PII alla pipeline.
