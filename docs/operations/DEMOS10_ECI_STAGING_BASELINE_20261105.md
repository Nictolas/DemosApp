# DEMOS 10 — ECI: baseline ufficiale nello staging, 05/11/2026

## Evidenze reali, non simulate

La lettura dell'API pubblica dell'Iniziativa dei cittadini europei è
stata eseguita **dal PC autorizzato**, tramite
`python api/scripts/sync_eci.py --dry-run`, senza credenziali DB:
**12/12 iniziative ONGOING** con identificativi, date, firme e titoli
normalizzati; esito `exit 0` e nessuna scrittura.

Sul progetto Supabase **Demos-Staging**, ref
`fkeayjzvtuvzesljhjbc`, è stato poi fatto un **caricamento iniziale
controllato** in un'unica transazione: confronto obbligatorio del fingerprint
dell'identità DB, guardia `civic_push_delivery_guard.blocked=true`,
verifica preventivamente di cache/outbox/devices vuoti, verifica 12 ID
ufficiali distinti e URL `https://*.europa.eu`. Solo dopo queste verifiche
sono state inserite le 12 righe in `public.eci` e le rispettive 12 righe
in `public.civic_new_initiative_notifications` con
`status='suppressed'`, `category='eci'`, `target_path='/eci'`.

**Readback SQL post-commit indipendente:** `eci=12`,
`distinct_ids=12`, `ongoing=12`, `suppressed=12`, `pending=0`,
`dispatching=0`, `sent=0`, `devices=0`,
`delivery_guard.blocked=true`; nessuna ECI priva di baseline
suppressed. Le 12 ECI sono un **baseline storico**, non 12 nuovi eventi
da notificare. Nessun utente, dispositivo, token o dato privato è stato
importato, nessun FCM/cron/sync Ministero è stato attivato.
Il precedente valore `outbox=0` non vale più: **outbox=12, tutte
suppressed**, coerentemente con il baseline.

## Misure aggiuntive nel codice

La normale `api/scripts/sync_eci.py` in precedenza verificava
`CIVIC_RUNTIME_DATABASE_ID` **solo** con
`CIVIC_NEW_INITIATIVE_EVENTS_ENABLED=true`. Questa PR impone il
controllo d'identità **prima di qualunque DELETE/INSERT**, anche quando
la creazione degli eventi è disabilitata.

Inoltre, `classify_new_eci_event_status` sopprime gli eventi se la
cache precedente è vuota, anche qualora il blocco push fosse disattivato:
un primo import non deve mai generare notifiche per tutte le ECI storiche.
Il controllo `blocked=true` o `EMERGENCY_STOP` sopprime sempre.
Un evento può essere `pending` soltanto con baseline precedente valida,
guardia disattivata e ID davvero nuovo. Gli ID sono deduplicati.

Test offline Python **10/10 PASS** e compilazione Python PASS.
CI dedicata aggiunta al workflow staging. Le credenziali mancano ancora
al workflow schedulato `main` secondo issue #589: **non** aggiungere
`DATABASE_URL` arbitrari né abilitare eventi/push/cron in produzione.

## Blocco release ancora aperto

Questo caricamento iniziale dimostra `API UE → staging cache` ma **non**
la sincronizzazione periodica autonoma né la consegna FCM Android.
L'API Ministero risponde HTTP 200 con 87 record nella risposta
(47 `IN RACCOLTA FIRME`, 31 `CHIUSA`, 9 altri stati),
ma la cache `iniziative_ministero` nello staging non è stata modificata;
serve conferma dello stesso mapping/paginazione dell'app prima di scrivere.
Google Play e produzione invariati. Gate Android E2E `0/6`;
notifiche NO-GO. La modalità Render rimane `preflight_only`.
