# DEMOS — Requisiti di sistema canonici

**Versione:** 2026-10-11  
**Dipendenze:** `docs/PRODUCT_FEATURE_CATALOG.md`, `docs/FUNCTIONAL_REQUIREMENTS.md`  
**Perimetro:** vincoli infrastrutturali, sicurezza trasversale, compatibilità, disponibilità, recovery e osservabilità. Le capacità numeriche di carico/scalabilità sono trattate separatamente in F12-05.

## Stati

- **SODDISFATTO** — requisito già supportato dal codice/configurazione e coperto da evidenza tecnica corrente.
- **PARZIALE** — requisito supportato solo in parte o con una dipendenza ancora non qualificata.
- **DA CHIUDERE** — vincolo necessario individuato, ma non ancora implementato/deciso completamente.
- **ESTERNO** — dipende da provider, credenziali, store o dispositivi reali non disponibili nel repository.

## 1. Architettura e infrastruttura

| ID | Stato | Requisito di sistema | Evidenza / vincolo corrente |
|---|---|---|---|
| RS-001 | SODDISFATTO | DEMOS DEVE mantenere una separazione tra frontend web/mobile, API backend e persistenza PostgreSQL, evitando che il client acceda direttamente al database applicativo. | React/Vite in `client/`; API Express in `api/`; `pg` centralizzato in `api/config/database.js`. |
| RS-002 | SODDISFATTO | Il backend DEVE richiedere una `DATABASE_URL` valida per inizializzare PostgreSQL e DEVE fallire l'inizializzazione del pool se la variabile manca. | `api/config/database.js` genera errore quando `DATABASE_URL` non è definita. |
| RS-003 | SODDISFATTO | Le connessioni PostgreSQL remote DEVONO usare TLS con policy provider-aware: verifica CA per Supabase/pubblico, TLS cifrato per rete privata Render; localhost PUÒ usare connessione non TLS. | `api/utils/databaseTlsPolicy.js`, test `databaseTlsPolicy`. |
| RS-004 | SODDISFATTO | Il pool PostgreSQL DEVE avere timeout finiti di connessione e query e una dimensione massima configurabile tramite ambiente. | Pool: `DATABASE_POOL_MAX`, `DATABASE_POOL_MIN`, connect 15s, query/statement 30s. |
| RS-005 | SODDISFATTO | Gli stati critici temporanei di autenticazione/identità in ambiente reale DEVONO essere esternalizzati in uno store condiviso e consumabili atomicamente. | Redis/Upstash usato da CIE OIDC, ticket registrazione, challenge WebAuthn e revoca access token. |
| RS-006 | SODDISFATTO | I fallback in-memory per challenge/revoche DEVONO essere limitati a sviluppo/test o a staging esplicitamente abilitato e NON DEVONO diventare fallback silenzioso in produzione. | WebAuthn: fallback solo development/test; revoca: fallback solo staging con `DEMOS_STAGING_IN_MEMORY_REVOCATION=true`. |
| RS-007 | SODDISFATTO | Il flusso CIE reale e lo scambio ticket post-CIE DEVONO fallire chiuso se Redis non è disponibile. | `cieOidcTransactionStore.js` e `registrationTicketStore.js` richiedono Redis. |
| RS-008 | SODDISFATTO | Le migrazioni automatiche di staging DEVONO essere vincolate all'ambiente staging e al database dedicato, rifiutando database con nome inatteso. | `api/scripts/stagingBoot.js`, `stagingMigrate.js`, target `demos_civic_staging_db`. |
| RS-009 | SODDISFATTO | Il frontend web DEVE essere producibile come bundle statico e il deployment SPA DEVE risolvere le route client verso `index.html`. | Vite `client/dist`; `vercel.json` rewrite `/(.*)` → `/index.html`. |
| RS-010 | SODDISFATTO | Le app mobile DEVONO riusare il bundle web tramite Capacitor e mantenere un identificatore applicativo stabile. | Capacitor 6, `appId: com.demos.app`, `webDir: dist`. |
| RS-011 | DA CHIUDERE | La versione major/minor di Node.js usata in build e runtime DEVE essere pin-nata in modo esplicito e condiviso tra sviluppo e deploy. | Non esistono attualmente `engines`, `.nvmrc` o `.node-version`; non si assume una versione implicita del provider. |
| RS-012 | PARZIALE | La configurazione di deployment frontend DEVE avere una sola fonte operativa autorevole per produzione, evitando divergenze fra configurazioni storiche/alternative. | `vercel.json` è presente; `render.yaml` contiene ancora anche una definizione frontend statico. F6-01 gestisce l'allineamento produzione. |

