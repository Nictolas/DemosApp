# DEMOS — OPS-STG-001: controllo effettivo privilegi preflight (03/11/2026)

## Stato confermato

Il servizio condiviso Render **demos-staging** continua in modalità bootstrap fail-closed (`autoDeploy=no`, `cd api && node staging/unified_staging_bootstrap.js`). L'ambiente applicativo **NON è pronto ai test E2E**; nessun accesso al database viene attivato da questa modifica.

Il progetto Supabase **Demos-Staging**, ref `fkeayjzvtuvzesljhjbc`, contiene **38 tabelle `public`**. Audit di catalogo SQL non mutante: 38/38 con RLS attiva, nessuna con privilegi di accesso diretto ai ruoli `anon` e `authenticated`. Esiste `demos_staging_runtime`, che ha privilegi di scrittura su altre tabelle: **non può essere riutilizzato** per il preflight read-only. `demos_staging_preflight` era ancora assente al controllo.

## Correzioni apportate in PR #565

Il file `api/scripts/unifiedStagingPreflight.js`:

1. Continua ad accettare solo `STAGING_PREFLIGHT_DATABASE_URL`, target Supabase Staging, pooler session mode su 5432 o hostname diretto, TLS verificato, identità `civic_runtime_identity` corretta e un GO esplicito `APPROVED_READ_ONLY_PREFLIGHT`. La connessione è ancora **disabilitata per impostazione predefinita**.
2. Dopo `BEGIN READ ONLY` e la verifica dell'identità, ora chiede al server PostgreSQL il **ruolo effettivamente connesso**: deve essere esattamente `demos_staging_preflight`. Respinge SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE, ereditarietà dei ruoli, permessi CREATE sul database/schema e transazioni non read-only.
3. Scorre tutte le tabelle pubbliche tramite `pg_catalog` e respinge qualsiasi permesso diretto del ruolo per `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`.
4. Mantiene le verifiche di catalogo delle 22 tabelle richieste, sicurezza/RLS delle tabelle, 18 campi civici critici e `civic_push_delivery_guard.blocked=true`. Non concede mai il GO all'app in seguito al solo preflight.

Nel file `api/tests/unifiedStagingPreflight.test.js` sono aggiunte prove negative per privilegi amministrativi, CREATE, ereditarietà, assenza di ruolo, transazione non read-only e una singola tabella scrivibile.

## Riscontri

- **31/31** test Node locali PASS (bootstrap, preflight, schema SQL). Test su worktree temporanea nel disco D:, rimossa al termine.
- Audit Supabase `public`: **38/38** tabelle con RLS attiva e senza accesso diretto `anon`/`authenticated`.
- Render: configurazione dell'avvio bootstrap invariata.
- Nessun token/password scritto in PR, documenti o Sheet; nessun nuovo ruolo creato né credenziale disponibile.
- Il tentativo di provisioning credenziali in un intervento precedente era stato bloccato: **non aggirare il blocco**, non dichiarare il ruolo disponibile né spacciare verifiche MCP per un E2E dal runtime.

## Gate rimanenti

**Restano quattro blocchi obbligatori**:
1. Validazione finale degli staging legacy e provisioning autorizzato di un utente `demos_staging_preflight` davvero limitato, con segreti gestiti senza divulgarli; verificare la connessione dal contesto Render.
2. Finalizzazione dello schema **necessario** ai flussi E2E effettivi, con fixture sintetiche e senza copiare i dati di produzione.
3. Collegamento applicativo con privilegi minimi, isolamento Supabase produzione, prove multiutente su auth, opinioni, notifiche, ICE, referendum e privacy; push/email/cron restano spenti fino al GO.
4. Parità dei test specialistici, piano rollback, poi dismissione graduale dei nove vecchi servizi staging e verifica di PG/KV.

**Valutazione intervento:** 5/10. Il controllo di sicurezza è più forte, ma il collo di bottiglia del collegamento reale e i test E2E restano aperti.
