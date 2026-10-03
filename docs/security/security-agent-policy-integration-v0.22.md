# CP-022 – Policy Engine Integration v0.22

## Flusso
Output AI validato → Policy Engine deterministico → record shadow → Security Center read-only.

Ogni analisi shadow riceve una decisione policy minimizzata: `allow`, `deny` o `escalate`, reason code, numero di azioni e `executable=false`.

## Security Center
- stato policy e contatori aggregati;
- vista recente limitata a timestamp, decisione, reason code e actionCount;
- nessun summary AI, hypothesis, incident ID, IP, raw log o prompt nella vista policy;
- endpoint admin GET `/ai-policy`.

## Guardrail
`allow` non significa autorizzazione ad agire: non esiste Action Runner. Nessuna revoca, rate-limit, isolamento, rotazione, write, notifica o chiamata provider viene eseguita da CP-022.