## 2. Sicurezza, autenticazione e autorizzazione

| ID | Stato | Requisito di sistema | Evidenza / vincolo corrente |
|---|---|---|---|
| RS-013 | SODDISFATTO | In produzione `JWT_SECRET` e `JWT_REFRESH_SECRET` DEVONO essere definiti, diversi e lunghi almeno 32 caratteri; l'avvio NON DEVE usare segreti prevedibili di fallback. | `api/utils/jwt.js`. |
| RS-014 | SODDISFATTO | I JWT DEVONO essere verificati con algoritmo, issuer, audience, tipo e scadenza attesi. | HS256, issuer/audience `demosapp`, access 24h, refresh 7gg in `api/utils/jwt.js`. |
| RS-015 | SODDISFATTO | Le azioni Admin DEVONO essere autorizzate lato backend tramite capability canonica Admin, non tramite semplice visibilità della UI o stringa ruolo legacy. | `requireAdmin`, test di authorization/capability. |
| RS-016 | SODDISFATTO | Le superfici API di test/debug/migration/cleanup DEVONO restare non montate in produzione salvo flag esplicito e consapevole. | `mountDevApiSurface = !production || ALLOW_DEV_API_SURFACE === 'true'`. |
| RS-017 | SODDISFATTO | CORS DEVE usare una allowlist esplicita per origini browser e NON DEVE usare `*` insieme a credenziali. | `api/app.js`: allowlist DEMOS + localhost; `credentials: true`. |
| RS-018 | SODDISFATTO | Le risposte API DEVONO applicare header di sicurezza almeno contro framing, MIME sniffing e downgrade HTTP persistente. | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS e altre policy in `api/middleware/security.js`. |
| RS-019 | SODDISFATTO | Le API DEVONO applicare rate limiting differenziato almeno per traffico generale, autenticazione, registrazione, Admin, utente e pubblico. | `api/middleware/rateLimiting.js`. |
| RS-020 | SODDISFATTO | Le richieste con body dichiarato oltre il limite applicativo DEVONO essere rifiutate prima dell'elaborazione ordinaria. | Security middleware: limite corrente 10 MiB. |
| RS-021 | SODDISFATTO | I token/challenge one-time DEVONO essere consumati atomicamente; se lo store non supporta primitive atomiche equivalenti il flusso DEVE fallire chiuso. | GETDEL o Lua/EVAL per CIE, ticket e WebAuthn; test dedicati. |
| RS-022 | SODDISFATTO | I refresh token persistiti DEVONO essere memorizzati come hash e ruotati con controllo transazionale della sessione. | `api/services/sessionService.js` usa SHA-256 e `FOR UPDATE`. |
| RS-023 | SODDISFATTO | I log operativi ordinari NON DEVONO includere identificatori diretti non necessari; gli identificatori DEVONO restare confinati ai canali audit/security quando richiesti. | `centralizedLogger`, `logPrivacy`, test privacy logging. |
| RS-024 | SODDISFATTO | Il release gate DEVE mantenere zero vulnerabilità runtime npm di severità alta/critica note al momento della qualifica, oppure bloccare/documentare esplicitamente l'eccezione. | Ultimo gate qualificato root/client: 0 vulnerabilità runtime. |
| RS-025 | PARZIALE | Le policy CSP del frontend di produzione DEVONO essere definite nella configurazione effettivamente usata dal provider di produzione. | CSP presente nel blocco frontend di `render.yaml`, ma `vercel.json` corrente non la replica; da riallineare con F6-01 prima del go-live. |

## 3. Compatibilità web e mobile

