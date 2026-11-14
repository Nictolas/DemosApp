# DEMOS — OPS-STG-001 P4: preference cooldown schema (3 novembre 2026)

## Migrazione applicata soltanto a Supabase Demos-Staging

Il file versionato `api/database/staging/ops_stg_001_p4_preference_cooldowns_20261103.sql` è stato applicato **solo** al progetto Supabase **Demos-Staging** `fkeayjzvtuvzesljhjbc`, tramite la migrazione `ops_stg_001_p4_preference_cooldowns_20261103`.

Motivazione: `api/services/preferenceCooldownService.js`, utilizzato anche dai referendum reali, richiede `preference_change_cooldowns`. Il servizio condiviso non aveva questa tabella. Schema ripreso dal file canonico in repo `20261009_preference_cooldowns.sql` con le sole aggiunte di sicurezza per staging.

- **Tre colonne:** `user_id TEXT NOT NULL`, `scope TEXT NOT NULL`, `last_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- **Chiave primaria composta** `(user_id, scope)` e indice su `last_changed_at`.
- **Zero righe**, nessuna copia di voti, account o preferenze reali. Non viene creata una cronologia di votazioni.
- Migrazione atomica; verifica identità univoca `md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8'`, guardia invio push `blocked=true` e assenza di tabella/indice preesistenti prima della creazione.
- RLS **ON** e revoca di qualsiasi privilegio `anon`, `authenticated` e `PUBLIC`. Nessun privilegio applicativo `demos_staging_runtime` aggiunto in questo intervento: le autorizzazioni per fixture sintetiche rimangono un gate esplicito separato.

## Verifiche

La suite **Unified Staging Offline Safety**, commit `478fb5b685a85bbfd72d255b0e287861b6e01b51`, run `41623089857`, è **SUCCESS** nei tre job: `bootstrap-offline-contract`, `p1-p3-schema-postgres16` (ora comprende anche P4) e `p0-schema-postgres16`. Test Node **49/49 + 28/28 = 77/77 PASS**; test Python PG16 **2/2 PASS**, incluse prove negative di identità e rifiuto della riesecuzione. Su questo commit risultano **SUCCESS** anche Legacy Menu, CIE, Civic notifications e Security Agent, con Snyk `success`; la build frontend risultava ancora in corso al momento del controllo.

Lettura indipendente dello schema sul progetto Supabase *dopo* la migrazione: **3/3 colonne** corrette, **2/2 indici**, tabella **RLS attiva**, nessun accesso diretto di lettura/scrittura per `anon`, `authenticated` o `demos_staging_runtime`, conteggio **0 righe**, `civic_push_delivery_guard.blocked=true`. Schema staging ora a **50 tabelle pubbliche** (prima 49).

## Stato e gate

`demos-staging` Render mantiene avvio `cd api && node staging/unified_staging_bootstrap.js`, `autoDeploy=no`. **Nessun deploy applicativo, nessun E2E, nessuna modifica alla produzione**. La correzione della regex in `api/tests/referendumRealVote.smoke.test.js` elimina la precedente regressione dei test, ma non sostituisce il collaudo multiutente.

Quattro gate principali ancora aperti:

1. Inventario dipendenze e credenziali dei nove vecchi staging; disponibilità e connessione reale del ruolo read-only `demos_staging_preflight`, senza riutilizzare credenziali di scrittura.
2. Autorizzazioni limitate di runtime per le fixture di referendum e cooldown, più eventuali altre fixture sintetiche e verifica applicativa dell'identità del votante. La bozza ACL P3 resta **non applicata**.
3. Collegamento isolato Render → Supabase Demos-Staging, TLS/session-mode, prove E2E di auth, opinioni, referendum, segnalazioni, notifiche e privacy con push/email/cron disabilitati.
4. Test specialistici, piano rollback e solo dopo eventuale dismissione dei nove staging ridondanti e controllo del vecchio PostgreSQL/Key Value.

**Importanza dell'intervento: 8/10** — la CI rossa è tornata verde e una dipendenza backend è stata effettivamente aggiunta al database di staging senza dati personali né aperture di accesso. Non sono stati chiusi i quattro gate principali.
