# DEMOS OPS-STG-001 — Canary isolato delle quattro sorgenti civiche

**Stato 05/11/2026: codice preparato su ramo QA; NON distribuito su Render.**

## Evidenza di autorizzazione già presente

Interrogazione `pg_policies`/`has_table_privilege` direttamente su Supabase
`Demos-Staging`, ref `fkeayjzvtuvzesljhjbc`:

| Sorgente | SELECT runtime | Policy RLS runtime | Permessi di scrittura esistenti |
| --- | --- | --- | --- |
| `public.eci` | sì | `civic_stage_runtime_eci` | sì, del runtime generale |
| `public.iniziative_ministero` | sì | `civic_stage_runtime_ministero` | sì, del runtime generale |
| `public.iniziative_popolari` | sì | `p0_staging_initiatives_read` | no |
| `public.referendum_abrogativi` | sì | `p0_staging_referenda_read` | no |

I 21 oggetti senza accesso runtime elencati nel runbook
`OPS_STG_001_APP_CANARY_20261105.md` **non servono a questo specifico
controllo**. Nessuna concessione aggiuntiva, policy o migrazione proposta.
Non confondere questo risultato con la piena disponibilità del backend.

## Isolamento del processo

- Nuovo entrypoint autonomo:
  `cd api && node staging/unified_staging_civic_readonly_canary.js`.
  NON importa `api/app.js`, `api/server.js`, route utente, job, Firebase
  o scheduler. Per prevenire cutover sbagliati, il server tradizionale e
  l'import diretto del full app **rifiutano NODE_ENV=staging**.
- Riutilizza le verifiche già testate di target: ruolo
  `demos_staging_runtime`, nome progetto Supabase, pooler sessione :5432,
  identità del DB, `delivery_guard.blocked=true` e doppia autorizzazione
  staging. Password-only trasformata in URI esclusivamente in memoria.
- Pool massimo due connessioni, minimo zero, TLS con CA verificata,
  `default_transaction_read_only=on`. Ogni query è comunque racchiusa in
  `BEGIN READ ONLY` e `ROLLBACK`: nessuna scrittura di database anche
  se il ruolo dispone già di permessi di scrittura su ECI/Ministero.
- Sonda schema con quattro query `SELECT ... LIMIT 0`: controlla il
  collegamento e i nomi delle colonne/privilegi, **non legge né espone
  record, firme, utenti o altre informazioni**. Per errori restituisce
  soltanto codice generico e `HTTP 503`.
- HTTP esterno solo `GET/HEAD /health`, `/health/live`,
  `/health/civic-sources` e `/health/ready`. Tutte le altre richieste,
  incluse API normali, autenticazione, push, amministrazione, metodi
  di scrittura e varianti dei percorsi, ricevono `404`.
  `/health/ready` restituisce sempre `503`;
  `app_ready=false` e `notifications_enabled=false`.
  Sonde simultanee aggregate, risposta positiva tenuta 15s in RAM
  per evitare carico eccessivo del DB gratuito.
- Il codice di startup non pubblica stringhe di connessione né dettagli di
  errori del provider; fallimento di identità o schema = mancato avvio.

## Validazione e condizioni del GO successivo

Nuovi test offline mirati più quelli della precedente PR #596:
**19/19 PASS su Windows in worktree temporaneo e rimosso**.
CI PostgreSQL 16/17 e controllo workflow GitHub da verificare nella PR.

**Nessun deploy, cambio di ENV, creazione ruolo, scrittura Supabase,
accensione FCM/cron, modifica produzione/main o pubblicazione Play.**
Il Render condiviso resta `preflight_only` con autoDeploy disattivato.

Il primo GO possibile riguarda **soltanto** la diagnostica di schema delle
fonti, non il backend completo: serve review PR/CI, controllo di tutte le
dipendenze del servizio condiviso, approvazione esplicita dello switch
Render e piano di rollback verso il comando bootstrap precedente.
Anche dopo eventuale sonda verde, la sincronizzazione reale delle fonti
(issue #589), login/consensi, prova notifiche e deep-link Android restano
NO-GO (E2E 0/6).
