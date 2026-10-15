# Demos Security Agent — AI Analyst Contract & Guardrails v0.15

## Stato

CP-015 definisce il contratto dell'analista AI in **shadow/read-only**. Non collega alcun modello reale, provider LLM, rete, tool o credenziale.

## Obiettivo

Consentire in futuro a un modello di correlare incidenti già minimizzati senza trasformarlo in un attore operativo. L'AI produce esclusivamente una valutazione strutturata e proposte; non può eseguire azioni.

## Input consentito

L'AI riceve solo campi allowlist:

- incidenti: `incidentId`, `ruleId`, severità, stato, conteggio e timestamp;
- alert: priorità, codice, scope, stato e conteggio;
- health: livello, stato, reason code, failure count e ultimo successo.

Sono esclusi per contratto raw log, body/header/query HTTP, IP, email, account/user/participant ID, sessioni, token, secret, CIE/CF, opinioni politiche e mapping Identity↔Research.

## Prompt-injection boundary

I dati sono trattati come **evidenza non attendibile**, mai come istruzioni. I campi token-like sono normalizzati e il contratto scarta campi arbitrari come `instructions`, `prompt`, `rawLog`, `message` o payload applicativi. Il modello non riceve tool.

## Output consentito

Un singolo oggetto JSON con schema ristretto:

- `assessment`: `benign | suspicious | likely_attack | uncertain`;
- `confidence`: intero 0–100;
- `prioritySuggestion`: P0–P3;
- `summary`: testo breve/plain;
- `hypotheses`: massimo 5 coppie `code + confidence`;
- `recommendedActions`: massimo 5 voci da allowlist;
- `requiresHumanReview`: boolean.

Il risultato normalizzato aggiunge sempre `executable: false` e `toolCalls: []`.

## Azioni proponibili

- `observe`
- `investigate`
- `escalate_human`
- `propose_rate_limit`
- `propose_session_revocation`
- `propose_endpoint_isolation`
- `propose_secret_rotation`

Sono **proposte**, non comandi. Eventuali azioni future dovranno passare da un Policy Engine deterministico e, dove previsto, da approvazione umana.

## Fail-closed

Il validator rifiuta:

- output non JSON puro o racchiuso in Markdown/code fence;
- chiavi sconosciute (`toolCall`, script, comandi ecc.);
- action non allowlisted;
- confidence/priorità fuori range;
- più di 5 hypotheses/actions;
- campi arbitrari dentro le hypotheses;
- output eccessivamente grande.

## Gate invariati

- nessun modello reale;
- nessuna API key/provider;
- nessun accesso tool/network/write;
- nessun deploy Render;
- nessuna migration Supabase;
- nessuna modifica ai domini Privacy/Identity/Research;
- nessun invio di notifiche reali.

## Verifica CP-015

Test mirati: 12/12 verdi in locale. Il prossimo passo è CP-016: **AI Analyst Mock Runner**, che userà un provider finto deterministico per collaudare request → validation → Security Center senza chiamare alcun LLM reale.