| ID | Stato | Requisito di sistema | Evidenza / vincolo corrente |
|---|---|---|---|
| RS-026 | SODDISFATTO | Il frontend DEVE compilare con la toolchain React 18 + TypeScript + Vite corrente senza errori di typecheck/build nel release gate. | React 18.3, TypeScript 5.x, Vite 8.x; gate locali PASS. |
| RS-027 | SODDISFATTO | La shell mobile Android DEVE usare schema HTTPS in produzione e il cleartext DEVE restare una configurazione esclusivamente di sviluppo. | `capacitor.config.ts`: `androidScheme: 'https'`; cleartext solo commentato come opzione dev. |
| RS-028 | PARZIALE | DEMOS DEVE produrre bundle Android e iOS dalla stessa base frontend senza fork funzionali per piattaforma. | Capacitor Android/iOS presenti come dipendenze; build/device qualification finale ancora pendente F6-19/F6-20. |
| RS-029 | DA CHIUDERE | Prima del go-live DEVE esistere una matrice minima di browser/versioni supportati e un criterio esplicito per browser non supportati. | Nessuna matrice browser canonica individuata nel repository. |
| RS-030 | ESTERNO | Prima della release mobile DEVONO essere completati i test su dispositivi Android reali rappresentativi e su iPhone reale. | F6-19 e F6-20 ancora pendenti. |
| RS-031 | ESTERNO | Le integrazioni che dipendono da provider esterni DEVONO essere qualificate con credenziali non-production o device reali prima di essere dichiarate E2E complete. | CIE ufficiale, Apple Sign In e FCM reale hanno residui esterni registrati in roadmap. |
| RS-032 | PARZIALE | L'interfaccia DEVE supportare zoom browser, focus visibile e semantica di base; prima del go-live DEVONO essere completati i test manuali di accessibilità su browser/device reali. | F6-13 audit tecnico completato; VoiceOver/TalkBack, contrasto e test manuali restano pendenti. |

## 4. Disponibilità, resilienza e comportamento ai guasti

| ID | Stato | Requisito di sistema | Evidenza / vincolo corrente |
|---|---|---|---|
| RS-033 | SODDISFATTO | Il backend DEVE esporre un health endpoint leggero per verificare che il processo API sia operativo. | `GET /health` in `api/routes/health.js`. |
| RS-034 | SODDISFATTO | Il backend DEVE avere timeout finiti verso PostgreSQL e DEVE rilasciare/riciclare connessioni difettose senza lasciare leak intenzionali. | Pool centralizzato, timeout 15/30s ed event handler in `database.js`. |
| RS-035 | SODDISFATTO | Una cache applicativa non critica PUÒ degradare a cache miss quando Redis non è configurato; il dato autorevole DEVE restare recuperabile dalla fonte primaria. | `redisCache.js` disabilita la cache e `remember()` richiama il fetcher. |
| RS-036 | SODDISFATTO | Una dipendenza critica di sicurezza/autenticazione NON DEVE degradare silenziosamente in produzione: revoca access token, CIE reale, ticket registrazione e challenge WebAuthn DEVONO fallire chiuso se lo store richiesto non è disponibile. | Servizi Redis critici con errori `*_STORE_UNAVAILABLE`/Redis required. |
| RS-037 | SODDISFATTO | Un guasto del sink Axiom per log operativi NON DEVE interrompere la richiesta applicativa ordinaria. | `centralizedLogger.writeToAxiom()` cattura l'errore e continua. |
| RS-038 | SODDISFATTO | Il processo backend DEVE gestire shutdown graceful dei servizi/job e del pool database quando riceve la terminazione prevista. | `gracefulShutdown` in `api/server.js`. |
| RS-039 | SODDISFATTO | I self-test esplicitamente abilitati in staging DEVONO far fallire l'istanza se rilevano uno status inatteso, invece di dichiarare lo staging sano. | `DEMOS_STAGING_AUTH_E2E`/`MUTATION_E2E` chiudono il server su errore. |
| RS-040 | DA CHIUDERE | Prima del go-live DEVONO essere definiti SLO numerici minimi per disponibilità API e tempi di ripristino; il documento NON deve inventare percentuali o SLA non approvati. | Nessun SLO/uptime target canonico individuato nel repository; da definire in F12-05/operatività. |

## 5. Backup, recovery, retention e osservabilità

| ID | Stato | Requisito di sistema | Evidenza / vincolo corrente |
|---|---|---|---|
| RS-041 | SODDISFATTO | Il vecchio backup JSON applicativo incompleto NON DEVE essere utilizzato come disaster recovery operativo. | `BackupService` restituisce `LEGACY_APP_BACKUP_RETIRED` e fallisce chiuso. |
| RS-042 | PARZIALE | Il disaster recovery del database DEVE basarsi su strumenti PostgreSQL/provider e DEVE essere verificabile tramite restore drill isolato. | Drill locale `pg_dump`/`pg_restore` PASS; drill PITR provider pre-live ancora raccomandato/pending. |
| RS-043 | PARZIALE | I log/audit destinati a retention lunga DEVONO poter essere archiviati fuori dal sink realtime con verifica d'integrità prima di avanzare il checkpoint. | Axiom→B2 implementato con hash/manifest/restore tests; prova live B2 con credenziali ristrette ancora pendente. |
| RS-044 | SODDISFATTO | L'archivio Axiom NON DEVE avanzare il checkpoint quando la verifica post-upload fallisce e DEVE essere idempotente sulla stessa finestra/chunk. | `axiomArchiveService` + test archive/restore. |
| RS-045 | PARZIALE | La retention dei dati DEVE essere governata da policy esplicite e i job automatici DEVONO poter essere fermati durante shutdown; i periodi legali definitivi restano soggetti alla revisione F5-17. | `dataRetentionService`, `dataRetentionJob`; F5-17 non ancora chiuso. |
| RS-046 | SODDISFATTO | L'osservabilità DEVE distinguere log tecnici, audit e security e DEVE offrire superfici di health/monitoring operative senza rendere i dettagli privilegiati pubblici. | Logger centralizzato, AuditService, security logs, route Admin monitoring protette dai gate correnti. |

