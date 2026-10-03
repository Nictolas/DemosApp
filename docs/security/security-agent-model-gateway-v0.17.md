# Demos Security Agent — Model Gateway v0.17

## Stato

CP-017 introduce il confine tecnico per un futuro modello AI reale. **Nessun provider reale è implementato o chiamato in questo checkpoint.**

## Obiettivo

Impedire che il Security Agent possa collegarsi direttamente a un LLM senza superare controlli deterministici di configurazione, privacy, regione, modello, costo e timeout.

## Gate fail-closed

Il gateway parte con `SECURITY_AI_MODEL_GATEWAY_ENABLED` disattivato. Per diventare ready richiede contemporaneamente:

- feature flag esplicitamente `true`;
- `SECURITY_AI_PROVIDER_POLICY_APPROVED=true`;
- provider presente nella provider allowlist;
- regione presente nella region allowlist;
- modello presente nella model allowlist;
- tetto massimo di costo per richiesta;
- budget giornaliero;
- numero massimo di richieste giornaliere;
- adapter provider esplicitamente configurato.

Se manca anche una sola condizione, il gateway resta bloccato.

## Boundary AI

Ogni richiesta passa da `buildAiAnalystRequest()` del contratto v0.15 prima di raggiungere un adapter. Di conseguenza il provider riceverà solo il contesto già minimizzato e privacy-safe previsto da CP-015.

Gli adapter con `toolAccess=true` o `writeAccess=true` sono rifiutati.

Ogni risposta passa nuovamente da `validateAiAnalystOutput()`. Il risultato finale rimane sempre:

- `executable: false`;
- `toolCalls: []`.

## Provider / regione / modello

CP-017 **non hard-coda alcun provider reale**. Le allowlist sono vuote finché non vengono configurate e approvate. Questo evita che una semplice variabile provider possa attivare un trasferimento dati non ancora valutato.

L'eventuale scelta futura del provider/regione dovrà essere sincronizzata con Privacy/DPIA prima dell'attivazione.

## Controllo costi

Prima di ogni chiamata l'adapter deve produrre una stima deterministica del costo. Il gateway blocca la richiesta se:

- supera il tetto per singola richiesta;
- supererebbe il budget giornaliero;
- è stato raggiunto il numero massimo di richieste giornaliere.

Se il costo effettivo dichiarato dall'adapter supera la stima, il risultato viene rifiutato come violazione di accounting.

## Timeout ed errori

Il provider è soggetto a timeout configurabile tra 1 e 30 secondi. Errori provider, timeout, output invalidi e problemi di accounting vengono convertiti in codici generici; messaggi raw del provider non entrano nello stato del gateway.

## Segreti

Il gateway non legge né espone API key. Le future credenziali dovranno rimanere incapsulate nell'adapter/provider e non comparire in `status()`.

## Stato esposto

`status()` espone solo:

- stato ready/blocked;
- provider/regione/modello sanitizzati;
- blocker code;
- limiti;
- conteggi e consumo giornaliero;
- ultimo codice errore generico.

## Gate invariati

- nessuna chiamata LLM reale;
- nessuna API key;
- nessun deploy Render;
- nessuna migration Supabase;
- nessun accesso Identity↔Research/opinioni/secret;
- nessuna azione automatica;
- Security Center ancora read-only.

## Verifica

Suite CP-017: 15/15 test locali verdi, inclusi allowlist, policy approval, budget, request cap, timeout, output validation e secret non esposti.
