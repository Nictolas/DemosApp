# Security Agent – Alert Routing Plan & Runbook v0.12

## Scopo
Definire come gli alert P0/P1/P2/P3 verranno instradati quando il Notification Layer sarà attivato, mantenendo CP-012 completamente simulato/read-only.

## Routing previsto
- **P0** → Security Center + push + email + canale esterno secondario.
- **P1** → Security Center + push; escalation simulata a email se non riconosciuto entro 30 minuti.
- **P2** → Security Center + riepilogo.
- **P3** → Security Center + riepilogo.

## Cooldown
- P0: 5 minuti.
- P1: 15 minuti.
- P2: 60 minuti.
- P3: 6 ore.

Alert con lo stesso fingerprint (`code + scope + state`) vengono deduplicati nel periodo di cooldown. Un aumento di priorità bypassa il cooldown.

## Acknowledgment
P0 e P1 richiedono acknowledgment. In CP-012 l'acknowledgment è solo stato simulato in memoria: non esiste ancora alcuna API di scrittura Admin.

- P0: atteso entro 10 minuti.
- P1: atteso entro 30 minuti.
- P2/P3: nessun acknowledgment obbligatorio.

Dopo acknowledgment, eventuali cicli successivi restano visibili nel Security Center ma non pianificano notifiche esterne.

## Escalation simulata
- P0 non riconosciuto: nuovo piano push + email + canale esterno secondario.
- P1 non riconosciuto: aggiunta email.
- P2/P3: nessuna escalation urgente.

## Payload privacy-safe
Il routing accetta e restituisce solo: priority, code, scope, state, count, fingerprint, decisione, canali e tempi di policy. Non inoltra IP, email, account/user/participant ID, sessioni, token, raw event, payload, opinioni o dati forensi.

## Guardrail CP-012
- nessun provider push configurato;
- nessun provider email configurato;
- nessun bot Telegram/webhook configurato;
- nessun secret aggiunto;
- nessuna route POST/PATCH/DELETE aggiunta al Security Center;
- nessun deploy Render;
- nessuna migration Supabase;
- nessun invio reale: `simulated: true` è obbligatorio.

## Runbook futuro
1. Detection/health genera alert P0–P3.
2. Routing calcola fingerprint e controlla acknowledgment/cooldown.
3. Security Center mostra sempre l'alert.
4. Solo quando il Notification Layer sarà autorizzato, i canali previsti diventeranno adapter reali separati.
5. I provider esterni riceveranno payload minimizzati e mai dati Art. 9 o dettagli forensi sensibili.
6. Ogni invio reale dovrà essere auditato separatamente dal dato dell'incidente.
