# Demos Security Agent — Security Center Health & Alert Policy v0.11

## Stato
Checkpoint CP-011. Solo branch `security/agent-foundation-v0`; nessun deploy o collegamento alla produzione.

## Obiettivo
Integrare il modello di salute del worker nel Security Center Admin e produrre una classificazione deterministica P0/P1/P2/P3 senza notifiche esterne, LLM o azioni automatiche.

## Priorità
- **P0** — almeno un incidente `critical` aperto.
- **P1** — Security Agent in stato `red` oppure almeno un incidente `high` aperto.
- **P2** — Security Agent `orange`, telemetria `degraded`/`stale`/`unknown`, oppure incidente `medium` aperto.
- **P3** — Security Agent inattivo (`gray`) oppure incidente `low`/`info` aperto.

Le priorità sono ordinate P0 → P3. La policy espone solo codici fissi, scope, conteggi e stati sanitizzati. Non incorpora raw event, IP, email, token, connection string, error message o payload sorgente.

## Security Center
L'overview read-only ora contiene:
- `shield` gray/green/orange/red;
- `health` derivato dal runtime health model;
- `alerts` con `policyVersion`, `highestPriority`, `activeCount` e lista degli alert;
- telemetria e riepilogo incidenti già privacy-safe.

Se un runtime completo è disponibile, `SecurityCenterService` usa il suo `status()`. In assenza di runtime mantiene compatibilità con il precedente `runner.status()` tramite un fallback limitato.

## Guardrail
- nessun endpoint mutativo: il router resta GET-only;
- nessuna notifica email/SMS/push/webhook;
- nessuna action automatica o blocco utenti;
- nessun LLM;
- nessun deploy Render;
- nessuna migration Supabase;
- nessuna credenziale nuova;
- nessuna write verso produzione.

## Verifica
- 8/8 nuovi test alert-policy verdi;
- 8/8 test Security Center preesistenti verdi;
- 16/16 complessivi sul blocco CP-011;
- test esplicito contro leakage di stringhe sensibili nella policy alert.

## Prossimo checkpoint
CP-012 — Alert Routing Plan & Runbook: definire canali, deduplica, cooldown, escalation e acknowledgment in modalità simulata/read-only, senza inviare ancora notifiche reali.
