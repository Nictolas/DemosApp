# CP-021 – Policy Engine Foundation v0.21

## Obiettivo
Separare formalmente le raccomandazioni dell'AI dalle decisioni deterministiche di sicurezza.

## Decisioni
Ogni azione proposta viene classificata in uno dei tre stati:
- `allow`: consentita solo come proposta/read-only; mai eseguibile in CP-021;
- `escalate`: richiede revisione/approvazione umana;
- `deny`: rifiutata fail-closed.

## Policy iniziale
- `observe` → allow, salvo P0 o richiesta esplicita di revisione umana;
- `investigate`, `escalate_human` e tutte le proposte di mitigazione → escalate;
- azioni sconosciute, priorità invalide o input invalidi → deny.

La decisione aggregata usa la scelta più restrittiva: deny > escalate > allow.

## Guardrail
- `executable=false` in ogni risultato;
- nessun Action Runner;
- nessuna chiamata a Render, Supabase, Identity, Research o provider esterni;
- nessuna modifica, revoca, rate-limit, isolamento o rotazione realmente eseguita;
- nessun nuovo secret o credential;
- nessun deploy o migration.

CP-021 definisce solo policy-as-code deterministica e testabile.
