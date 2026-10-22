# DEMOS — Stato rilascio coda audit, 21 ottobre 2026

**Stima gestionale: ~70% completato / ~30% mancante.** È un giudizio
qualitativo, non una percentuale ricavata dai test. La maggior parte del
codice e dei controlli automatici è pronta; i controlli end-to-end con
provider reali, la valutazione privacy e il rilascio controllato non lo sono.

**STATO: NO-GO. La PR #218 resta draft e non va unita a `main` senza
soddisfare tutte le condizioni obbligatorie sotto. Nessun flag di outbox
deve essere attivato sul backend di produzione.**

### 22 ottobre 2026 — Verificatore Axiom HTTP reale predisposto, senza token

Dopo CP-EA-040, aggiunto **solo sulla PR** il comando
`cd api && npm run audit:axiom:staging-provider-drill`.
È un processo una-tantum, non il worker outbox: senza un token autorizzato
**non effettua alcuna richiesta**. Richiede variabili esatte
`AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`,
`AXIOM_REALTIME_DATASET=demos-security-staging`,
`AXIOM_DATASET=demos-security-staging`,
`AXIOM_REGION=eu`,
`AXIOM_STAGING_DRILL_ARMED=true` e
`AXIOM_STAGING_DRILL_TOKEN` gestito SOLO nel secret manager
del runtime di test isolato. Prima dell'esecuzione il titolare deve aver
verificato negli accessi Axiom che sia **un API token, non PAT**,
limitato al **solo dataset già esistente** `demos-security-staging`
con permessi **Ingest:create + Query:read** (nessun CRUD dataset/utente).

Il comando rifiuta le credenziali standard della produzione
`AXIOM_API_TOKEN`/`AXIOM_ORG_ID`, tutti i database,
chiavi B2, CI automatica, flag worker/archivio attivi, scope non-staging
e host/dataset/regione diversi dal target UE. Invia esattamente
**un evento audit synthetic** con ID UUID casuale, senza utente, IP
o payload libero, a
`https://eu-central-1.aws.edge.axiom.co/v1/ingest/demos-security-staging`.
Richiede ACK `ingested=1, failed=0` e legge tramite query APL
**sullo stesso edge UE** in `/v1/query/_apl?format=tabular`,
filtrando unicamente per l'UUID sintetico e proiettando solo tale campo.
Non basta la risposta HTTP 200: deve risultare una colonna
`axiom_delivery_id` con il medesimo UUID. La lettura può
essere ritentata due volte, **l'invio non è mai ritentato**.
Se il provider restituisce errore, non si riportano segreti né query
o payload nei log. Nessuna connessione a PostgreSQL, FCM o Backblaze.

**Gate non completato:** il verificatore e i test mock **non** sono una
prova HTTP reale Axiom. Senza token scoped confermato e senza avvio
intenzionale del comando in un ambiente di prova, **AXIOM PROVIDER NO-GO**.
Anche una futura verifica di ingest/query Axiom separata non prova ancora
la consegna attraverso l'intera coda PostgreSQL/worker/retry e non
approva retention GDPR. Non attivare il backend principale.

### 22 ottobre 2026 — Gate HTTP Axiom di staging prima di un token

Il codice di consegna dell'outbox ora rifiuta, **prima della richiesta
HTTP**, impostazioni `AXIOM_REGION` extra-UE e qualunque
`AXIOM_EDGE_DOMAIN` diverso da `eu-central-1.aws.edge.axiom.co`
quando `AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`. Inoltre, sul
trasporto di staging sono disattivati il proxy automatico di Axios
(`proxy: false`) e i reindirizzamenti (`maxRedirects: 0`):
il token dataset-scoped di prova non deve essere inoltrato a un
host o proxy arbitrario. Le verifiche agiscono dopo i guard del
dataset `demos-security-staging` e del payload
`STAGING_OUTBOX_DRILL` esclusivamente sintetico. I test
verificano rifiuto delle destinazioni estranee **senza effettuare
una richiesta** e il corretto host, senza usare token veri.

Questa è **solo una protezione del codice**, non una prova Axiom E2E.
Non sono stati creati token, inviate chiamate HTTP al provider,
abilitati worker/outbox o effettuati deploy. Il token e l'organizzazione
di test dovranno comunque essere verificati presso Axiom per scope
effettivo limitato al dataset, senza riutilizzare credenziali
produttive. La produzione mantiene invariata la propria
configurazione HTTP.

### 22 ottobre 2026 — Retention staging verificata da Render con ruolo minimo

Il **nuovo** comando di snapshot retention, già implementato e
verificato in CI, è stato ora eseguito anche **realmente
sull'istanza Render di staging esistente**. Il deploy manuale
`dep-dbcukhmq1p3s73dcarqg` (commit
`1698d3e8ca08147b20c8205723c8ec26621b78e5`)
di `demos-outbox-readonly-staging` è **LIVE** dalle 10:50 UTC
del 22/10/2026. La sua `autoDeploy` era già disattivata.

La sequenza di avvio è: (1) preflight Postgres autenticato
con account `demos_outbox_runtime` limitato su Supabase
`Demos-Staging`; (2) query **sola lettura** di COUNT/età
sulla tabella outbox, con una connessione separata con la
**stessa credenziale limitata**, chiusa al termine; (3)
solo se entrambi i controlli passano, apertura dell'endpoint
`/healthz` che restituisce esclusivamente `ok`.
Il deploy e i log Render verificati registrano:
```text
{"status":"OUTBOX_RETENTION_STAGING_SNAPSHOT_OK","total":0,"pending":0,"sending":0,"dead_letter":0,"needsReview":false}
AUDIT_RENDER_STAGING_PREFLIGHT_OK
```
Nessun payload, identificativo utente o IP letto/mostrato,
nessun evento inserito o cancellato, nessuna migrazione,
chiave, bucket o servizio aggiuntivo. Il comando rimane
inutilizzabile con scope produzione, DB principale,
worker/outbox o archiviatore attivo.

