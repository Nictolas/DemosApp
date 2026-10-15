# Demos Security Agent — Shadow Runtime Packaging v0.9

## Obiettivo
Preparare il Security Agent come processo/worker separato dal backend Demos, senza collegarlo ancora a Render o alla produzione.

## Avvio fail-closed
Il worker parte solo se sono veri contemporaneamente:
- `SECURITY_AGENT_PROCESS_ENABLED=true`;
- `SECURITY_AGENT_SHADOW_ENABLED=true`;
- `SECURITY_AGENT_RUNNER_ENABLED=true`.

Con qualunque combinazione incompleta il runtime resta `disabled` e non interroga Axiom né apre connessioni DB.

## Modalità
### `memory`
- predefinita per sviluppo/test;
- nessuna credenziale DB;
- vietata quando `NODE_ENV=production` e il processo è abilitato;
- gli incidenti spariscono al riavvio.

### `postgres`
- destinata al futuro shadow runtime durevole;
- passa obbligatoriamente dal Credential & Migration Gate CP-008;
- richiede writer login dedicato, policy retention approvata e TLS verificato;
- non abilita il maintenance credential né DELETE.

## Scheduler e lifecycle
- scheduler del worker separato da `server.js`;
- intervallo 10s..1h (`SECURITY_AGENT_RUNNER_INTERVAL_MS`);
- primo ciclo non immediato salvo `SECURITY_AGENT_RUN_IMMEDIATELY=true`;
- anti-doppio avvio;
- attesa del ciclo in-flight durante lo shutdown;
- chiusura delle risorse/pool;
- gestione `SIGTERM`/`SIGINT`;
- nessun auto-deploy e nessun servizio Render creato in CP-009.

## Logging/status
Il worker emette solo eventi tecnici minimali (`boot`, `not_started`, `shutdown`, `fatal`). Lo status non contiene connection string, password, host, token, raw event, IP, user/account/participant ID o opinioni.

## Comandi predisposti
- `npm run start:security-agent-shadow` — entrypoint worker separato;
- `npm run test:security-agent` — suite Security Agent.

## Guardrail
- nessun LLM;
- nessuna action automatica;
- nessun mount nel backend;
- nessuna migration o credenziale creata;
- nessun secret su Render;
- nessuna modifica alla linea Privacy/GDPR.

## Gate successivo
CP-010 dovrà preparare health/telemetry del worker e la configurazione Render **come bozza/non deployata**, oppure proseguire con test di fault injection locali. Il deploy reale resta bloccato dalla retention Privacy/DPIA e dal DB gate.
