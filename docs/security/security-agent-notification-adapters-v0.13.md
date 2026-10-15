# Demos Security Agent – Notification Adapter Contracts v0.13

## Obiettivo
Preparare i contratti dei canali di notifica senza collegare provider reali e senza introdurre credenziali.

## Canali previsti
- `push`
- `email`
- `external_secondary`
- `security_center` e `summary` restano canali interni e non usano adapter esterni.

## Guardrail
- gli adapter di default sono esclusivamente `noop_*` e dichiarano `simulated: true`;
- `NotificationDispatcher` ha `allowRealDelivery=false` di default;
- un adapter non simulato viene bloccato prima della chiamata quando il delivery reale non è abilitato;
- adapter assente, mismatch del canale o eccezione del provider producono un risultato fail-closed;
- nessun token, email utente, IP, user/account/participant ID, raw event o payload forense entra nel task o nell'audit;
- nessun provider reale è importato o configurato;
- nessun adapter è collegato al runtime o a Render.

## Audit minimo
L'audit in memoria conserva soltanto:
- versione contratto;
- canale;
- fingerprint alert;
- priorità;
- codice alert;
- decisione di routing;
- outcome;
- nome adapter;
- timestamp.

Il buffer è limitato e non è il durable audit store definitivo.

## Outcome principali
- `internal_only`
- `simulated_noop`
- `missing_adapter_fail_closed`
- `adapter_channel_mismatch`
- `real_adapter_blocked`
- `adapter_error_fail_closed`

## Stato produzione
CP-013 non abilita alcun invio reale. Push, email e canale esterno rimangono non configurati e senza credenziali.

## Passo successivo
CP-014 – Notification Simulation Pipeline: collegare, sempre in simulazione, `Alert Routing Plan -> NotificationDispatcher -> audit` e rendere il risultato leggibile dal Security Center senza endpoint di write.