## 6. Deployment, configurazione e release gate

| ID | Stato | Requisito di sistema | Evidenza / vincolo corrente |
|---|---|---|---|
| RS-047 | SODDISFATTO | Segreti e credenziali di produzione DEVONO essere forniti tramite ambiente/provider e NON hardcodati nei file di configurazione versionati. | `render.yaml` usa `sync: false`; servizi leggono secret da `process.env`. |
| RS-048 | SODDISFATTO | Il frontend DEVE ricevere solo variabili `VITE_*` destinate al client; segreti backend NON DEVONO essere incorporati nel bundle web. | Separazione env client/server nei file di configurazione e servizi. |
| RS-049 | SODDISFATTO | Le modifiche di schema DEVONO essere versionate o idempotenti e il runner staging DEVE verificarne l'esito prima dell'avvio qualificato. | SQL migration bundle + `verifyExpectedSchema`. |
| RS-050 | SODDISFATTO | Prima di un checkpoint qualificato le modifiche DEVONO superare i test pertinenti e `git diff --check`; per cambi frontend deve essere eseguito anche typecheck/build. | Prassi corrente e gate locali documentati in roadmap. |
| RS-051 | SODDISFATTO | Il progetto NON DEVE richiedere GitHub Actions per qualificare ogni modifica: test/build locali devono poter coprire il gate ordinario. | Gate correnti eseguiti localmente con 0 minuti GitHub Actions. |
| RS-052 | PARZIALE | La configurazione reale di produzione DEVE essere riallineata con i requisiti documentati prima del go-live, senza assumere che file storici descrivano lo stato effettivo del provider. | F6-01/F6-02/F6-03 restano attività di produzione esplicitamente non eseguite senza autorizzazione. |

## 7. Gap bloccanti o da chiudere prima della release candidate

1. **Pin Node.js (`RS-011`)** — scegliere e versionare il runtime dopo verifica della versione supportata dal deployment corrente.
2. **Fonte frontend di produzione/CSP (`RS-012`, `RS-025`)** — riallineare Vercel/configurazione effettiva senza toccare produzione finché non autorizzato.
3. **Matrice browser (`RS-029`)** — definire browser/versioni minime e criteri di supporto.
4. **Device reali (`RS-030`)** — completare Android/iPhone reali.
5. **Provider esterni (`RS-031`)** — CIE ufficiale, Apple e FCM reale dove richiesto.
6. **Accessibilità manuale (`RS-032`)** — VoiceOver/TalkBack, contrasto, zoom e focus.
7. **SLO disponibilità (`RS-040`)** — definire target numerici solo dopo una decisione esplicita; non inventarli.
8. **DR provider (`RS-042`)** — eseguire drill PITR/provider isolato prima del live quando disponibile.
9. **B2 live (`RS-043`)** — prova archivio/restore con credenziali ristrette.
10. **Retention definitiva (`RS-045`)** — chiudere F5-17.

## 8. Regola di manutenzione

- Un nuovo vincolo infrastrutturale, di compatibilità, sicurezza, disponibilità o recovery DEVE essere aggiunto qui nello stesso checkpoint che lo introduce.
- Se un requisito passa da `PARZIALE/DA CHIUDERE/ESTERNO` a `SODDISFATTO`, la nota DEVE citare l'evidenza tecnica reale (test, configurazione o drill), non una previsione.
- Le metriche di capacità e carico NON DEVONO essere inventate qui: appartengono a F12-05 e devono essere basate su misure.
- Il test `api/tests/systemRequirements.smoke.test.js` verifica presenza delle quattro aree richieste dalla roadmap, unicità degli ID e registrazione esplicita dei gap principali.
