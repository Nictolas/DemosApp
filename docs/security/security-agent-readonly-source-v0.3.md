# Demos Security Agent — Checkpoint 3: Read-only Axiom Source

## Stato

**Implementato nel branch, feature flag OFF di default, nessun deploy.**

Il Security Agent dispone ora di una sorgente read-only capace di interrogare il canale security già esistente e alimentare la Shadow Pipeline.

## Feature flag

`SECURITY_AGENT_SHADOW_ENABLED=true`

Senza il valore esplicito `true`:

- non viene eseguita nessuna query;
- non viene avviato alcun timer;
- non esiste alcun side effect sul runtime.

Il file non è collegato a `server.js` in questo checkpoint.

## Polling

La sorgente usa:

- finestra iniziale limitata;
- watermark sull'ultimo evento osservato;
- overlap temporale per tollerare eventi arrivati in ritardo;
- event ID deterministici e deduplicazione nella pipeline;
- batch massimo configurabile.

Gli eventi raw letti dalla fonte non vengono persistiti dal Security Agent: passano immediatamente nell'adapter privacy-safe.

## Error handling

Gli errori del provider non vengono copiati nell'output operativo. La pipeline espone solo `SECURITY_SOURCE_POLL_FAILED`, evitando di propagare eventuali token, URL o dettagli sensibili contenuti nelle eccezioni upstream.

## Heartbeat

Se una sorgente abilitata non completa un poll con successo entro la soglia:

`ReadOnlySecuritySource -> heartbeat.missed -> DET-TELEMETRY-GAP -> IncidentManager`

Il heartbeat non contiene utenti, IP, sessioni, opinioni o secret.

## Cosa NON fa ancora

- nessun timer/cron automatico;
- nessun collegamento a `server.js`;
- nessuna API Admin;
- nessuna persistenza incidenti;
- nessuna notifica;
- nessun LLM;
- nessuna azione automatica.

## Prossimo checkpoint

Persistenza separata e minimale degli incidenti / event store security, oppure prima un runner shadow esplicitamente attivabile in ambiente non-production per validare il polling end-to-end.
