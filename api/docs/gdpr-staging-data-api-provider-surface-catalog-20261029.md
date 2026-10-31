# DEMOS — GH-296 · Fase T · Estensione catalogo superfici Supabase Staging

**29 ottobre 2026. SOLO audit di metadati PostgreSQL del progetto Demos-Staging `fkeayjzvtuvzesljhjbc` e lettura dell'elenco Edge Functions. Nessuna lettura di contenuti degli utenti, chiavi API, sessioni o segreti; nessuna richiesta alla Data API, endpoint Storage/Realtime/Auth; nessun deploy/migrazione/GRANT o altro cambiamento provider.**

**Stato: GH-296 OPEN / NO-GO / `recoveryReady:false`.**

## Tabella di copertura SQL osservata (non accessibilità HTTP)

Con un `SELECT` su `pg_catalog.pg_class`, `pg_catalog.pg_namespace`, `has_table_privilege` e `has_schema_privilege`, l'audit in staging ha trovato il seguente numero di relazioni sulle quali un ruolo possiede **almeno uno dei grant INSERT/UPDATE/DELETE**. I numeri NON indicano che un'operazione sia consentita da RLS, dalle policy dei provider o dall'autenticazione API.

| Schema | Relazioni | Tabelle | Senza RLS | Grant DML `anon` | Grant DML `authenticated` | Grant DML `service_role` |
|---|---:|---:|---:|---:|---:|---:|
| `public` | 9 | 9 | 0 | 0 | 0 | 2 |
| `storage` | 8 | 8 | 0 | 3 | 3 | 5 |
| `realtime` | 3 | 3 | 2 | 1 | 1 | 1 |
| `vault` | 2 | 1 | 1 | 0 | 0 | 2 |
| `auth` | 27 | 27 | 11 | 0 | 0 | 0 |
| `demos_private`, `f12_poe_ci`, `op37_sondaggi_ci`, `qa_profile_contract_20261029`, `qa_user_profile_20261028` | 23 | 23 | 10 | 0 | 0 | 0 |

Le relazioni PostgreSQL interne dei provider **non** sono equivalenti alle API di accesso. Il significato di `auth`/RLS e i privilegi dei ruoli di servizio interni richiede documentazione e configurazione provider; in particolare `realtime`, `storage` e `vault` non devono essere chiamati "esposti" sulla base del solo catalogo.

### Individuazione più precisa delle possibili scritture

- `public.identity_verifications` e `public.user_auth_providers`: `service_role` ha SELECT/INSERT/UPDATE/DELETE. RLS+FORCE attive, 0 policy; `service_role` è BYPASSRLS. Il catalogo non certifica se la Data API le esponga e se esistano client con chiavi valide.
- `storage.objects`, `storage.buckets` e `storage.buckets_analytics`: grant INSERT/UPDATE/DELETE a `anon`, `authenticated`, `service_role`, con RLS attiva e non forzata, 0 policy catalogate. **Il grant è necessario ma non sufficiente** per scrivere tramite provider; il risultato non prova un permesso effettivo a utenti anonimi.
- `storage.s3_multipart_uploads` e `storage.s3_multipart_uploads_parts`: grant DML al solo `service_role` tra questi tre ruoli.
- `realtime.messages`: grant INSERT/UPDATE ad `anon`, `authenticated`, `service_role`, RLS attiva ma non forzata, 0 policy catalogate.
- `vault.decrypted_secrets` è una **vista** e `vault.secrets` una tabella; il controllo ACL riporta un privilegio DELETE per `service_role` su entrambe. La vista non ha il tipo di protezione RLS di una tabella. Non sono stati letti dati di Vault né verificati privilegi per un'operazione reale o raggiungibilità da HTTP. **Non usare questo risultato per inferire che i segreti siano recuperabili o cancellabili tramite API.**
- `auth`: nessun DML concesso direttamente a `anon`, `authenticated`, `service_role` nelle 27 tabelle catalogate; i componenti Auth gestiti dal provider possono avere ruoli diversi, fuori da questa ricognizione.

Gli schemi non riportati singolarmente hanno zero grant DML ai tre ruoli in questa fotografia. Il conteggio è puntuale e non può fungere da attestazione di provider/connessioni/sessioni precedenti.

### Edge Functions e configurazione Data API

La chiamata **read-only** `list_edge_functions` ha restituito un elenco vuoto per il progetto Demos-Staging. Questo non attesta la disattivazione di altri servizi HTTP, dei web hook o del backend Render.

Le azioni di sola lettura del connettore Supabase attualmente disponibili non espongono lo stato `Data API enabled` né la lista effettiva degli schemi PostgREST pubblicati. `get_project` espone metadati generici, non questa impostazione. **Non sono state interrogate, ottenute o stampate chiavi anon, publishable o service role** e non sono state effettuate prove HTTP.

Per arrivare a una prova valida servono, su dashboard/provider in contesto autorizzato, **solo i metadati di configurazione** della Data API e degli schemi esposti, poi un piano separato di negative test per chiavi vecchie e ingressi SQL/HTTPS durante la quarantena. Nessun change/deploy automatico.

## Correzione Draft verificabile: FORCE RLS del ledger

L'audit ha permesso di trovare una discrepanza tra ambiente staging (ledger `relforcerowsecurity=true`) e bootstrap del codice Draft: `PrivacyErasureLedgerService.ensureTable` abilitava solo RLS, diversamente dall'outbox che già applicava anche FORCE. Ora l'helper include `ALTER TABLE public.privacy_erasure_ledger FORCE ROW LEVEL SECURITY` **nello stesso SQL batch atomico** con CREATE, ENABLE RLS e revoche `PUBLIC/anon/authenticated/service_role`. L'operazione è **solo in codice Draft**: non ha eseguito DDL in Supabase.

Inoltre `assertProtectedLedger` consulta `pg_catalog.pg_class.relforcerowsecurity` e rifiuta `force_rls !== true` prima di qualunque nuova scrittura GDPR, simmetricamente all'outbox. Il test PG17 sintetico `privacyLedgerSecureBootstrap.pg17.test.js` richiede FORCE già al primo commit, disabilita FORCE in fixture per controllare il rifiuto fail-closed e verifica che la manutenzione autorizzata della fixture ripristini FORCE.

**Limitazione:** anche FORCE RLS non ferma superuser/ruoli BYPASSRLS. Rimangono obbligatori il cutoff esterno per Postgres/Supavisor/HTTPS, la prova dei writer Render live, la revoca/isolamento vecchie connessioni, B2 replay e approvazioni DPO/DPIA/RP-10/F5-17.

## Gate finale

**Nessun GO**: l'audit descrive ACL di catalogo, non autenticazione HTTPS, connessioni provider, runtime Render o durabilità del backup. Non si sono alterati permessi reali né dati personali. **GH-296 resta OPEN / NO-GO / `recoveryReady:false`.**
