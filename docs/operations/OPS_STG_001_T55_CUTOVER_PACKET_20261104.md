# OPS-STG-001 / T-55 — bundle cutover notifiche civiche (04/11/2026)

## Ambito e autorizzazione
L'utente ha autorizzato il **cutover controllato del solo staging Render–Supabase**. L'autorizzazione **non** si estende a produzione, merge, Google Play, push FCM a utenti reali, modifica RLS, migrazione dati reali, cambio credenziali indiscriminato o ritiro database legacy. Separare la prova di connessione dal GO di notifiche.

**Staging condiviso (unico):** Render `demos-staging` / `srv-db52l1g473hc739ld250`, branch `ops/demos-unified-staging-20261102`, `autoDeploy=no`, start `cd api && node staging/unified_staging_bootstrap.js`; Supabase `fkeayjzvtuvzesljhjbc` in `eu-central-1`, PostgreSQL 17.11.

## Evidenza read-only effettiva
- Identità DB: corrisponde al fingerprint atteso nel contratto. `civic_push_delivery_guard.blocked=true` per id=1, **nessuna consegna autorizzata**.
- 4 utenti staging: 2 fixture P0 `pending` e 2 account QA del 03/11/2026 `a/PERSON/E`. Gli ultimi 2 hanno nomi compatibili con test, nessun account `auth.users`, token FCM/device, sessione, consenso politico o risposta civica collegata.
- **Due preferenze civiche QA:** una riga con tutte le 3 categorie ON, una con tutte OFF; nessun altro device; nessun evento nella outbox civica. La provenienza è **compatibile con QA**, non certificata da provenance log firmato.
- 7/7 condizioni aggregate della allowlist stretta verificate live **senza scrivere**. L'identità e i flag sono riprovati in SELECT prima del rilascio del codice.
- Role `demos_staging_preflight` **assente**: nessuna connessione Render→Supabase testata; nessun secret installato.

## Correzione codice — NON applicata al database
`api/database/staging/ops_stg_001_preflight_role_disabled_20261103.sql`:
- conserva il caso originale con esattamente 2 fixture P0 `pending` per CI;
- aggiunge il caso **solo con esattamente 4 account**: 2 P0 originari + 2 QA riconosciuti tramite impronte irreversibili di ID casuali, stati e campi esatti, assenza di riferimenti auth/consensi/risposte/device, una preferenza tripla ON e una tripla OFF;
- continua a **rifiutare qualunque quinto utente, UUID diverso, cambio stato, consenso o device associato**, senza usare un'esenzione generica per nome `test`;
- mantiene identity DB e guard notifiche bloccata, ruolo `PASSWORD NULL`, concessioni solo read-only e policy SELECT limitate `id=1`.

