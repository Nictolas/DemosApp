# DEMOS 10 — Baseline storico Ministero nel solo Demos-Staging

**Data: 5 novembre 2026. Stato: APPLICATO e verificato sullo staging,
NON distribuito tramite Render, Firebase o Google Play.**

## Fonte e acquisizione

Il PC Windows autorizzato risultava offline; non sono stati riutilizzati
vecchi dati dell'API. È stata costruita la [PR #602](https://github.com/Nictolas/DemosApp/pull/602),
con accesso **esclusivamente in lettura** all'API pubblica
`https://firmereferendum.giustizia.it/referendum/api-portal/iniziativa/public`
da un runner GitHub Actions privo di segreti, connessioni SQL o token FCM.

Il job **41946836675 / 126981049810** è SUCCESS e ha verificato il
feed attuale: **87/87 record**, **87 identificativi distinti**,
80 leggi d'iniziativa popolare, 7 referendum abrogativi.
Stati del Ministero:
- 47 `IN RACCOLTA FIRME`;
- 31 `CHIUSA`;
- 2 `MESSA A DISPOSIZIONE`;
- 3 `MESSA A DISPOSIZIONE CAMERA`;
- 4 `MESSA A DISPOSIZIONE SENATO`.

Il metadata ufficiale `infoPaginazione.elementCount` corrisponde a
87 record. Sono stati validati tutti i titoli, tipi, stati, URL, conteggi
firme e date ISO. Nessuna risposta grezza né dato personale degli utenti
DEMOS è stato copiato. La PR #602 ha superato il workflow di audit live,
i 7 job Unified Staging Offline Safety e Snyk; integrata **solo**
nel ramo `ops/demos-unified-staging-20261102`, commit
`67bffba412ef9fd107d2e0193ae0c37a8c6ceaf1`.

## Import atomico, vincoli e assenza di invii

Una singola transazione SQL sul progetto verificato
`Demos-Staging` (`fkeayjzvtuvzesljhjbc`) ha controllato **prima
di ogni INSERT** il fingerprint dell'identità DB
`0cbb6ace68a9f11956904e2a37898ec8`, la guardia push
`blocked=true` con lock `FOR SHARE`, la data del batch, la
presenza delle 12 ECI già storicizzate, zero dispositivi, nessun
evento azionabile e zero righe Ministero preesistenti.

Sono stati inseriti **87 record** in `public.iniziative_ministero`
con chiave primaria stabile `ministero_<id_ufficiale>`, senza
`dati_raw` e senza descrizioni superflue; 80 leggi, 7 referendum.
Per le iniziative con stato `IN RACCOLTA FIRME`, **11 avevano
già la data di fine trascorsa**: sono state correttamente classificate
`conclusa` nella cache secondo la stessa regola del servizio
`ministeroSync`. Risultano quindi **36 raccolte ancora nei termini**.

Sono state aggiunte soltanto **36 righe** di baseline storico
all'outbox, tutte `status='suppressed'`, una per identificativo
ufficiale, senza alcun tentativo di invio e senza destinatari.
Tutte le 36 riguardano iniziative popolari: i sette referendum
presenti nella fonte non sono attualmente idonei alla raccolta firme.

## Readback SQL indipendente dopo il commit

| Verifica | Esito |
|---|---:|
| Iniziative Ministero | 87 |
| ID Ministero distinti | 87 |
| Leggi popolari | 80 |
| Referendum | 7 |
| Ancora in raccolta e non scadute | 36 |
| Classificate concluse | 42 |
| Outbox Ministero suppressed | 36 |
| Outbox ECI suppressed | 12 |
| Eventi pending/dispatching/sent/failed | 0 |
| Dispositivi | 0 |
| Righe `dati_raw` persistite | 0 |
| URL non ufficiali in cache | 0 |
| Baseline mancanti per iniziative idonee | 0 |
| Outbox Ministero senza iniziativa corrispondente | 0 |
| `delivery_guard.blocked` | true |

**Nessuna modifica** a `main`, produzione, variabili Render,
credenziali, scheduler ECI/Ministero, Firebase, invii, Play.
Il servizio Render `demos-staging` rimane in `preflight_only`
con autoDeploy disattivato. La PR #565 è ancora Draft.

## Gate ancora aperti

Questo lavoro dimostra entrambe le acquisizioni
`fonte ufficiale → cache Demos-Staging` (ECI 12 e Ministero 87),
**non** una sincronizzazione programmata e nemmeno una notifica
recapitata ad Android. Mancano ancora scheduler sicuri per entrambe
le fonti (issue #589), backend applicativo/canary con accesso
autorizzato, opt-in/token FCM, profondità dei deep-link, test su
dispositivo Android e validazione **6/6** end-to-end.

**Rilascio notifiche: NO-GO.** I dati storici `suppressed` non
devono essere rimessi in coda al primo avvio dei job.
