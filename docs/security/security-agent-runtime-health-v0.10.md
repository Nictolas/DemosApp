# Demos Security Agent — Runtime Health & Fault Injection v0.10

## Obiettivo
Rendere osservabile il worker shadow senza esporre dati sensibili e verificare che guasti della telemetria o shutdown non trasformino un problema operativo in un problema di sicurezza.

## Health model
Il runtime espone un modello a quattro livelli:
- `gray`: componente disabilitato o fermato;
- `green`: runtime in esecuzione con ciclo recente riuscito;
- `orange`: degradato (ultimo ciclo fallito/degradato, nessun successo recente, runtime pronto ma non avviato);
- `red`: critico (ciclo bloccato oltre soglia o almeno 3 fallimenti consecutivi).

Il modello usa solo metadati operativi minimizzati: stato, tempi, contatori e ragioni codificate. Non include errori raw, URL, host, token, payload o identificatori.

## Telemetria runtime aggiunta
- `inFlight` e `inFlightStartedAt`;
- `lastCycleDurationMs`;
- `lastSuccessAt` / `lastFailureAt`;
- `consecutiveFailures` / `totalFailures`;
- reset dei fallimenti consecutivi dopo un ciclo `ok`;
- metodo `runtime.health()`.

## Fault injection locale
Testati:
1. worker disabilitato;
2. ciclo riuscito;
3. upstream/Axiom che restituisce errore;
4. timeout upstream con messaggio sensibile: convertito in errore generico;
5. tre fallimenti consecutivi;
6. recovery dopo successo;
7. ciclo lento/stuck;
8. shutdown durante ciclo in-flight con chiusura risorse;
9. runtime senza successo recente;
10. assenza di secret nell'health output.

## Guardrail
- nessun deploy Render;
- nessuna migration o write Supabase;
- nessuna credenziale reale;
- nessun raw error conservato o restituito dall'health model;
- nessun LLM;
- nessuna action automatica;
- branch Privacy non modificato.

## Passo successivo
CP-011: integrare l'health model nel read model del Security Center e definire una prima policy di alert read-only, ancora senza notifiche esterne reali né deploy.
