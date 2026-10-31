# DEMOS / GH-296 — Supabase Staging: ingressi `service_role` e future tabelle `public`

**29 ottobre 2026 · Fase S · Read-only sui cataloghi Supabase Staging** `fkeayjzvtuvzesljhjbc`, database `postgres`.

**Decisione: NO-GO / `recoveryReady:false`**. Nessun deploy, DDL, GRANT/REVOKE, modifica del provider, lettura di righe degli utenti o segreti. Non è stata eseguita alcuna chiamata REST, GraphQL, Auth o Storage con un token/una chiave `service_role`.

## Risultati osservati via Management SQL (non connessioni Render)

Query esclusivamente `SELECT` di `pg_class`, `pg_namespace`, `pg_roles`, `pg_default_acl`, `aclexplode`, `pg_policies` e `has_table_privilege`:

- Schema `public`: **9 tabelle, zero viste**, tutte con `relrowsecurity=true` e `relforcerowsecurity=true`. Nessun grant DML a `anon` o `authenticated` su alcuna delle 9 tabelle.
- **Solo 2 su 9 tabelle** hanno DML per `service_role`: `identity_verifications` e `user_auth_providers`, entrambe con `SELECT/INSERT/UPDATE/DELETE`, `RLS=true`, `FORCE RLS=true` e **zero policy**. Il ruolo `service_role` ha `BYPASSRLS`: la RLS non è quindi un blocco per richieste che operano realmente con quel ruolo e che superano gli altri controlli del provider. Le altre 7 tabelle, incluso il ledger e l'outbox, non presentano grant DML a `service_role` al momento osservato.
- Le tabelle indicate sono effettivamente usate dal codice applicativo per l'identità e OAuth: `api/services/identityVerificationStore.js` e `api/services/oauthRegistrationService.js`. Il servizio `api/services/privacyErasureLedgerService.js` le include nella pulizia dell'account, ma ciò **non impedisce** nuove scritture indipendenti dopo un ripristino.
- **`pg_default_acl` del solo schema `public`**: per nuovi oggetti `TABLE` creati dai ruoli owner `postgres` e `supabase_admin`, le ACL predefinite concedono a `anon`, `authenticated` e `service_role` **SELECT/INSERT/UPDATE/DELETE** (oltre ad altri privilegi come `TRUNCATE`, `REFERENCES` e `TRIGGER`). Le stesse ACL predefinite concedono `EXECUTE` sulle nuove funzioni e accesso a sequenze. Ciò NON significa che le attuali nove tabelle siano accessibili: le loro ACL effettive sono più restrittive. Significa che **un'eventuale nuova tabella creata senza RLS e revoca atomica può introdurre un nuovo ingresso**. Gli owner che creano gli oggetti contano: le regole non sono un'affermazione universale per ogni ruolo di migrazione.
- La ricognizione `SECURITY DEFINER` per schemi non-system ha rilevato **2 funzioni nello schema `vault`** eseguibili da `service_role` e una nello schema `pgbouncer` non eseguibile da quel ruolo. Questo non prova raggiungibilità HTTPS o accessibilità dal progetto; il perimetro completo degli endpoint esposti deve ancora essere attestato.

**Distinzione fondamentale:** un grant SQL e la presenza di una chiave `service_role` non dimostrano da soli che la **Data API sia attiva e la relativa tabella esposta via HTTP**. Per questo non affermiamo che sia stata verificata una scrittura REST. Prima del GO servono letture di configurazione provider e prove negative autorizzate, incluso il trattamento delle vecchie chiavi o JWT. I soli cataloghi SQL non possono sostituirle.

Documentazione Supabase di riferimento:
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/getting-started/api-keys

## Regression CI senza collegamenti al provider

`api/tests/gdprDefaultPrivilegeExposurePg17Synthetic.test.js` usa esclusivamente il PostgreSQL 17 disposable di GitHub Actions: il fixture crea **ruoli, schema e dati di fantasia**, imposta ACL predefinite larghe come controesempio, dimostra una scrittura simulata autorizzata nella tabella appena creata senza RLS e verifica che una seconda tabella, creata con RLS+FORCE e revoche **prima del COMMIT**, non conceda DML/SELECT ai ruoli API fittizi. Il fixture non applica e non propone automaticamente alcuna migrazione a Supabase reale. È un test di una **proprietà PostgreSQL**, non una prova HTTPS.

La workflow `.github/workflows/gdpr-b2-worker-retry-isolated-ci.yml` esegue il test su PG17 localhost e fallisce in caso di regressione.

## Gate operativo non soddisfatto

1. Verificare attraverso un canale provider autorizzato e in sola lettura **quali schemi sono esposti** nella Data API di Demos-Staging, se la Data API è attiva e a quali client/servizi sono assegnate chiavi elevate; non leggere né stampare il valore dei secret.
2. Inventariare e isolare **tutti i writer** che possono riutilizzare `service_role`, credenziali PostgreSQL `postgres` o altre identità `BYPASSRLS` durante un restore. Gestire **anche** connessioni SQL precedenti, Supavisor e ingressi HTTPS di Auth/Storage/Realtime.
3. Per ogni nuova migrazione su tabelle di dati personali, revisionare *prima* di qualunque deploy la transazione DDL, RLS, FORCE RLS, revoca di privilegi e regressioni; valutare in una decisione architetturale separata la modifica delle ACL predefinite di `public`, con compatibilità e rollback. **Nessuna revoca dei default grant è stata autorizzata o applicata**.
4. Ottenere prova durevole e indipendente di checkpoint/versioning/replay Backblaze B2, più RP-10/F5-17/DPO/DPIA. Non trasformare un catalogo favorevole in un `recoveryReady:true`.

**Evidenza attuale:** catalogo reale di staging + test sintetico. **Nessun provider cut-off dimostrato. GH-296 OPEN / NO-GO.**
