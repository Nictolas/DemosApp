# Demos Security Agent — Model Gateway Shadow Integration v0.18

## Stato

CP-018 collega il percorso AI shadow al Model Gateway v0.17 tramite una facade unica compatibile con il Security Center. Nessun provider reale viene configurato o chiamato.

## Feature flag

L'integrazione è disabilitata per default. Richiede `SECURITY_AI_SHADOW_INTEGRATION_ENABLED=true` e un backend esplicito allowlisted:

- `mock`: usa il mock runner deterministico v0.16;
- `gateway`: usa il Model Gateway v0.17.

Un backend diverso viene bloccato fail-closed.

## Gateway

Con backend `gateway`, l'integrazione verifica `gateway.status().ready === true` prima di qualsiasi analisi. Se il gateway è disabilitato, privo di provider o bloccato dai gate di policy/costo/regione/modello, nessuna chiamata parte.

La factory crea il gateway senza provider adapter reale; quindi il percorso gateway resta non operativo finché un checkpoint futuro non introduce e approva esplicitamente un provider.

## Security Center

`SecurityAiShadowIntegration` implementa lo stesso contratto read-only già accettato dal Security Center:

- `status()`;
- `listRecent()`.

Le analisi recenti restano minimizzate, non eseguibili e prive di tool call. Lo stato del target espone solo campi allowlist (versione, stato, ready, simulated, provider, regione, modello), mai secret.

## Guardrail

- feature flag OFF di default;
- nessun provider reale;
- nessuna API key;
- nessuna rete/tool/write access introdotta;
- output con `executable !== false` o tool call viene rifiutato;
- errori del provider vengono convertiti in codici generici;
- nessun deploy Render;
- nessuna migration Supabase;
- nessuna modifica Identity/Research/Privacy;
- nessuna notifica reale.

## Verifica

CP-018 aggiunge test per: flag OFF, backend allowlist, nessuna chiamata quando disabilitato, mock path, gateway non pronto, gateway simulato pronto, error redaction, blocco output eseguibili/tool call e compatibilità del contratto Security Center.
