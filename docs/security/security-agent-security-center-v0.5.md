# Demos Security Agent — Checkpoint 5: Security Center Read-Only

## Stato

**Implementato nel branch Security, non montato su `server.js`, nessun deploy.**

Questo checkpoint definisce il contratto read-only che alimenterà la futura sezione Admin **Security Center** di Demos.

## Obiettivo

Esporre agli amministratori solo informazioni operative già minimizzate dal Security Agent:

- stato generale con indicatore a scudo;
- stato del runner;
- salute della telemetria;
- conteggio incidenti aperti;
- severità massima aperta;
- lista incidenti con soli metadati minimi.

Il browser Admin non deve interrogare direttamente Axiom né ricevere raw security events.

## Semaforo / scudo

- `gray` — runner disattivato; evita di mostrare un falso stato verde;
- `green` — agente attivo, telemetria sana, nessun incidente high/critical aperto;
- `orange` — high aperto, telemetria stale/degraded oppure runner degraded;
- `red` — critical aperto oppure runner in errore.

## API prevista

Il router è **GET-only**:

- `GET /overview`
- `GET /incidents`
- `GET /health`

Non esistono route `POST`, `PUT`, `PATCH` o `DELETE` in questo checkpoint.

Il router richiede esplicitamente middleware `verifyToken` e `requireAdmin`, ma **non è ancora montato nell'applicazione**.

## Privacy e minimizzazione

La risposta del Security Center può includere solo:

- `incidentId`
- `findingId`
- `ruleId`
- `severity`
- `status`
- `count`
- timestamp di ciclo vita dell'incidente
- stato tecnico runner/telemetria e contatori aggregati

Campi extra eventualmente presenti nello store vengono scartati nuovamente dal read model prima della risposta.

Sono esclusi:

- IP;
- email;
- user/account/participant ID;
- session ID;
- token/secret;
- request/response body;
- raw event;
- contenuti politici o risposte/opinioni.

## Error handling

Gli handler restituiscono solo il codice generico:

`SECURITY_CENTER_READ_FAILED`

Le eccezioni interne non vengono propagate al client.

## Test

Nuovi test CP-005:

- stato green sano;
- critical → red;
- high/stale → orange;
- runner disattivato → gray;
- doppia sanitizzazione dei campi incident;
- filtri allowlist su severity/status e limite massimo;
- errori API senza leak;
- router verificato GET-only.

## Cosa NON fa ancora

- nessun rendering React della dashboard;
- nessun mount su `server.js`;
- nessun durable Security Store;
- nessuna notifica push/email/Telegram;
- nessun LLM;
- nessuna azione automatica;
- nessun accesso diretto del frontend ad Axiom/Supabase security data.

## Prossimo checkpoint

Definire il **durable Security Store** separato e il suo schema, mantenendo nessun FK verso Identity/Research. La retention definitiva va sincronizzata con il lavoro Privacy/DPIA prima di applicare migrazioni a Supabase.
