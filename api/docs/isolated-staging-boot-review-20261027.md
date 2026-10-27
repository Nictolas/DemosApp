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
  **soltanto con dati inventati**. Attualmente `Demos-Staging` contiene
  zero tabelle `public` e quattro tabelle private `op37_sondaggi_ci`.
- Migrazioni mirate e ledger `privacy_erasure_ledger` con protezione RLS,
  ACL e ruoli dedicati; piano di DDL/GRANT separatamente autorizzato.
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
