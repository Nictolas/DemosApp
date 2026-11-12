# DEMOS — staging unico: prima fase di sola disponibilità, senza database (27 ottobre 2026)

## Perché esiste

Il ramo storico `staging/functional-integration-v0` è troppo divergente da
`main` e il suo bootstrap non attesta il progetto database di destinazione.
Questa PR prepara una **modalità di prova limitata**, che non esegue app,
route, SQL, migrazioni, job né chiamate ai provider. È basata sul `main`
corrente ma resta Draft. Non modifica Render, Supabase, credenziali o dati.

**La modalità non è uno staging GDPR funzionante.** Il recovery dell'issue
[#296](https://github.com/Nictolas/DemosApp/issues/296) resta NO-GO.

## Profilo 1 — readiness-only, da autorizzare prima del deploy

L'eventuale candidato da riutilizzare è il servizio Render
`demos-functional-staging` (`srv-db52l1g473hc739ld250`), con un futuro
ramo basato su `main` e il comando esclusivo:

```sh
cd api && node staging/isolatedStagingServer.js
```

Il normale entrypoint di produzione resta **inalterato**. Il comando sopra
non carica `api/server.js` o `api/app.js`: apre soltanto il server HTTP
nativo di Node e risponde 200 a `GET /__staging/health`, con corpo fisso
`status=preflight-only`, `gdprReady=false`,
`databaseConnected=false`, `externalProvidersConnected=false`.
Ogni altra rotta e ogni metodo di scrittura rispondono **404**.
Il 200 indica solo l'avvio del piccolo processo, non la disponibilità di
DEMOS, del database o del recovery.

La fase 1 richiede soltanto:

- `NODE_ENV=production` (in modo che un futuro full app non abiliti route dev).
- `DEMOS_DEPLOYMENT_SCOPE=isolated-staging`.
- `DEMOS_STAGING_PROJECT_ID=fkeayjzvtuvzesljhjbc` (identificatore pubblico,
  non una credenziale; usato ora per verificare la configurazione prevista).
- `DEMOS_STAGING_RUNTIME_PROFILE=readiness-only`.
- `DEMOS_STAGING_CONFIRMATION=synthetic-only-no-prod-providers` (opt-in,
  **non** token di autenticazione).
- `PORT` numerica fra 1 e 65535, preferibilmente assegnata da Render.

**Non impostare `DATABASE_URL` in fase 1.** Non impostare neanche
`DATABASE_POOL_MAX`, `DATABASE_POOL_MIN`, `JWT_SECRET`, chiavi FCM,
Firebase, Axiom, B2, Supabase, Redis, SMTP, Google o flag `ENABLE_*`.
Il guard utilizza una allowlist stretta per qualsiasi env valorizzata,
incluse chiavi inserite da Render: quelle non riconosciute bloccano l'avvio
e richiedono review, non aggiramento del controllo.

Il wrapper verifica le env prima di aprire persino il socket HTTP.
`api/app.js` blocca espressamente **qualsiasi avvio dell'applicazione
completa in modalità `isolated-staging`**, anche se qualcuno invoca
per errore l'entrypoint storico. Il blocco si applica prima di importare
Express, le route o i moduli che potrebbero aprire connessioni.
La produzione senza quel flag segue esattamente il proprio percorso.

### Render Free: limite strutturale all'ingress (verificato su documentazione ufficiale)

Il servizio web Render candidato è attualmente sul piano **Free** e ha
`ipAllowList=0.0.0.0/0`: è **pubblicamente raggiungibile**. Secondo la
[documentazione ufficiale Render sulle Inbound IP Rules](https://render.com/docs/inbound-ip-rules),
le restrizioni IP sui **web service** richiedono un workspace
**Scale o Enterprise**: non basta acquistare il solo compute Starter.
La documentazione [Free](https://render.com/docs/free) conferma inoltre
che i web service Free non possono ricevere connessioni dalla rete privata
di Render. La documentazione sui [Private Services](https://render.com/docs/private-services)
e [First Deploy](https://render.com/docs/your-first-deploy) conferma
che un servizio realmente privato è una risorsa distinta, **non gratuita**.

**Decisione tecnica per il piano attuale: NO deploy sul web service Free
come staging GDPR "non pubblico".** Anche un endpoint health senza
credenziali non soddisfa il criterio di ingress non pubblico.
Continuare i test readiness-only nel runner effimero di GitHub Actions
finché non viene approvata e verificata una delle seguenti soluzioni:

- workspace Scale/Enterprise con restrizioni IP effettive, sempre
  **da testare in ingresso e da valutare economicamente**; oppure
- private service Render a pagamento con rete/test runner compatibili,
  isolamento indipendente dei provider e piano costi approvato; oppure
- un'alternativa isolata senza web service pubblico, con un piano di
  provisioning, rete, ruoli e rollback sottoposto a nuova approvazione.

Non dedurre che una variabile env, una route che risponde 404, una
protezione Supabase DB o una rete privata di Render impediscano l'accesso
pubblico al web service: sono livelli di sicurezza diversi.
La configurazione di Network Restrictions di Supabase riguarda
**PostgreSQL e il pooler**, non le API HTTP del progetto, come precisa
la [documentazione Supabase](https://supabase.com/docs/guides/platform/network-restrictions).

Questa conclusione **non richiede né autorizza upgrade, costi,
provisioning, sospensioni o eliminazioni**. Il piano operativo di seguito
resta uno schema preparatorio per un'infrastruttura adeguata e approvata.

### Controlli ancora richiesti prima di attivare anche la sola fase 1

1. Approvare **uno specifico piano Render** (servizio, ramo, start command,
   env consentite, ingress, rollback e health check). L'eventuale merge della
   PR richiede autorizzazione separata perché `main` effettua auto-deploy.
2. Verificare e isolare ingress e reti provider, dipendenze e webhook esterni.
   La allowlist delle env non dimostra l'isolamento dell'infrastruttura.
3. Verificare che il servizio non sia utilizzato da consumer di produzione e
   che il vecchio ramo possa essere ritirato senza interrompere prove.
4. Testare le sole risposte `/__staging/health` e 404 su route applicative
   e confermare che non siano state aperte connessioni ai provider.

## Piano operativo di rilascio fase 1 — REVIEW, NON AUTORIZZAZIONE (metadata Render 27/10/2026)

**Target esatto:** `demos-functional-staging`, servizio Render
`srv-db52l1g473hc739ld250`, workspace «Nicolas».
**Baseline attualmente distribuita:** deploy `dep-db8bf3gm7kps73dpusu0`,
commit `645d72d37b9178233b7f66c7433cb90e51bf585c`,
comando `cd api && node index.js`, ramo configurato
`staging/functional-integration-v0`, `autoDeploy=no`.
**Rischio concreto:** Render espone attualmente il servizio con
`ipAllowList=0.0.0.0/0`, `maintenanceMode=false` e nessun
`healthCheckPath` configurato. Il processo readiness-only **nella fase originaria** ascoltava su
`0.0.0.0`. Dopo la decisione gratuita del 28/10/2026 il solo processo
di prova è stato vincolato esplicitamente a `127.0.0.1`: un futuro
deploy Render del nuovo codice non è ora raggiungibile dall'esterno, ed
è **intenzionalmente non supportato** senza nuova review/autorizzazione.
Il binding locale non sostituisce un firewall né attesta egress.
Nessuno di questi metadata prova l'isolamento delle connessioni in uscita,
delle variabili ereditate o l'assenza di consumer esterni.

### Gate 0 — inventario e decisione (solo letture non sensibili)

- Congelare nel verbale **ID servizio, branch, deployed SHA, start command,
  auto-deploy, IP allowlist, maintenance, URL e health check**; annotare ogni
  differenza riscontrata prima della finestra. Non leggere env o segreti.
- Il responsabile infrastruttura deve attestare **fuori da questa PR**
  chi usa URL pubblica/interna: GitHub Actions, webhook, cron, monitor,
  callback, probe e operatori. La sola ricerca nel repo e metriche vuote
  non dimostrano assenza di dipendenze. Bloccare se manca l'attestazione.
- Definire e far verificare **ingress non pubblico** (IP allowlist
  stretta o controllo equivalente verificabile) e **egress/provider
  quarantine** indipendente dal codice. L'allowlist delle env è difesa
  aggiuntiva, non firewall; metadata Render attuali non attestano egress.
  Bloccare il rollout se non si può dimostrare la segregazione.
- Confermare che nessun environment group o configurazione del servizio
  possa introdurre variabili non ammesse: **verifica da parte
  dell'operatore autorizzato senza pubblicarne nomi/valori sensibili**.
  Il processo deve fallire chiuso, non si deve ampliare l'allowlist per
  adattarsi a credenziali presenti.

### Gate 1 — proposta di change separata, da approvare prima di agire

- **Autorizzazione A, distinta:** eventuale merge della PR Draft `#369`
  in `main`; Render backend/frontend hanno auto-deploy e un merge non
  è neutro anche se il percorso di produzione senza scope è invariato.
  In alternativa preparare un ref immutabile approvato per il solo staging.
- **Autorizzazione B, distinta e successiva:** cambiare *solo* sul servizio
  `srv-db52l1g473hc739ld250` ref/branch, start command e profilo
  readiness-only; approvare anche ogni modifica ingress/egress e
  configurazione Render con lista esatta di operazioni e responsabile.
  Nessun database, schema, ruolo SQL, provider o worker va attivato.
- Registrare SHA immutabile da distribuire, hash delle prove CI sull'HEAD,
  finestra, responsabile, snapshot dei soli metadata e punto di arresto.
  **Nessuna fase 2** implicita e nessun riuso del vecchio `stagingMigrate`.

### Gate 2 — prove post-change, SOLO dopo autorizzazioni A/B

1. Verificare dal deployment Render il commit **esatto** e l'entrypoint
   `node staging/isolatedStagingServer.js`; non dedurre dal solo GitHub.
2. Con ingresso autorizzato verificare `GET /__staging/health` =
   `200` con `gdprReady=false`, `databaseConnected=false` e
   `externalProvidersConnected=false`; le route normali e POST = `404`.
   `200` **non significa** GDPR pronto.
3. Verificare separatamente che ingress non autorizzato sia negato,
   egress/provider sia segregato e non siano partiti worker, SQL,
   Firebase o altri processi. Se la prova indipendente manca: **NO-GO**.
4. Archiviare solo timestamp, SHA, stato dei gate, risultati sintetici
   e firme degli approvatori; mai password, URL di connessione o eventi
   GDPR reali.

### Abort e rollback (piano, NON esecuzione)

- Qualunque env inattesa deve provocare `DEMOS_STAGING_BOOT_REJECTED`
  **prima** di aprire HTTP; un crash/fail-closed è esito corretto, non
  motivo per inserire segreti o lanciare `api/index.js`.
- In caso di ingresso pubblico non previsto, egress non attestato,
  route applicative raggiungibili o commit errato: **fermare la finestra
  e mantenere il servizio non utilizzabile** tramite azione di
  isolamento approvata; non fare fallback automatico al vecchio ramo.
- Il precedente deploy `645d72` è un riferimento storico per eventuale
  ripristino, **non una baseline di sicurezza certificata**: riattivarlo
  richiede una nuova autorizzazione e verifica delle sue connessioni.
  Se non esiste una baseline sicura, rollback significa **restare
  isolati/non disponibili** finché il titolare approva un nuovo piano.
- Nessun rollback o sospensione è autorizzato da questa checklist.
  Recovery GDPR `#296` rimane **NO-GO** anche se tutti i test di
  readiness-only sono verdi.

## Profilo 2 — staging funzionale e GDPR: NON implementato né autorizzato

La funzione pura `assertStagingDatabaseTarget(url)` è già testata con URL
**inventati** ma **non** viene invocata dal processo readiness-only. Verifica
solo la forma di un futuro URL verso il progetto Supabase staging:
endpoint diretto `db.<project-ref>.supabase.co` o pooler Frankfurt con
username qualificato `demos_staging_runtime.<project-ref>`, database
`postgres`, porta ammessa e parametri SQL limitati.

Questa funzione NON dimostra la destinazione effettiva dopo la connessione,
l'esistenza del ruolo, RLS, privilegi SQL, identità dei provider o assenza
di side effect. Non riutilizzare la password o il ruolo amministrativo
della produzione per superare il controllo.

Prima della futura fase 2 serviranno:

- Approvazione di un database staging durevole, indipendente e popolato
  **soltanto con dati inventati**. **Catalogo verificato nuovamente il
  28/10/2026 (letture solo metadata):** `Demos-Staging` presenta **sette
  tabelle `public`**, incluse `privacy_erasure_ledger` e
  `privacy_erasure_delivery_outbox`; tutte hanno `RLS=true` e
  `FORCE RLS=true`. Esistono i ruoli `demos_staging_runtime` e
  `demos_staging_b2_worker` (entrambi senza `BYPASSRLS` e senza
  `SUPERUSER`). Il precedente inventario «zero tabelle public» è
  **superato**; la presenza di strutture e policy non attesta né la
  provenienza di ogni riga né l'isolamento del processo applicativo.
- **Non rieseguire automaticamente bootstrap, migrazioni, DDL o GRANT**
  sulla base della checklist storica: ledger e outbox sono già presenti.
  Prima di qualsiasi modifica futura verificare separatamente la storia
  delle migrazioni, la corrispondenza esatta di schema/colonne/indici,
  policy e privilegi rispetto al codice da testare, l'origine sintetica
  dei dati, e un piano di rollback **senza perdita del ledger**. Le prove
  precedenti con `SET ROLE` e `ROLLBACK` non attestano il vero runtime
  Render né un login riuscito del processo tramite credenziali dedicate.
  DDL, login, network e test con il runtime richiedono approvazioni distinte.
- Attestazione effettiva, tramite il pool del backend staging, di
  `current_user`, `session_user`, `current_database()`, RLS/ACL
  dai soli cataloghi, senza leggere eventi GDPR o righe degli utenti.
- Audit di moduli/cron/webhook, ingress/egress, notifiche e provider esterni
  con criterio fail-closed e piano di rollback.
- Nuova modifica al codice, test e autorizzazione specifica per abilitare
  solo le route funzionali desiderate; **non basta cambiare un flag**.
- Quarantena e verifica indipendente B2 prima di qualunque prova di recovery.

Il vecchio Render PostgreSQL Free `demos-civic-staging-db` riporta
`expiresAt=2026-11-08T17:38:42Z` e non è una base durevole. Non lanciarvi
restore o migrazioni GDPR, né puntare il vecchio bootstrap `stagingMigrate`
direttamente a Supabase: quel codice verifica il nome del database Render,
non il progetto Supabase effettivo.

## Evidenze di questa PR

- Test Node 22 con dati e URI esclusivamente sintetici, nessun segreto reale.
- Rifiuto della **stessa URL staging valida** quando viene inserita in
  `DATABASE_URL` nel profilo readiness-only: zero credenziali DB necessarie.
- Rifiuto di env/provider sconosciuti, credenziali produzione e porte errate.
- Controllo futuro SQL target separato e senza rete, con casi diretti/pooler
  approvati o respinti.
- Verifica HTTP in loopback che `/__staging/health` è l'unica rotta
  disponibile; API utente/amministratore e POST restituiscono 404.
- Il full app in `isolated-staging` è bloccato prima di importare Express,
  PostgreSQL, Firebase o altri servizi.
- **I test non attestano l'isolamento reale di Render/Supabase.**

Nessun merge, deploy, modifica infrastrutturale, DDL/GRANT, accesso a segreti,
copia di dati reali, restore o dismissione di staging autorizzati da questa PR.

---

## Decisione 28/10/2026: staging gratuito, solo CI sintetica (autorizzata come piano)

**Scelta del titolare:** nessun costo nuovo, provisioning, merge, deploy,
modifica Render/Supabase, DDL/GRANT, credenziale, evento o oggetto B2 reale.
Il piano permette i test sintetici già autorizzati, non abilita provider.

### Evidenze indipendenti (read-only)

- Repository `Nictolas/DemosApp` **pubblico**: GitHub Actions con runner
  standard GitHub-hosted è gratuito per repository pubblici secondo
  https://docs.github.com/en/actions/concepts/billing-and-usage .
  Non usare larger runners o servizi a pagamento; rivalutare il costo se
  il repository diventasse privato.
- I nove web service Render di staging restano Free con ingress pubblico
  `0.0.0.0/0`. Render consente inbound-IP rules sui web service solo ai
  workspace Scale/Enterprise (https://render.com/docs/inbound-ip-rules).
  Quindi un web service Free, anche con password, 404, CORS o RLS, NON
  soddisfa la richiesta di staging GDPR non raggiungibile da Internet.
- Il progetto Supabase `Demos-Staging` è attivo su PG17; sette tabelle
  `public` con RLS e FORCE RLS true. Questo prova soltanto metadati di
  schema: nessun login runtime Render, isolamento egress, provenienza
  delle righe o attestazione B2 sono stati dimostrati.
- PR Draft #369, HEAD di riferimento `01844bc`: i test del readiness-only
  sono già 3/3 workflow verdi; non integra la full app.
- PR Draft #376, HEAD `d50c2f3`: GitHub Actions run
  https://github.com/Nictolas/DemosApp/actions/runs/40705138350
  ha composto #374 e #376 SOLO nel worktree effimero, con 3/3 job
  riusciti e 53/53 regressioni PG17 sintetiche riuscite.
  Il provider B2 dei test è un mock. Non è un restore.

### Soluzione zero costo, eseguibile dal cellulare senza accendere il PC

1. **Unico staging di test attivo: GitHub Actions effimero** con PG17
   locale al job, utenti/UUID/credenziali SQL interamente inventati,
   FakeB2 e nessuna chiave Render/Supabase/Axiom/B2.
2. **Readiness:** usare la suite esistente #369, comando
   `node --test api/tests/isolatedStagingGuard.test.js` nel workflow.
   Il 200 di `GET /__staging/health` certifica solo il piccolo processo
   (`gdprReady=false`, `databaseConnected=false`). Tutte le API vere 404.
   Nessun deploy Render richiesto o approvato.
3. **Backend GDPR e integrazione:** usare il job già verde
   `gdpr-composed-draft-synthetic` della #376 che monta #374 senza
   creare un commit; verificare SHA e CI ad ogni nuovo HEAD.
   PostgreSQL, ruoli, revoca, idempotenza, export, outbox, rollback
   e ricevute simulano solo dati inventati.
4. **Interfaccia Android:** build o prove con API finte in CI, oppure
   in seguito test locali facoltativi sul PC con Docker/Supabase CLI
   e loopback `127.0.0.1`; non esporre mai lo stack locale su Internet.
   Supabase docs: https://supabase.com/docs/guides/local-development .
5. **Demos-Staging e Render Free:** restano in sola lettura metadati;
   non collegare fra loro servizi o provider, non eseguire migrazioni,
   bootstrap, modifiche env, deploy o prove con righe personali reali.
6. **Provider/ripristino reale:** segnare `VERIFICA NECESSARIA` o NO-GO
   per identità e privilegi effettivi del writer Render, attestazione
   esterna B2, quarantena indipendente dei provider e restore.
   Nessuna deduzione da smoke-test HTTP, metadati o prove FakeB2.

### Minacce residue e criteri di arresto

- I runner GitHub Actions possono avere rete in uscita: l'assenza di
  credenziali e i mock mitigano il rischio, ma non provano un blocco
  indipendente dell'egress. Non affermare `isolamento di rete verificato`.
- Nessun dato reale e nessun accesso a URL, secret, bucket o credential
  di provider è ammesso nei test di questa fase.
- I runner standard sono gratuiti qui perché il repo è pubblico;
  evitare upgrade, runner specializzati, asset extra e nuove risorse.
- La fase funzionale con i provider reali non è attestabile tramite i
  soli test gratuiti correnti: non declassare un gate per dichiarare GO.
- I nove staging Render non vanno sospesi o eliminati senza inventario
  delle dipendenze esterne e consenso specifico; risparmio non provato.
- Non spostare la vecchia configurazione `functional-integration-v0`
  sul database Supabase-Staging, non rieseguire DDL/bootstrap storico.
- Tutti i report devono riportare: ID canonico CHECKLIST MASTER, HEAD,
  run CI, limite della prova, azione successiva e data; i sotto-task
  PR/GH/REL non aggiungono peso ai 240 task della roadmap.

### Gate per avanzare oltre i test sintetici

Prima di qualunque staged runtime/RC Android con dati o provider occorrono
una nuova autorizzazione specifica e prove effettive di: isolamento
ingress/egress, identità ACL/RLS del writer reale, integrità e freschezza
B2, quarantine/restore, matrice conservazione approvata. Nessun GO
automatico; issue #296 OPEN/NO-GO.

**Hardening successivo:** l'entrypoint di readiness della #369 si lega ora soltanto a `127.0.0.1`; test dedicato intercetta la chiamata reale a `listen()` e rifiuta un bind pubblico. Questa modifica resta solo su PR Draft e rende esplicita l'incompatibilità con un futuro deploy Render Free senza nuova autorizzazione.
