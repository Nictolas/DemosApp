# Demos Security Agent – Notification Simulation Pipeline v0.14

## Scopo

CP-014 collega la policy di alerting al dispatcher delle notifiche esclusivamente in modalita simulata:

`Security alerts -> Alert Routing Plan -> NotificationDispatcher -> Notification Audit -> Security Center`

Non viene inviato alcun messaggio reale e non viene aggiunta alcuna credenziale/provider.

## Componenti

- `SecurityNotificationSimulation`: mantiene solo routing state, stato sintetico dell'ultima simulazione e contatori aggregati.
- `NotificationDispatcher`: resta fail-closed e con `allowRealDelivery=false` per default.
- `MemoryNotificationAudit`: conserva solo record minimizzati e bounded.
- `SecurityCenterService`: espone stato notifiche e audit recente in sola lettura.
- `GET /notifications`: endpoint Admin read-only per stato e audit simulato.

## Dati ammessi

Lo stato sintetico puo contenere:

- versione;
- stato simulazione;
- timestamp ultimo run;
- numero run/route/dispatch;
- priorita massima;
- conteggi per canale e outcome.

L'audit conserva esclusivamente i campi allowlist definiti dal contratto v0.13. Non devono comparire raw event, IP, email, token, sessioni, user/account/participant ID o opinioni politiche.

## Guardrail

- real delivery vietato dal costruttore della simulation pipeline;
- nessun provider SDK o webhook;
- nessun secret;
- nessun deploy Render;
- nessuna migration Supabase;
- nessuna write verso produzione;
- nessun accesso Identity <-> Research;
- nessun endpoint POST/PUT/PATCH/DELETE nel Security Center;
- nessun LLM o action automatica.

## Comportamento cooldown

La pipeline riutilizza lo stato del routing v0.12. Un alert duplicato ancora in cooldown produce una route senza canali e quindi nessun nuovo dispatch/audit. Le escalation restano quelle definite dalla routing policy.

## Gate successivi

Prima di attivare notifiche reali servono almeno:

1. scelta e review dei provider;
2. secret management separato;
3. approvazione esplicita del real-delivery gate;
4. test end-to-end in ambiente non produttivo;
5. runbook operativo e rollback;
6. allineamento con Privacy/DPIA per retention e contenuto dei messaggi.
