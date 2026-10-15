# Demos Security Agent – AI Analyst Mock Runner v0.16

## Scopo

CP-016 collega il contratto AI v0.15 a un provider deterministico finto per verificare end-to-end il percorso `request -> provider -> validation -> Security Center` senza usare alcun LLM reale.

## Guardrail

- modalità esclusivamente shadow/read-only;
- provider marcato `simulated: true`;
- zero tool access e zero network access;
- input costruito esclusivamente tramite il sanitizer del contratto v0.15;
- nessun raw log, IP, email, account/user/participant ID, sessione, token, secret, CIE/CF, opinione politica o mapping Identity↔Research;
- output validato con lo schema rigoroso v0.15;
- ogni risultato è `executable: false` e `toolCalls: []`;
- errore del provider o output non valido -> fail-closed con codice generico;
- nessun prompt/output raw viene conservato nel feed Admin.

## Provider deterministico

Il provider mock usa soltanto severità, priorità e health già minimizzati. Produce classificazioni ripetibili per i test e non effettua chiamate esterne.

## Security Center

Il Security Center espone solo in lettura stato mock analyst, contatori run/success/failure, ultima priorità e assessment e analisi recenti già validate/minimizzate.

Endpoint previsto: `GET /ai-analyses`, protetto dagli stessi middleware admin della console. Nessun endpoint write viene aggiunto.

## Gate successivo

CP-017 potrà introdurre un `Model Gateway` astratto con feature flag OFF e provider reale non configurato. Prima di attivare un LLM reale dovranno essere decisi provider, regione/trasferimenti, DPA/retention, secret management, cost ceiling e test adversarial.