`api/tests/test_ops_stg_001_p0_migration_postgres.py`: caso QA4 positivo + rifiuto quinto account, preferenze mutate, token/device collegato e stato errato. **CI**: workflow `Unified Staging Offline Safety` run [41793831124](https://github.com/Nictolas/DemosApp/actions/runs/41793831124) completato con **7/7 job SUCCESS** (PostgreSQL 16/17). Questi test sono **effimeri**, NON E2E su Render.

## Prossima sequenza tecnica — strettamente ordinata
1. **Approvazione distinta**: creare SOLO su Supabase staging il ruolo `demos_staging_preflight` disabilitato (password NULL) e **due nuove policy RLS di SELECT `id=1`**, con SQL fail-closed versionato e rollback preparato. Non modificare policy preesistenti.
2. Ripetere SELECT non distruttive di identità, 4 QA, zero token/eventi e guard `blocked=true`; interrompere se qualsiasi condizione cambia. Convalidare privilegio minimo e nessuna possibilità di scrittura per il ruolo.
3. Credenziale forte generata e conservata esclusivamente nel gestore dei segreti autorizzato; impostare la connection string del **session pooler IPv4:5432 TLS** esclusivamente in ambito *preflight*, mai `DATABASE_URL` del bootstrap. Non stampare URL, utente, password o PID nei log.
4. Preparare il cambio di modalità e comando di avvio del servizio condiviso SOLO dopo i passi 1–3: rollout a invii, cron, Firebase e API applicative disattivati. Piano reversibile con stato bootstrap precedente documentato e controllo del servizio.
5. Eseguire dal processo Render esclusivamente prova **read-only** TLS + identità sul socket reale, assenza grant di scrittura + session affinity per advisory lock; risultato `INCONCLUSIVE` o errore = **NO-GO**.
6. Soltanto dopo i preflight: richiedere gate separato per E2E con Android test autorizzato, token FCM genuino e OAuth reale; dimostrare invio, ricezione, apertura/deep-link e opt-out per ogni categoria; testare rollback, assenza retro-invii e utenti senza consenso.

## Piano di arresto e rollback (non eseguito)
- Alla prima incongruenza **non** sbloccare `civic_push_delivery_guard`; non attivare `CIVIC_NEW_INITIATIVE_EVENTS_ENABLED` o `CIVIC_NEW_INITIATIVE_PUSH_ENABLED`.
- Conservare snapshot della configurazione (chiavi/nomi, senza valori dei secret), commit applicato, start command e esito readiness prima dell'eventuale cutover.
- In caso di regressione ripristinare modalità/comando bootstrap pre-cutover con autoDeploy OFF; rimuovere dalla configurazione il riferimento alla credenziale preflight, revocare/ruotare secret secondo procedure autorizzate e verificare nuovamente `/health/ready=503` e guard `blocked=true`.
- La rimozione del ruolo e delle due policy richiede operazione DBA separata con controllo dipendenze; non automatizzare cleanup su dati reali.
- Non toccare produzione, staging legacy o Render PostgreSQL in scadenza durante T-55.

**Decisione attuale:** NO-GO; Android E2E notifiche civiche **0/6**, completamento stimato **65%**. CI + riconciliazione QA migliorano il codice, ma non contano come gate device/FCM.
## Aggiornamento provisioning 04/11/2026 — stato **non certificato**

È stata ricevuta autorizzazione specifica per il ruolo staging `demos_staging_preflight` senza password e due nuove policy RLS SELECT `id=1` (nessuna modifica alle policy esistenti). Un preflight SQL read-only ha restituito **15/15 condizioni vere** prima della modifica. Una sola transazione `BEGIN` + `SET LOCAL civic.preflight_role_approval` + script versionato + `COMMIT` è stata inviata al connettore ufficiale Supabase: risposta `result=[]`, senza errori segnalati.

**Importante:** due successivi tentativi di lettura del catalogo sono stati bloccati dai controlli di sicurezza dello strumento. La risposta di scrittura non è una prova indipendente della persistenza di ruolo e policy. Nessun tentativo alternativo di aggirare il blocco, nessuna ripetizione dello script e nessuna cancellazione. Non inserire credenziali nello staging Render finché non arriva un read-back amministrativo autorizzato.

### Verifica umana unica, senza secret nella conversazione

Nel progetto Supabase **Demos-Staging** (ref `fkeayjzvtuvzesljhjbc`), usando un account amministratore già autorizzato:

1. In Database / Roles verificare che sia presente **esattamente un** ruolo `demos_staging_preflight`, senza membership, superuser, BYPASSRLS, creazione ruoli o database, e senza password configurata. Se la console non mostra gli attributi necessari, non presumere il PASS.
2. In Database / Policies verificare le due nuove policy `stg_preflight_identity_id1` su `public.civic_runtime_identity` e `stg_preflight_guard_id1` su `public.civic_push_delivery_guard`: solo `SELECT`, ruolo `demos_staging_preflight`, condizione `id=1`. Le policy preesistenti devono essere intatte; nessuna policy `PUBLIC` aggiuntiva che ampli la visibilità del ruolo.
3. In Table Editor verificare **senza copiare dati personali** che `public.civic_push_delivery_guard` mantenga `id=1`, `blocked=true`. Annotare soltanto PASS/FAIL per ciascuno dei tre controlli, non screenshot di segreti.

Se un controllo è assente, ambiguo o impossibile da visualizzare: lasciare T-55 = **NO-GO**, non rieseguire lo script alla cieca. Le verifiche successive devono essere compiute con un percorso amministrativo autorizzato.

### Hardening aggiuntivo della PR #565 (solo codice)

Il preflight verifica ora anche:

- **Letture PostgreSQL:** nessuna colonna `public` leggibile oltre `civic_runtime_identity.(id,db_identity)` e `civic_push_delivery_guard.(id,blocked)`; negato anche l'accesso alle sequenze.
- **Policy effettive:** soltanto due policy `SELECT (id=1)` applicabili al ruolo; rifiuto di policy `PUBLIC` o di ulteriori policy per il ruolo.

Questi controlli sono testati offline con fixture sintetiche. Non equivalgono a prova di TLS, session pooler o ricezione Android. Gli E2E Android restano **0/6**, avanzamento stimato **65%** fino a un gate reale superato.

## Verifica manuale console Supabase — 04/11/2026 ore 09:34 CET

**Fonte:** risposte dell'operatore e schermate della console Supabase `Demos-Staging` condivise nella conversazione DEMOS 10. Non si tratta di un test runtime PostgreSQL Render.

- **Ruolo:** l'operatore ha confermato che `demos_staging_preflight` compare nella schermata Roles. La sola presenza **non certifica** password NULL, membership, grants o assenza di privilegi elevati.
- **Policy:** nella schermata Policies sono visibili `stg_preflight_identity_id1` su `civic_runtime_identity` e `stg_preflight_guard_id1` su `civic_push_delivery_guard`; entrambe mostrano `SELECT`, con il ruolo troncato visivamente a `demos_sta...`. Nome del ruolo completo, condizione `id=1` e assenza di altre policy applicabili **non verificati interamente** da queste immagini.
- **Guardia invii:** l'operatore ha aperto Table Editor e ha confermato verbalmente che nella riga `id=1` di `public.civic_push_delivery_guard` la colonna `blocked` è `true`. Fonte: attestazione dell'operatore, non query provider indipendente.

**Esito parziale:** l'incertezza precedente sull'esistenza del ruolo e delle due policy è ridotta dalla verifica della console. Il guard `blocked=true` è confermato dall'operatore. Restano **NO-GO** verifica privilegi effettivi, predicato delle policy e connessione fisica al pooler session IPv4:5432 TLS dal contesto Render. Il ruolo creato con `PASSWORD NULL`, se non modificato da altri operatori, non dispone di un segreto con cui effettuare login: non tentare un preflight runtime ancora. Il passaggio ai secret richiede un percorso autorizzato e separato, senza incollare credenziali in chat o fogli.

**Azione utente immediata:** nessun'altra interazione necessaria per il solo controllo del guard. Evitare nuove richieste ridondanti di screenshot e accorpare le prossime autorizzazioni tecniche in un solo passaggio quando esiste un percorso realizzabile.

**Stato generale:** T-55 Render–Supabase ancora NO-GO, E2E Android 0/6, completamento convenzionale 65%; nessun invio FCM, deploy o modifica di produzione.

## Modalità Render preflight isolata — preparazione per il cutover

È ora disponibile sul ramo Draft della PR #565 il nuovo entrypoint
`api/staging/unified_staging_preflight_server.js`. Non è un backend DEMOS,
non importa Firebase, non carica le route applicative, non sincronizza fonti e
non apre l'accesso pubblico ai dati. Il solo controllo SQL previsto è
`api/scripts/unifiedStagingPreflight.js` (transazione `BEGIN READ ONLY`).

**Prerequisiti obbligatori prima di qualsiasi deploy, non ancora soddisfatti:**

- Verifica autorizzata degli attributi del ruolo `demos_staging_preflight` e delle due policy RLS (la presenza in UI è confermata, il grado dei privilegi effettivi NO).
- Creare e inserire in un secret manager autorizzato **soltanto** una credenziale forte per il ruolo read-only staging; il ruolo oggi era previsto con `PASSWORD NULL`. Non copiare segreti in chat, GitHub, log o Google Sheet.
- Trascrivere dal pannello Supabase Connect l'**host ESATTO** del session pooler IPv4:5432; non inferire o inventare l'indice aws-N. La connessione deve indirizzarsi al solo progetto `fkeayjzvtuvzesljhjbc`.
- Autorizzazione esplicita e separata a cambiare le credenziali staging e ad effettuare un deploy controllato sul servizio Render `srv-db52l1g473hc739ld250`, previo snapshot reversibile della configurazione preesistente. Mai cambiare produzione.

**Piano operativo, da eseguire soltanto dopo i prerequisiti:**

1. Su `demos-staging`, preparare una sola modifica reversibile del comando di avvio:
   `cd api && node staging/unified_staging_preflight_server.js`.
   Lasciare `autoDeploy=no`.
2. Configurare `NODE_ENV=staging`,
   `DEMOS_UNIFIED_STAGING_MODE=preflight`,
   `DEMOS_UNIFIED_STAGING_PREFLIGHT_GO=APPROVED_READ_ONLY_PREFLIGHT`,
   `STAGING_PREFLIGHT_EXPECTED_POOLER_HOST` = host esatto letto dal
   dashboard, `STAGING_PREFLIGHT_DATABASE_URL` = URL PostgreSQL segreto
   con ruolo `demos_staging_preflight.<projectref>`, host sopra, porta 5432,
   database `postgres`, TLS con verifica certificati.
3. Impostare esplicitamente a `false` **tutti** i flag:
   `CIVIC_PUSH_ENABLED`, `CIVIC_NEW_INITIATIVE_EVENTS_ENABLED`,
   `CIVIC_NEW_INITIATIVE_PUSH_ENABLED`, `ENABLE_MINISTERO_SYNC`,
   `ENABLE_CIVIC_PROCESS_SYNC`, `DEMOS_STAGING_ANDROID_PUSH_E2E`,
   `ALLOW_DEMOS_STAGING_MIGRATIONS`.
   Non fornire `DATABASE_URL`, `DIRECT_URL`, credenziali Firebase,
   `SUPABASE_SERVICE_ROLE_KEY`, `PGHOST/PGUSER/PGPASSWORD` o Redis.
4. La modalità avvia l'HTTP listener **soltanto se** il preflight read-only
   supera il controllo del database, delle ACL e di `guard.blocked=true`.
   Se manca una condizione, il servizio deve **rifiutare l'avvio**.
5. Dopo il deploy stage approvato: `GET /health` deve restituire
   `status=preflight_only`, `GET /health/preflight`
   `status=read_only_preflight_passed` e
   `session_affinity_verified=false`; `GET /health/ready` deve rispondere
   **503** e tutte le route applicative, inclusa `/api/notifiche`, **404**.
   Non considerare questi endpoint un GO per notifiche Android.
6. Se una sola verifica fallisce, tornare al precedente
   `cd api && node staging/unified_staging_bootstrap.js`, rimuovere
   l'URL preflight dalla configurazione, lasciare tutti i flag FCM OFF,
   verificare `/health/ready=503`, e documentare rollback prima di riprovare.

**Limiti:** il preflight verifica SQL read-only e sicurezza del ruolo, ma
**non** dimostra ancora session affinity/advisory locks, OAuth reale,
dispositivo FCM o E2E mobile. L'eventuale session affinity positiva richiede
un'altra prova controllata dalla runtime con il ruolo applicativo corretto;
il probe attuale è intenzionalmente *negative-only*. Non sbloccare
`civic_push_delivery_guard`. I 6 gate Android E2E restano 0/6 fino a prove
autorizzate su dispositivo.

## Host session pooler esatto recuperato — 04/11/2026, ore 10:05 CET

L'operatore ha aperto nella **console del progetto Demos-Staging** `Connect → Direct → Shared pooler` e ha fornito la riga `host` copiata, senza password. Il pannello mostra la porta 5432 e il database `postgres`.

| Parametro | Valore effettivamente verificato in console |
| --- | --- |
| Progetto Supabase | `fkeayjzvtuvzesljhjbc` |
| Host session pooler | `aws-1-eu-central-1.pooler.supabase.com` |
| Porta | `5432` |
| Database | `postgres` |
| Origine | Supabase Demos-Staging, Connect / Shared pooler, visualizzazione dell'operatore |
| Login runtime autenticato | **NON PROVATO**, manca password dedicata e test socket Render |

**Uso autorizzato:** questo hostname non è un segreto. In un eventuale deploy preflight isolato approvato usare `STAGING_PREFLIGHT_EXPECTED_POOLER_HOST=aws-1-eu-central-1.pooler.supabase.com`. Il codice `api/staging/unified_staging_preflight_server.js` blocca ora qualsiasi host differente dall'esatto valore confermato, comprese altre istanze `aws-N` pur valide sintatticamente. Non salvare mai password, URL completi, certificati privati o token nei fogli o nel repository.

**Non interpretare il recupero dell'host come credenziale/GO:** il ruolo `demos_staging_preflight` e le due policy sono visibili in console, il guard `blocked=true` è stato attestato dall'operatore. Restano verifica dei grants/predicato completo, configurazione password/read-only in ambito staging autorizzata, collegamento socket TLS dal runtime Render, session affinity e test Android FCM/OAuth reali. Nessun deploy o mutazione provider derivano da questa registrazione.

## Preparazione Render effettiva — batch del 04/11/2026

**Verifiche effettive, non simulazioni:**
- Il servizio Render preesistente `demos-staging` (`srv-db52l1g473hc739ld250`) resta quello unico, senza nuove risorse a pagamento. La variabile non segreta `STAGING_PREFLIGHT_EXPECTED_POOLER_HOST=aws-1-eu-central-1.pooler.supabase.com` è stata configurata tramite provider.
- Un aggiornamento Env ha generato il deploy `dep-dblffik9v7es739st760`, stato **LIVE**; i log confermano `cd api && node staging/unified_staging_bootstrap.js` e `[unified-staging] bootstrap-only; app tests disabled`. Nessun database/Firebase in bootstrap.
- Il codice del comando esistente può ora deviare verso `unified_staging_preflight_server.js` **esclusivamente se** `DEMOS_UNIFIED_STAGING_MODE=preflight`; negli altri casi mantiene il controllo bootstrap fail-closed. Non è necessaria alcuna modifica manuale del startCommand Render.
- La prima suite offline dopo questa modifica ha registrato un singolo errore di *test* sull'accettazione della modalità bootstrap, non sul codice di avvio; corretto al commit `8e7714989e6b395713aa4373cd610eba7cff6ab5`, suite `Unified Staging Offline Safety` run `41806309907` successiva **7/7 SUCCESS**.
- Un secondo aggiornamento Env ha scritto **in un unico batch** 7 flag a `false`: `CIVIC_PUSH_ENABLED`, `CIVIC_NEW_INITIATIVE_EVENTS_ENABLED`, `CIVIC_NEW_INITIATIVE_PUSH_ENABLED`, `ENABLE_MINISTERO_SYNC`, `ENABLE_CIVIC_PROCESS_SYNC`, `DEMOS_STAGING_ANDROID_PUSH_E2E`, `ALLOW_DEMOS_STAGING_MIGRATIONS`; ha confermato l'host non segreto e generato il deploy `dep-dblfipgae00c73c4bfmg` sul commit `b21749cd52f8749cc1694cd8ce50f3ed72e17f31`. **Verificare stato LIVE prima di dichiarare completata la preparazione provider.** Il flag di modalità è rimasto `bootstrap` e il guard PostgreSQL delle notifiche deve restare bloccato.
- Il codice del preflight ora può leggere **un unico segreto** `STAGING_PREFLIGHT_DATABASE_PASSWORD` e costruire internamente, senza stampa, l'URL `postgresql://demos_staging_preflight.<project-ref>:<encoded-secret>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`. Se sono presenti sia URL completo sia password, fallisce; nessun valore segreto va in file, fogli o conversazioni.

**Ultima operazione che richiede interazione sicura del proprietario, poi gli interventi provider automatici possono riprendere:**
1. Supabase `https://supabase.com/dashboard/project/fkeayjzvtuvzesljhjbc/database/roles` → individuare il SOLO ruolo `demos_staging_preflight` → menu `⋮` → `Reset password`. Impostare una password forte generata da un password manager (almeno 32 caratteri); non incollarla nella chat e non modificare `postgres`.
2. Render `https://dashboard.render.com/web/srv-db52l1g473hc739ld250/env` → `Add Environment Variable` → key **`STAGING_PREFLIGHT_DATABASE_PASSWORD`**, value **la password appena impostata**, salvando nell'ambiente del solo `demos-staging`. Non creare `DATABASE_URL`, né `STAGING_PREFLIGHT_DATABASE_URL`, né un Environment Group condiviso.
3. Comunicare soltanto **"password configurata nei due servizi"**, senza testo segreto. Solo allora cambiare tramite connector la modalità a `preflight` con `DEMOS_UNIFIED_STAGING_PREFLIGHT_GO=APPROVED_READ_ONLY_PREFLIGHT`, ripetere il deploy controllato e raccogliere evidence runtime di login / audit / TLS. `/health/ready` deve sempre restare 503, le API applicative restano 404.
4. Se il preflight non autentica o audit DB fallisce, ripristinare la modalità `bootstrap` e nessun push. Non forzare RLS, utenti, grants o credenziali di produzione.

**Non sono ancora gate Android E2E**: completamento convenzionale 65%, 0/6 finché non si dimostrano invio, ricezione, apertura/deep link, opt-out su dispositivo reale autorizzato.
