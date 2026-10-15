# Demos Security Agent — Checkpoint 4: Shadow Runner + Minimal Security Store

## Stato

**Implementato nel branch Security, OFF di default, nessun deploy e nessun collegamento a `server.js`.**

Questo checkpoint aggiunge il processo di orchestrazione della pipeline shadow e un primo Security Store minimale in memoria, usato per definire il contratto di persistenza senza introdurre ancora un database di produzione.

## Shadow Runner

Il runner coordina:

`ReadOnlySecuritySource -> ShadowSecurityPipeline -> IncidentManager -> Security Store`

Il runner:

- non parte all'import del modulo;
- è disabilitato salvo `SECURITY_AGENT_RUNNER_ENABLED=true`;
- rifiuta cicli concorrenti (`skipped_busy`);
- esegue poll + heartbeat;
- persiste solo riassunti degli incidenti e stato tecnico della sorgente;
- riduce gli errori imprevisti a `SECURITY_RUNNER_FAILED`;
- può essere avviato/fermato esplicitamente tramite `start()` / `stop()`.

La sorgente Axiom conserva inoltre il proprio gate separato `SECURITY_AGENT_SHADOW_ENABLED=true`: quindi l'attivazione futura richiederà intenzionalmente entrambi i livelli.

## Minimal Security Store

`MemorySecurityStore` è volutamente effimero e serve a validare il contratto del futuro store persistente.

Campi ammessi per incidente:

- `incidentId`
- `findingId`
- `ruleId`
- `severity`
- `status`
- `count`
- `firstSeen`
- `lastSeen`
- `createdAt`
- `updatedAt`

Non vengono persistiti:

- raw events;
- IP;
- user/account/participant ID;
- email;
- session ID;
- token/segreti;
- payload/body/query;
- descrizioni raw;
- opinioni o contenuti politici;
- titolo libero dell'incidente.

Lo stato della sorgente conserva soltanto watermark, timestamp tecnici, contatori e stato enable/health.

## Retention

Il contratto include pruning configurabile. Il valore di default del prototipo è 90 giorni, ma **non è ancora una policy GDPR definitiva**: la retention finale sarà definita insieme al lavoro Privacy/DPIA prima dell'attivazione persistente.

## Store persistente futuro

Il prossimo store durevole dovrà rispettare questi vincoli:

1. credenziali dedicate, separate da `DATABASE_URL` dell'app;
2. nessun foreign key verso Identity, Research o tabelle utenti;
3. nessuna copia di raw log Axiom;
4. cifratura e minimo privilegio;
5. retention automatica e audit delle operazioni;
6. accesso read-only dal futuro Security Center, salvo funzioni di incident management esplicitamente autorizzate.

Il candidato previsto è un PostgreSQL/schema security dedicato tramite una futura `SECURITY_AGENT_DATABASE_URL`; **questo checkpoint non crea né modifica alcuna tabella Supabase**.

## Feature flags

- `SECURITY_AGENT_SHADOW_ENABLED=true` — consente alla sorgente read-only di interrogare Axiom.
- `SECURITY_AGENT_RUNNER_ENABLED=true` — consente al runner di eseguire cicli.
- `SECURITY_AGENT_RUNNER_INTERVAL_MS` — intervallo futuro, minimo 10 secondi e massimo 1 ora.

Nessuno di questi flag viene impostato o attivato dal codice del checkpoint.

## Verifica

Nuova suite dedicata `api/tests/securityAgentRunner.test.js`: **8/8 test passati localmente**.

Baseline precedente: `api/tests/securityAgentFoundation.test.js` **18/18 verde** nel Checkpoint 3 e non modificata in questo blocco.

## Cosa NON fa ancora

- nessuna persistenza PostgreSQL;
- nessuna API Admin / Security Center;
- nessuna notifica esterna;
- nessun processo continuo attivato su Render;
- nessun LLM;
- nessun Policy Engine;
- nessuna azione automatica sulla produzione.

## Prossimo checkpoint

Implementare un **durable Security Store separato** dietro feature flag, con schema minimale e credenziali dedicate, oppure costruire prima l'API read-only del Security Center sopra il contratto in-memory. Prima di qualsiasi deploy continuo va deciso anche il modello di hosting del runner e la retention finale.
