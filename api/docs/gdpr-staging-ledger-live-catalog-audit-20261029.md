# DEMOS — GH-296: evidenze reali di catalogo del ledger Demos-Staging

**Data:** 29 ottobre 2026. **Fonte:** Supabase Management SQL, progetto Demos-Staging `fkeayjzvtuvzesljhjbc`. Soltanto interrogazioni `SELECT` su `pg_catalog`, `information_schema` e `pg_stat_activity`, con riepiloghi aggregati; **nessuna riga degli utenti, dato sanitario, payload GDPR, token, URI o credenziale è stata letta**. Nessuna `INSERT`, `UPDATE`, `DELETE`, `GRANT`, `REVOKE`, `ALTER`, deploy, restore o modifica dei provider.

## Ledger e privilegi effettivamente osservati

| Controllo | Esito management SQL staging | Interpretazione |
|---|---|---|
| Database esaminato | `postgres` | Non equivale a database/ruolo usato dal backend Render |
| `public.privacy_erasure_ledger` | Presente | Una tabella, nessun suo record letto |
| `relrowsecurity` / `relforcerowsecurity` | `true` / `true` | RLS abilitata e forzata anche per l'owner senza BYPASSRLS |
| Policy | 3 | `INSERT` e `SELECT` per runtime, `SELECT` per B2 worker, con predicati; nessuna policy per `PUBLIC` |
| Grant `PUBLIC` su tabella / colonne | 0 / 0 | Nessun grant pubblico diretto trovato |
| Grant DML per `anon`, `authenticated`, `service_role` | 0 / 3 ruoli esaminati | Nessuna esposizione diretta del ledger a questi ruoli; non prova tutte le possibili RPC |
| `demos_staging_runtime` | LOGIN, NOBYPASSRLS, non superuser; SELECT + INSERT, no UPDATE/DELETE | Ruolo operativo minimo previsto per la scrittura nel ledger |
| `demos_staging_b2_worker` | LOGIN, NOBYPASSRLS, non superuser; SELECT, no INSERT/UPDATE/DELETE | Ruolo operativo con permessi lettura sul ledger |
| Membership in ruoli BYPASSRLS/superuser/CREATEROLE | 0 per ciascuno dei due ruoli applicativi | Nessun accesso privilegiato ereditato rilevato |
| Funzioni `SECURITY DEFINER` in `public`/`graphql_public` | 0 | Solo questi schemi sono stati verificati; non è una garanzia per ogni percorso RPC |
| Ruoli LOGIN con BYPASSRLS | 4 | Include ruoli provider/amministrativi; **non** sono stati bloccati |
| Ruoli LOGIN superuser | 1 | Superuser Supabase di amministrazione, non un writer app autorizzato |
| Sessioni client visibili a istante di osservazione | 5, di cui 1 con username postgres e 0 visibili per i due ruoli applicativi | Snapshot soggetto a variazioni, pooler/visibilità limitata; non prova assenza di connessioni |

**Dettaglio ruoli privilegiati:** `postgres` (owner del ledger, BYPASSRLS, accesso DML), `supabase_admin` (superuser/BYPASSRLS, accesso DML), `supabase_etl_admin` e `supabase_read_only_user` (BYPASSRLS, soltanto SELECT sul ledger nei controlli catalogo). Il ruolo API `service_role` possiede l'attributo BYPASSRLS, ma **non** aveva grant diretti DML al ledger e non è LOGIN. Le capacità effettive di un ruolo amministrativo non si esauriscono nelle ACL catalogate.

**Importante:** `current_user=postgres` visto nelle chiamate Management SQL identifica **solo la sessione Supabase Management**. Non attribuire questa identità al backend Render. Le ACL e RLS del ledger sono un controllo di difesa in profondità, non il cut-off per l'operazione di ripristino. Le connessioni admin/owner preesistenti, Supavisor e gli endpoint HTTPS potrebbero comunque scrivere altrove nel database.

## Linter Supabase security di staging

`get_advisors(type=security)` ha restituito **10 avvisi di livello INFO** con regola `rls_enabled_no_policy` su tabelle di altri schemi di QA e due tabelle in `public` (`identity_verifications`, `user_auth_providers`). Il ledger GDPR **non compare in questi avvisi**. RLS attiva senza policy può essere una negazione intenzionale; non assumere vulnerabilità o creare policy permissive solo per eliminare l'avviso. <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>

## Risultato tecnico sulla CLI Draft

La precedente CLI isolata accettava qualsiasi ruolo SQL realmente osservato, compreso un potenziale `postgres` con BYPASSRLS, come `READONLY_ISOLATED_CLI_ROLE_ONLY_NOT_RUNTIME`. La PR Draft #374 è stata rafforzata con `catalogMatchesStagingRuntime()`, che esige **entrambi** `current_role` e `session_role` uguali a `demos_staging_runtime`, database `postgres`, assenza di BYPASSRLS e ownership, ledger presente con RLS+FORCE, SELECT+INSERT, zero grant pubblici e zero grant API. La CLI **non** approva privilegi maggiori, grant mancanti, ruoli di worker o URL di altri progetti. Il report conserva sempre `live_render_pool_verified:false`, `live_production_pool_verified:false`, `sql_writer_attested:false`, `recoveryReady:false`. Solo una corrispondenza catalogo produce `READONLY_EXPECTED_STAGING_ROLE_NOT_RUNTIME`: **non è un GO**.

## Limiti irrisolti / gate

1. Mancano identità e privilegi della connessione **in-process del Render backend reale**. Una SELECT con una connessione di gestione/CLI non è equivalente.
2. Non si sono letti o cambiati env/secret Render né testate le credenziali reali dei ruoli runtime/worker.
3. Non è stato effettuato un cut-off indipendente che neutralizzi tutte le connessioni già aperte e successive via PostgreSQL diretto, Supavisor, PostgREST, GraphQL/RPC, Auth, Storage e Realtime; i ruoli amministrativi continuano a esistere.
4. Manca la prova esterna di durabilità/replay Backblaze B2 e la review RP-10/F5-17/DPO/DPIA.

**Conclusione:** misure catalogo staging favorevoli al principio del minimo privilegio, ma nessuna prova di isolamento reale di recovery. **GH-296 OPEN / NO-GO / recoveryReady:false.**