La [CI logging/archivio/PostgreSQL](https://github.com/Nictolas/DemosApp/actions/runs/39765849833)
e la [CI di sicurezza](https://github.com/Nictolas/DemosApp/actions/runs/39765849967)
risultano **SUCCESS** sul commit `1698d3e8`.
I Google Sheet canonici sono stati aggiornati e riletti
nella stessa sessione: Tecnologia `IMP-047` riga 56 e
Stato moduli riga 26; Privacy `RP-17` riga 21;
Engineering `CP-EA-036` riga 38.

**Milestone: lettura reale aggregata del ruolo minimo su
staging PASS.** Non è una prova con backlog, non decide
alcun periodo di retention, non approva GDPR e non sostituisce
le prove vere Axiom/B2/FCM. Produrre una query aggregata
non autorizza mai cancellazioni automatiche.
La PR resta **DRAFT / NO-GO** per la produzione. Le
precedenti sezioni storiche che dicono che lo snapshot
non era ancora stato eseguito da Render si riferiscono
a uno stato ora superato.


**AGGIORNAMENTO 22/10/2026 — CONNESSIONE RENDER → SUPABASE STAGING: PASS.**
Il deploy Render isolato `dep-dbclkreq1p3s73ch6ac0` (commit
`acd98a16971df16f145b4c924a07ea3b19e12fe3`) è **live**.
Nei log di startup appare `AUDIT_RENDER_STAGING_PREFLIGHT_OK` solo dopo
un'autenticazione PostgreSQL riuscita e la verifica del ruolo/grants
limitati su `Demos-Staging`. Verifica HTTPS indipendente dal desktop:
`GET /healthz` **200 / `ok`**, `GET /` **404**;
nessun payload, URL di database o credenziale restituiti.
La coda resta **0 eventi**, il login limitato non ha CREATE su `public`,
Supabase Security Advisor ha **0 rilievi**. Le pipeline GitHub
[logging/PostgreSQL](https://github.com/Nictolas/DemosApp/actions/runs/39700593118)
e [sicurezza](https://github.com/Nictolas/DemosApp/actions/runs/39700592991)
sono **SUCCESS**. La normalizzazione dei caratteri riservati è
limitata esclusivamente alla password della URI di staging con prefisso
e suffisso esatti, dentro il runtime di sola lettura; i worker normali
mantengono i guard originali. La password non è stata letta o scritta
in questa documentazione.

**GO solo per la prova di connettività staging, NON per la feature
audit in produzione.** Restano da verificare con provider reali Axiom,
Backblaze B2, notifiche FCM, retention GDPR e rollout/rollback. Le
sezioni storiche che indicano URL non valido, LOGIN mancante e preflight
non ancora svolto sono precedenti a questo esito, e vanno interpretate
come cronologia dei tentativi.

### 22 ottobre 2026 — Staging Axiom: soltanto eventi sintetici, senza PII

Prima di apportare modifiche è stato riletto il Google Sheet canonico
`DEMOS – Tecnologia` (`IMP-047`) e il checkpoint Engineering
`CP-EA-033`, poi verificati GitHub PR #218 e servizi Render.
L'inventario delle chiavi Backblaze **resta ignoto**: DeskMCP è ancora
offline, non esiste un connettore B2 diretto, mentre il probe B2
`demos-b2-readonly-restore-staging` è ancora in standby senza key.
Non è stato creato alcun bucket, nuova chiave o servizio.

È stato individuato e corretto un limite nel codice del **nuovo**
outbox su staging: il dataset Axiom era isolato, ma non era imposta
la natura rigorosamente sintetica dei payload. Ora, nello scope
`AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`, i guard di
`api/services/auditOutboxAxiomTarget.js` impongono
`synthetic=true`, `log_type=audit`,
`action=STAGING_OUTBOX_DRILL`, `resource=outbox`,
`success=true`, timestamp ISO preciso, sole chiavi consentite
e nessun `user_id`, indirizzo IP, `resource_id`,
`session_id`, messaggio d'errore o testo libero.
Il controllo viene eseguito **sia prima dell'INSERT**
nella coda PostgreSQL, sia prima di ogni HTTP ingest Axiom,
anche per righe preesistenti. Il percorso `production`
rimane invariato e l'invio ai dataset produttivi è ancora vietato
allo staging.

Aggiunti test di casi negativi (identificativi personali, payload
arbitrari, segnali senza marker, dataset errato) e aggiornati test
HTTP/worker esistenti. Dopo un primo test CI fallito per un
vecchio fixture privo di `synthetic=true`, corretto il fixture.
[Logging and archive regression](https://github.com/Nictolas/DemosApp/actions/runs/39762449259)
risultato **SUCCESS** sull'HEAD `d9f5726361fccecb0770336442a2e153ee8e62ed`.
La Security Agent Validation dello stesso HEAD era ancora in corso
durante il primo riscontro.

**Stato: guard sintetico PASS (CI), ma Axiom E2E provider reale
NON ESEGUITO.** Non sono state configurate nuove chiavi né
inviati eventi a `demos-security-staging`; worker della nuova
coda e deploy di produzione restano disattivati. Serve il
successivo collaudo reale con token Axiom limitato al dataset e
senza dati utenti.

### 22 ottobre 2026 — Snapshot retention di staging, sola lettura, reale

Riletti PR #218 e Google Sheet canonici `DEMOS – Tecnologia`
(`IMP-047`), `Engineering` (`CP-EA-034`) e
`Privacy/Retention policy` (`RP-17`). Le verifiche
reali Axiom e Backblaze restano bloccate dall'assenza
di un canale autorizzato per inventariare le credenziali:
**nessuna nuova chiave, bucket, servizio o migrazione creati**.

È stata eseguita una query SQL **soltanto aggregata**
sulla tabella privata `demos_private.audit_delivery_outbox`
nel database reale **Supabase Demos-Staging**.
Esito del 22/10/2026:
`total=0`, `pending=0`, `sending=0`,
`dead_letter=0`, `pending_over_15m=0`,
`pending_over_24h=0`, `dead_letter_over_72h=0`,
`dead_letter_over_30d=0`, `oldest_age_seconds=0`.
**Nessuna PII o contenuto evento letto**; nessuna
operazione `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`
o nuovo oggetto SQL eseguiti.

Il controllo è ora ripetibile nel ramo PR:
`api/services/auditOutboxRetentionSnapshot.js` e comando
`cd api && npm run audit:outbox:retention-staging-snapshot`
(`api/scripts/verify-audit-outbox-retention-staging.js`).
Il comando richiede un account Postgres dedicato allo staging,
`AUDIT_OUTBOX_PREFLIGHT_ONLY=true`, progetto e host del
pooler già verificati, flag worker/archivio spenti e
nessun `DATABASE_URL` principale. Verifica ruolo e grant
prima di un'unica query di aggregazione e chiude il pool.
Rifiuta risultati mancanti/incoerenti e non riporta errori
del driver, segreti o identificatori personali.
**La query reale è stata eseguita tramite il connettore
Supabase; il nuovo CLI è verificato in CI, ma non è
stato eseguito sul runtime Render**: mantenere distinte
le due evidenze.

[Logging/archivio + PostgreSQL CI](https://github.com/Nictolas/DemosApp/actions/runs/39765086311)
**SUCCESS**, [Security Agent Validation](https://github.com/Nictolas/DemosApp/actions/runs/39765086217)
**SUCCESS** sul commit `45cbd878925eace5fce27ed333c900d836e9cc8c`.
Checkpoints Google Sheets aggiornati e riletti nello
stesso intervento: `IMP-047`, `CP-EA-035` ed `RP-17`.

Queste soglie di età costituiscono soltanto **segnali di
riesame operativo**, NON una durata di conservazione
approvata né una regola di eliminazione. Il titolare/
consulente privacy deve ancora approvare finalità,
campi e retention effettiva. Nessun evento cancellato,
nessun auto-purge introdotto, nessun rollout autorizzato.
B2 restore, invio Axiom reale e FCM di test sono **NO-GO**.

### 22 ottobre 2026 — Regressione SQL sul backlog sintetico (solo CI)

A seguito di `CP-EA-035`, la verifica reale di staging era stata
fatta con **0 righe**. È stata aggiunta una prova diversa,
`auditOutboxRealPostgres.test.js`, che usa **il medesimo**
`readRetentionSnapshot / SNAPSHOT_SQL` su PostgreSQL 17 effimero
della GitHub CI, con login non amministrativo e sei eventi interamente
sintetici: 3 pending, 1 sending, 2 dead-letter.

L'esperimento avviene in una transazione con **ROLLBACK**, poi verifica
che il conteggio della coda sia tornato a zero. Controlla il risultato
atteso: pending >15m=2, pending >24h=1, dead-letter >72h=2,
dead-letter >30d=1 e `needsReview=true`. Nessun dato reale,
nessuna operazione su database Supabase e nessun provider Axiom/B2/FCM.
La simulazione delle età non approva né modifica durate di retention GDPR.

La CI associata al commit va verificata separatamente: **il test
su PostgreSQL temporaneo non sostituisce un collaudo runtime Render né
un backlog reale in Supabase-Staging**. RP-17 e RP-09/RP-10 rimangono
non approvate. PR draft; main e produzione invariati.

### 22 ottobre 2026 — Monitoraggio dei lease `sending` (checkpoint dedicato)

Il controllo di retention read-only esistente identificava i ritardi `pending` e
`dead_letter`, ma **non** segnalava un record `sending` con
`lease_expires_at` scaduto o NULL. Quest'ultimo è soprattutto un rischio
operativo: il worker recupera le lease **scadute**, mentre con `NULL`
la sua query di recupero non seleziona il record.

Senza modifiche allo schema, senza leggere eventi o identificatori,
`SNAPSHOT_SQL` include ora `sending_expired_lease` e
`sending_missing_lease`. Entrambi attivano `needsReview=true`; i
contatori sono verificati come sottoinsiemi disgiunti di `sending`.
Il probe Render, quando aggiornato separatamente e dopo test, potrà
registrare solo questi conteggi. NON attiva il worker, non effettua
riparazioni automatiche e non dichiara scadenze GDPR.

Nuova regressione PG17 CI: sette eventi interamente sintetici nella
transazione temporanea già esistente, due `sending` (uno con lease scaduto,
uno senza lease), con `ROLLBACK` e verifica tabella vuota. Il test unitario
verifica anche l'allerta quando **soltanto** un lease è irregolare e
rifiuta conteggi incoerenti. Nessun test su dati reali Supabase; nessun
deploy automatico richiesto né nuove risorse o credenziali. RP-17 resta
**NON APPROVATA**; Axiom/B2/FCM reali restano **NO-GO**.

## Verifiche già svolte

| Area | Evidenza | Stato |
| --- | --- | --- |
| Coda PostgreSQL, lease, retry, dead-letter, collisioni e capacità | Suite PostgreSQL 17 reale su GitHub CI; **14/14 test**, inclusi percorso integrato fino al restore B2 sintetico e rifiuto di privilegi estranei concessi temporaneamente al login | PASS simulazione integrata; provider esterni reali ancora NO-GO |
| Staging Supabase | `Demos-Staging` (`fkeayjzvtuvzesljhjbc`), due migrazioni e RLS; eseguito anche INSERT/claim/lease/retry/dead-letter/DELETE **con ruolo NOLOGIN effettivo** in una transazione con `ROLLBACK`, senza creare password o dati residui | PASS SQL (non LOGIN/HTTP) |
| Data API pubblica dello staging | GET anon su tabella/schema privato → HTTP 404/406 | PASS negativo |
| Isolamento dei progetti | `AUDIT_OUTBOX_DEPLOYMENT_SCOPE` e `AUDIT_OUTBOX_DATABASE_URL` separata; mismatch fallisce prima della creazione del pool | PASS test |
| Reinvio Axiom 503 → 202 con ID stabile | Axiom HTTP simulato su PostgreSQL CI; **non** consegna reale | PASS simulazione |
| Archiviazione Axiom → B2 e recupero duplicati | CI con oggetti sintetici, hash SHA256/gzip e limiti del restore B2 (**HEAD max 8 MiB, streaming bounded, decompressione max 32 MiB, max 60.000 eventi**); lettura checkpoint rafforzata con verifica hash e dataset prima del riavvio; **27 completamenti** Render osservati, senza lettura B2 reale | PASS CI (42/42 test archiviazione, 76/76 logging e PostgreSQL reale); restore reale NON verificato |
| Avvisi amministrativi | Retry dopo errore DB; avvisi concorrenti; DB riuscito + FCM fallito non genera duplicati; solo test sintetici | PASS simulazione |

**Verifica diretta 21/10/2026:** Supabase `Demos-Staging` è
`ACTIVE_HEALTHY`, con **0 righe** nella outbox, RLS attiva,
ruolo `demos_outbox_worker` ancora `NOLOGIN` e senza `BYPASSRLS`;
nessun accesso schema per `anon`/`authenticated` né SELECT per
`service_role`. Advisor sicurezza e performance: **0 rilievi**.
Nessun LOGIN runtime, credenziale provider o servizio di produzione modificato.
Il test completo **con Axiom/B2 simulati** è [passato nella CI PostgreSQL](https://github.com/Nictolas/DemosApp/actions/runs/39670492893).
Questo risultato **non chiude** i test con Axiom, B2 o FCM reali.

## Destinazioni Axiom già presenti e isolamento dei collaudi

La console Axiom dell'organizzazione DEMOS mostra i dataset **interni**
`centralized_logs` (30 giorni), `real-time` (30 giorni) e
`demos-security-staging` (7 giorni, attualmente senza eventi nella
schermata verificata). I due dataset `axiom-play / ...` marcati
**External** sono esempi esterni e non sono destinazioni DEMOS.

**Nuovo controllo fail-closed nel ramo PR:** quando
`AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`, i nuovi eventi outbox possono
essere accodati/inviati soltanto al dataset `demos-security-staging`.
Il controllo viene ripetuto immediatamente prima della richiesta HTTP
ad Axiom, anche per righe già presenti nella coda. In produzione un
dataset con segmento `staging` nel nome viene rifiutato.
Questo impedisce che le variabili predefinite `real-time` e
`centralized_logs` facciano finire collaudi nel dataset operativo.

**Istruzioni per il backend isolato (NON per Render di produzione):**
configurare `AXIOM_REALTIME_DATASET=demos-security-staging` e
`AXIOM_DATASET=demos-security-staging` insieme a
`AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`, soltanto con un token Axiom di
test limitato a quel dataset e all'organizzazione prevista. Non abilitare
`AXIOM_ARCHIVE_ENABLED` sul backend di staging: l'archivio B2 produttivo
deve restare indipendente. Iniettare esclusivamente eventi sintetici,
senza `user_id` o `ip_address` reali; verificare prima che il dataset
esistente, normalmente usato dal Security Agent, possa ospitare il
collaudo senza alterarne alert o analisi. Questa verifica con Axiom reale
**non è stata eseguita**. Un eventuale dataset aggiuntivo richiederà
una decisione separata, non è stato creato.

## Render: workspace autorizzato e preflight dedicato

**Verifica del 21/10/2026.** L'utente ha confermato il workspace Render
`Nicolas` (`tea-d2gs3eadbo4c73ag95rg`). L'inventario Render mostra il
backend **produttivo** `demos-backend`
(`srv-d2gt3dodl3ps73fmereg`, ramo `main`, auto-deploy attivo)
e più servizi **già esistenti** di staging su piano `free`, inclusi
`demos-functional-staging` (`srv-db52l1g473hc739ld250`) e
`demos-security-staging` (`srv-db2ho5jncjis73ep4ot0`), entrambi con
auto-deploy disattivato e su rami diversi dalla PR #218.

**Nessun servizio Render creato, modificato, riavviato o ridistribuito.**
Gli staging precedenti non sono stati riutilizzati arbitrariamente:
il connettore espone le configurazioni generali ma non consente di
attestare in sola lettura la separazione effettiva delle loro
credenziali runtime. **Non assumere che siano collegati al database
Demos-Staging solo perché contengono la parola staging nel nome.**

Un'ulteriore istanza Render Free non è necessariamente priva di rischio
economico/operativo: le **750 ore mensili gratuite sono condivise**
fra i servizi web Free dello stesso workspace, inclusa la produzione,
e il loro esaurimento sospende i servizi Free. È necessario controllare
prima il consumo residuo nella fatturazione Render:
https://render.com/docs/free .
Non creare un nuovo servizio o modificare uno staging esistente finché
non è chiaro il consumo disponibile e non si conoscono le credenziali
effettivamente assegnate al backend scelto.

### Preflight del futuro backend isolato (senza avviare l'app)

Nel ramo PR #218 è disponibile:

```bash
cd api
npm run audit:outbox:render-staging-preflight
```

Il comando **non avvia Express, worker, Axiom o B2** ed esegue solo
query SQL di controllo su Supabase. Prima di qualsiasi query verifica:

- scope esatto `AUDIT_OUTBOX_DEPLOYMENT_SCOPE=staging`;
- `AUDIT_OUTBOX_PREFLIGHT_ONLY=true` e **solo**
  `AUDIT_OUTBOX_DATABASE_URL` con account `demos_outbox_runtime`;
  `DATABASE_URL` deve essere **assente**, senza credenziali
  amministrative o applicative del database principale;
- per il preflight Render solo Session Pooler verificato
  `aws-1-eu-central-1.pooler.supabase.com:5432`, rifiutando
  connessione diretta IPv6 e Transaction Pooler 6543;
- `AXIOM_REALTIME_DATASET=AXIOM_DATASET=demos-security-staging`;
- `AUDIT_OUTBOX_ENABLED`, `AUDIT_OUTBOX_WORKER_ENABLED`,
  `AUDIT_OUTBOX_SECURITY_ENABLED`,
  `AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED` e
  `AXIOM_ARCHIVE_ENABLED` **non attivi**.

La fase SQL verifica poi il login PostgreSQL non privilegiato, la
membership nel ruolo minimo e i permessi necessari con il preflight
già presente. In caso di problemi esce senza stampare password,
URL o messaggi del driver. Restituisce soltanto identificatore
pubblico di staging, esito e flag di sola lettura.

**Blocco confermato direttamente nello staging Supabase:** la coda è
vuota, RLS attiva, nessun accesso allo schema per `anon`/
`authenticated`; `demos_outbox_worker` è ancora `NOLOGIN` e
**0 ruoli `demos_outbox_%` possono effettuare LOGIN**. Non è
stato inventato un hostname pooler né creata una password.

**Prossime condizioni in ordine:** (1) scegliere un servizio davvero
isolato e verificare le ore Render; (2) ottenere la connessione session
esatta dal pannello Supabase e creare il login a privilegi minimi tramite
un canale sicuro per i secret; (3) eseguire il preflight dal solo
backend isolato, con tutti i flag disattivati; (4) solo dopo abilitare
gli eventi sintetici e verificare Axiom, quindi B2 e FCM. Il preflight
non autorizza automaticamente né il deploy né l'attivazione.

### Privilegi impliciti del login: barriera aggiuntiva (21 ottobre 2026)

Il preflight runtime `auditOutboxDatabase.ensureReady()` controlla ora
**l'identità PostgreSQL effettivamente autenticata**, non soltanto i grant
del ruolo `demos_outbox_worker`. Respinge account che possano creare
database/ruoli, fare replication o creare oggetti nello schema `public`,
nonché login che abbiano privilegi su **qualsiasi tabella o vista
diversa da `demos_private.audit_delivery_outbox` (anche nello stesso
schema privato)**, possano invocare routine `SECURITY DEFINER` non di
sistema (anche interne allo schema privato) o appartengano a ruoli
ulteriori oltre a `demos_outbox_worker`.

La scansione consulta soltanto i **cataloghi** PostgreSQL: non legge
payload di log, dati utenti, né invoca funzioni applicative. Restituisce
al servizio esclusivamente conteggi, booleani e un codice d'errore fisso.
Il controllo considera anche i grant impliciti tramite `PUBLIC`,
che una mera analisi dei permessi espliciti non coprirebbe.

Nello **staging Supabase reale**, la ricognizione preliminare del
ruolo `NOLOGIN` esistente ha contato **zero** tabelle o viste
estranee accessibili e **zero** routine esterne eseguibili. L'esito
non sostituisce la prova sul futuro `LOGIN` applicativo.
Il test su **PostgreSQL 17 usa-e-getta** ha invece verificato
sull'account `LOGIN` reale che un `GRANT SELECT` estraneo e
una routine `SECURITY DEFINER` richiamabile attraverso `PUBLIC`,
**entrambi nello stesso schema `demos_private`**, vengono rifiutati;
la configurazione minimale torna valida dopo la revoca.
[CI PostgreSQL (14/14)](https://github.com/Nictolas/DemosApp/actions/runs/39677416704).
Un'ulteriore lettura dei cataloghi sullo **staging Supabase reale**
ha confermato: **0** oggetti estranei accessibili anche entro lo schema
privato, **0** routine `SECURITY DEFINER` invocabili, **0** login runtime
creati e **0** eventi nella coda.

**Blocco invariato:** non è stato ancora creato alcun account LOGIN
nello staging Supabase o configurata una credenziale su Render.
Prima della prova runtime devono essere verificati i grant effettivi
del LOGIN creato attraverso il canale sicuro del provider.

### Identità Supabase runtime predisposta, connessione ancora NO-GO

Il 21 ottobre 2026 è stata applicata **solo** a `Demos-Staging`
la migrazione `20261021212727`: ora esiste
`demos_outbox_runtime` **NOLOGIN, senza password** e membro
del solo `demos_outbox_worker`. SQL verificato: privilegi
`SELECT/INSERT/UPDATE/DELETE` limitati alla coda, nessun
`SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION`, nessun
`CREATE` su `public`; **0** altre tabelle leggibili,
**0** routine definer richiamabili e **0** eventi in coda.
Il lavoro è reale sul database di prova, **non è un collegamento Render
attivo** e non consente l'accesso a rete senza LOGIN.

**Aggiornamento 22/10/2026 — hostname ottenuto:**
`aws-1-eu-central-1.pooler.supabase.com:5432` per
`Demos-Staging`, verificato dalla stringa Session Pooler dell'utente.
Risoluzione IPv4 (4 record A) e raggiungibilità TCP porta 5432
confermate dal desktop autorizzato; **non** è una prova di accesso
PostgreSQL o di rete dal runtime Render. La stringa Supabase mostra
`postgres.<project-ref>`, ma il worker userà
`demos_outbox_runtime.<project-ref>` con privilegi minimi.

**Blocco residuo: LOGIN disattivato** per `demos_outbox_runtime`,
ancora senza password. La migrazione di attivazione con modifiche
amministrative è stata rifiutata dai permessi Supabase e il successivo
tentativo di abilitare soltanto LOGIN è stato bloccato dai controlli
di sicurezza della piattaforma. **Non aggirare il blocco**.
Verifica SQL successiva: `rolcanlogin=false`, **0** eventi in coda.
Non è stato creato nessun servizio Render né configurato alcun secret.
Per continuare serve un'abilitazione amministrativa autorizzata di
LOGIN, la generazione e gestione sicura di una password dedicata,
la verifica del consumo ore Render Free, quindi un runtime isolato
con `npm run audit:outbox:render-staging-preflight`.

### Controllo del pooler verificato nel codice (22 ottobre 2026)

- L'URL del **solo staging Supabase** è vincolato ora al Session Pooler
  realmente mostrato da Connect:
  `aws-1-eu-central-1.pooler.supabase.com:5432`.
  Il guard rifiuta gli hostname generici o i cluster Supavisor con
  un indice differente. Il controllo è applicato sia al **preflight**
  sia all'apertura del **pool del worker**; pertanto un errore non
  raggiunge il database.
- Per il preflight Render si accetta **solo session pooler IPv4**,
  non la connessione diretta IPv6 del piano Free. Nessun cambio al
  percorso `production` o alla CI con PostgreSQL locale.
- Le fixture dei test sono state aggiornate in modo coordinato al
  pooler verificato, compresi test negativi contro cluster simili
  e per la connessione diretta non supportata da Render.
- Il database staging è `ACTIVE_HEALTHY` con
  `demos_outbox_runtime` ancora **NOLOGIN** e nessun evento
  nella coda. Un tentativo precedente di abilitare il ruolo era stato
  respinto dai permessi del provider e dai controlli di sicurezza:
  **non** ripetere con elevazioni o bypass. La prova autenticata
  deve usare un flusso amministrativo autorizzato.
- **Nessun deploy, nessuna password, nessuna modifica alla produzione.**
  Il controllo della disponibilità di ore Free di Render e la scelta
  dell'istanza isolata precedono qualsiasi attivazione.

### LOGIN Supabase abilitato e verificato (22 ottobre 2026)

Dopo l'esecuzione nel pannello SQL Editor da parte dell'utente del
comando `ALTER ROLE demos_outbox_runtime LOGIN`, lettura in sola
lettura dei cataloghi `Demos-Staging` conferma **`rolcanlogin=true`**,
`rolsuper=false`, `rolbypassrls=false`, appartenenza a
`demos_outbox_worker` e grant `SELECT/INSERT/UPDATE/DELETE`
sulla sola tabella `demos_private.audit_delivery_outbox`.
Sono inoltre confermati **0** accessi ad altri oggetti,
**0** routine `SECURITY DEFINER` accessibili,
`CREATE` in `public` negato, **0** eventi in coda e **0** rilievi
Supabase Security Advisor.

**Il requisito LOGIN è completato, ma NON il test di autenticazione.**
Non è stata predisposta alcuna password dall'assistente, nessun secret
è stato installato su Render e non è stato effettuato un handshake
PostgreSQL autenticato dal runtime Render. Per il prossimo GO serve
una credenziale robusta distinta da quella del ruolo amministrativo,
gestita senza esporla nei log, seguita dalla scelta di un runtime Render
isolato e dal preflight senza scritture.

### Preflight autonomo con un solo segreto — verificato in CI

Il comando `audit:outbox:render-staging-preflight` non richiede più
`DATABASE_URL`, quindi non è necessario copiare credenziali
amministrative o del backend principale su Render. Accetta soltanto
`AUDIT_OUTBOX_DATABASE_URL`, uno scope `staging`, il flag esplicito
`AUDIT_OUTBOX_PREFLIGHT_ONLY=true`, i dataset
`AXIOM_DATASET=AXIOM_REALTIME_DATASET=demos-security-staging` e
i flag che controllano worker, invii e archiviazione spenti.
Verifica hostname/porta/progetto **prima** di creare una connessione,
poi esegue solo letture dei cataloghi PostgreSQL e non avvia Express,
Axiom, Firebase o B2. Il normale backend e il worker mantengono
l'obbligo di verificare entrambe le identità di progetto e
**non possono usare l'eccezione di preflight**.

Controllo CI: il preflight con un solo account è accettato in
simulazione, mentre la connessione applicativa normale senza
`DATABASE_URL` resta rifiutata. Sono rifiutati password/host mancanti,
flag operativi abilitati, scope produzione e host Supavisor estranei.
Questo **non** prova un login autenticato da Render.

Prima del deploy occorre decidere quale servizio Render isolato usare
e verificare le **ore gratuite residue direttamente dal dashboard
Billing → Monthly Included Usage**: il connettore disponibile
non espone il saldo di fatturazione. Non creare un nuovo servizio
web Free senza questo controllo: le 750 ore mensili sono condivise
anche con il backend pubblico.

### Verifica effettiva Render in standby e correzione del log (22 ottobre 2026)

Il servizio Free isolato `demos-outbox-readonly-staging`
(`srv-dbckvbivcj2c73f0i7e0`) è stato interrogato realmente da
un client HTTPS del desktop autorizzato, senza credenziali:
`GET /` → **200** con `staging probe pending configuration`;
`GET /healthz` → **503** con `not ready`. Questo conferma lo
stato di attesa, NON il collegamento Supabase.

Nel primo deploy Render `dep-dbckvcavcj2c73f0i9j0` il server loggava
erroneamente `AUDIT_RENDER_STAGING_PREFLIGHT_OK` anche se l'URL
PostgreSQL era assente. Corretta la distinzione nel codice:
assenza della credenziale → `AUDIT_RENDER_STAGING_STANDBY_NO_DB_SECRET`;
solo un controllo PostgreSQL reale riuscito può produrre
`AUDIT_RENDER_STAGING_PREFLIGHT_OK`. Aggiunto test di regressione.
La correzione è stata distribuita con successo in
`dep-dbcl3bivcj2c73f117t0` (commit `4799445e`); i
**log Render** confermano il nuovo stato di standby, senza password
e senza worker/archiviatore.

Restano ancora due passaggi distinti:
1. la password robusta di `demos_outbox_runtime` deve essere impostata
   **dall'amministratore autorizzato** e mai condivisa via chat,
   file GitHub o log;
2. il segreto completo deve essere aggiunto **solo** come
   `AUDIT_OUTBOX_DATABASE_URL` nelle Environment Variables
   di questo servizio Render, usando `Session Pooler` porta 5432.
   NON aggiungere `DATABASE_URL`; flag operativi disattivati.
   Solo allora eseguire un redeploy e verificare `GET /healthz`=200
   insieme a un log `AUDIT_RENDER_STAGING_PREFLIGHT_OK`.
   Prima del test la risposta corretta resta **503**.

### Primo deploy autenticato tentato: URL Render non valido (22 ottobre 2026)

L'utente ha indicato di aver configurato password e URL Render.
Una verifica **senza leggere la password** su Demos-Staging ha
confermato `rolcanlogin=true`, `rolpassword IS NOT NULL=true`
e **0** eventi nella coda. Il servizio Render isolato
`srv-dbckvbivcj2c73f0i7e0` è stato ridistribuito per eseguire
l'autenticazione; il primo deploy `dep-dbclb3q9lscs73e9vj70`
è fallito dopo una build riuscita, con errore generico
`AUDIT_RENDER_STAGING_PREFLIGHT_REJECTED`.

Per distinguere in modo sicuro le cause, è stata aggiunta una
diagnostica a **codici costanti**, senza mai stampare URL, password,
errori driver o contenuti di eventi. Nuovi test unitari controllano
che i codici non includano segreti. La prima prova diagnostica
`dep-dbclcttg1s2s73dmlje0` ha riportato
`AUDIT_RENDER_STAGING_CONFIGURATION_REJECTED`: non era una prova
di password fallita.

Il deploy successivo `dep-dbcle83rjlhs73dt86cg` (commit
`30b1fe91d6d032cbb2f78d2ce88e5baba147f25d`) ha
restituito **`AUDIT_RENDER_CONFIG_URL_INVALID`**. Questo
significa esclusivamente che il valore presente nella variabile
`AUDIT_OUTBOX_DATABASE_URL` su Render non è interpretabile
da `new URL(...)`, **prima** di effettuare qualunque accesso
a Postgres. Non sono state lette, mostrate o cambiate le password.

**Blocco rimanente:** aggiornare il valore della singola variabile
su Render con una URI PostgreSQL completa su una riga, senza
backtick, apici esterni, spazi, righe spezzate o segnaposto. Il formato
(omettendo il segreto reale) è:

```text
postgresql://demos_outbox_runtime.fkeayjzvtuvzesljhjbc:LA_PASSWORD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

Se la password contiene caratteri riservati URL, codificarli
percentualmente nella stringa Render senza cambiare la password
effettiva su Supabase. Esempi: `@` → `%40`, `#` → `%23`,
`%` → `%25`, `/` → `%2F`. Non condividere il valore
completo in chat o nei log. Dopo il salvataggio, avviare un
nuovo deploy e verificare `AUDIT_RENDER_STAGING_PREFLIGHT_OK`
e `GET /healthz` → 200. Fino ad allora il collegamento
Render → Supabase **NON è stato convalidato**.

### Verifica osservazionale Axiom → B2 e preparazione del restore isolato (22 ottobre 2026)

Consultazione **solo read** dei log Render di `demos-backend`,
dalle 18:00 UTC del 21/10 al 22/10, ultimo ciclo
**22/10 alle 00:17:12 UTC**: **10** riepiloghi
`Axiom archive completed:`, **0** righe
`Axiom archive failed:`. Tutti e dieci dichiarano
`caughtUp=true` e `remainingMs=0` per entrambi i dataset.
Somma contatori riportati dai cicli:
`centralized_logs=1170`, `real-time=32`.
**Non sono 1202 eventi unici**: finestre sovrapposte,
ripartenze e batch possono contare gli stessi eventi più volte.
Non è stata verificata l'esistenza o l'integrità di alcun oggetto B2
e non è stata effettuata una query indipendente ai dataset Axiom.

Aggiunto `npm run archive:axiom:verify-readonly-b2` come
strumento di **restore indipendente dalla produzione**, da eseguire
esclusivamente in un ambiente privo di `DATABASE_URL`,
`AUDIT_OUTBOX_DATABASE_URL` e token Axiom. Richiede un account B2
dedicato, con permessi **solo di lettura**, e questi valori espliciti:

```text
B2_RESTORE_READONLY_MODE=true
AXIOM_ARCHIVE_ENABLED=false
B2_BUCKET_NAME=demos-log-archive-eu
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_S3_REGION=eu-central-003
B2_S3_ACCESS_KEY_ID=<impostare nel secret manager>
B2_S3_SECRET_ACCESS_KEY=<impostare nel secret manager>
```

La classe accetta solo i comandi AWS `HeadObject` e `GetObject`,
solo il bucket e il prefisso `demos/axiom-archive/v1/`,
e limita i GET a un range esplicito sotto **8 MiB**.
Riutilizza il restore esistente con verifiche hash SHA-256,
checkpoint, manifest, categorie e fingerprint dei record per
**entrambi** i dataset; stampa solo esiti aggregati e date.
Qualsiasi comando PUT/DELETE o destinazione diversa è rifiutato
prima della chiamata di rete. La CI esercita questo perimetro
con un client fittizio. **La prova con un bucket B2 reale resta
DA FARE**: nessuna chiave B2 è stata copiata dalle variabili
di produzione e non è stata installata nessuna credenziale
nel servizio Render già usato per PostgreSQL.

**Limite FCM chiarito con una query di soli cataloghi SQL
su Supabase `Demos-Staging`:** esiste
`demos_private.audit_delivery_outbox`, ma non esistono
`public.users`, `public.notifiche_demos` né
`public.user_devices`. Il test reale delle notifiche
in-app e Firebase non può quindi utilizzare questo progetto
così com'è. Per il collaudo servono tabelle e amministratori
**esclusivamente sintetici**, un token dispositivo di test
e credenziali Firebase limitate alla prova. Non prelevare
token o destinatari dal database pubblico di produzione.

### 22 ottobre 2026 — Servizio dedicato al restore B2 creato, in standby

**Nuova evidenza osservativa:** nelle 9 esecuzioni ogni ora
dalle **00:17 alle 08:17 UTC del 22 ottobre 2026**, il backend
produttivo ha registrato **9** `Axiom archive completed` e
**0** `Axiom archive failed`; entrambi i dataset sono
`caughtUp=true`, `remainingMs=0` in 9/9. Questa evidenza
riguarda il **job operativo**, non un recupero reale del bucket.

È stato creato su Render, isolato dal backend pubblico e dal
preflight PostgreSQL, il servizio Free
`demos-b2-readonly-restore-staging`
(`srv-dbct3vmq1p3s73d7rhg0`, autoDeploy=no, Frankfurt).
Il deploy iniziale `dep-dbct40eq1p3s73d7rj2g` (commit
`6341383154a9834a21f70f4ed0f4d39f1731a5d1`)
è **live**. I log riportano esattamente
`B2_READONLY_RESTORE_STANDBY_NO_SECRET`: non ci sono
ancora chiavi e **nessun file B2 è stato letto**.
Lo startup senza credenziali serve solo `/healthz` (503
finché non c'è la verifica), non esporta endpoint, oggetti o
password, non avvia worker né job Axiom.
Test della nuova istanza (standby, avvio dopo verifica,
rifiuto credenziali parziali/flag pericolosi) aggiunti alla CI.

**Passaggio necessario per il restore autenticato:** creare
nel pannello Backblaze una Application Key **Read Only**
limitata a `demos-log-archive-eu`, preferibilmente al
prefisso `demos/axiom-archive/v1/`, temporanea, e salvarne
solo ID e secret nelle due variabili d'ambiente
`B2_S3_ACCESS_KEY_ID` / `B2_S3_SECRET_ACCESS_KEY`
del **solo servizio dedicato**. Non inviarle in chat
o copiarle dal backend produttivo. Dopo il salvataggio eseguire
un deploy manuale e verificare un vero `HEAD/GET`,
checkpoint, manifest e file su entrambi i dataset.
Procedura completa:
`B2_READONLY_RESTORE_STAGING_2026-10-22.md`.
Restano **NO-GO** sia l'autenticazione B2 reale sia
l'approvazione della retention GDPR e i collaudi FCM/Axiom.

## Condizioni mancanti per GO

- [x] **Connessione di staging reale — completata il 22/10/2026.**
  Il servizio Render Free `demos-outbox-readonly-staging` ha eseguito
  un preflight SQL autenticato su Supabase `Demos-Staging` tramite
  Session Pooler 5432, ruolo dedicato con permessi minimi.
  Log applicativo `AUDIT_RENDER_STAGING_PREFLIGHT_OK`,
  verifica esterna `GET /healthz`=**200**. Nessuna scrittura nella
  coda, rimasta vuota. Questa voce certifica **soltanto** la connettività
  e il profilo di accesso, non la consegna Axiom o il rollout.
- [ ] **Axiom reale.** Con dataset, token e organizzazione di *test*,
  verificare che una singola operazione sintetica attraversi la coda,
  riceva ACK, sia visibile in Axiom con il medesimo
  `axiom_delivery_id`. Ripetere con Axiom temporaneamente indisponibile.
  Conservare soltanto un verbale degli esiti, senza token né PII.
- [ ] **Backblaze B2 reale.** L'archiviatore produttivo è stato
  verificato indirettamente via Render: **27 completamenti, 0 errori
  segnalati e due dataset caughtUp** nella finestra osservata il 21/10.
  Questo non prova il recupero degli oggetti dal bucket. Vedi
  `AXIOM_ARCHIVE_RENDER_OBSERVATION_2026-10-21.md`.
  Con credenziali EU di *sola lettura*,
  verificare un batch già archiviato con
  `npm run archive:axiom:verify-latest -- centralized_logs` e
  `-- real-time`; se esistono oggetti sovrapposti, usare
  `archive:axiom:verify-overlap` con le chiavi tratte da manifest
  autentici. Nessuna scrittura, cancellazione o modifica ai checkpoint.
- [ ] **Notifiche amministrative.** Su backend isolato, verificare
  notifica in-app e FCM di un admin *di test*, simulare FCM indisponibile,
  controllare retry e assenza di duplicati nel database.
- [ ] **GDPR e responsabilità.** Il titolare e il DPO, se nominato, devono
  approvare finalità, dati ammessi, accessi, retention `pending`/
  `dead_letter`, revisione incidenti e cancellazioni eventuali.
  Vedere `AUDIT_OUTBOX_RETENTION_PROPOSAL_2026-10-21.md`.
  **Non assumere un obbligo GDPR uniforme di conservazione pluriennale.**
- [ ] **Piano operativo e rollout.** Verificare che backend/worker Render
  non restino sospesi oltre le soglie della coda e scegliere un
  monitor esterno per indisponibilità simultanea backend+DB. Preparare
  rollback (disattivare worker e accodamento senza cancellare i record
  persistiti), osservare i contatori aggregati e gli allarmi per un
  periodo concordato prima di considerare il rilascio concluso.

## Sicurezza e costi

- Non attivare alcuna retention automatica o cancellazione
  opportunistica dei dead-letter prima dell'approvazione.
- Mantenere `AUDIT_OUTBOX_ENABLED`, `AUDIT_OUTBOX_WORKER_ENABLED`,
  `AUDIT_OUTBOX_SECURITY_ENABLED`,
  `AUDIT_OUTBOX_ADMIN_ALERTS_ENABLED` spenti finché mancano le verifiche.
- Conservare nello staging soltanto eventi sintetici e rimuoverli dopo
  ogni prova, verificando che la tabella torni vuota.
- Piano Supabase Free: il preventivo per `Demos-Staging` è stato
  **0 USD/mese**, non una garanzia illimitata di capacità o uptime.
- Non trasferire credenziali produttive in CI, file o conversazioni.
- Questa checklist non prova la conformità GDPR e non sostituisce
  l'approvazione della politica di conservazione.

## Materiale di riferimento

- GitHub: https://github.com/Nictolas/DemosApp/pull/218
- `AUDIT_OUTBOX_DESIGN_2026-10-21.md`
- `SUPABASE_OUTBOX_STAGING_VERIFICATION_2026-10-21.md`
- `AXIOM_ARCHIVE_RENDER_OBSERVATION_2026-10-21.md`
- `axiom-b2-log-archive.md`

**Criterio di chiusura del lavoro:** tutte le condizioni GO completate con
evidenza, rilascio in produzione effettuato, verifica post-deploy riuscita,
nessun backlog o dead-letter anomalo e percorso di rollback provato.
