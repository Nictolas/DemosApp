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