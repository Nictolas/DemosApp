# DEMOS — Verifica dei ruoli SQL prima della migrazione GDPR

**27 ottobre 2026 · Draft, solo preparazione e test sintetici. Non autorizza alcuna modifica in produzione.**

## Fatti verificati senza lettura di eventi

Lettura esclusivamente del catalogo Supabase `Demos` in produzione:

| Verifica | Risultato |
| --- | --- |
| Tabella `public.privacy_erasure_ledger` | Presente |
| Proprietario | ruolo SQL `postgres` |
| `relrowsecurity` | `true` |
| `relforcerowsecurity` | `false` |
| Policy RLS | **0** |
| `anon`: SELECT / INSERT | false / false |
| `authenticated`: SELECT / INSERT | false / false |
| `service_role`: SELECT / INSERT | false / false |
| `postgres`: SELECT / INSERT | true / true |
| `public.privacy_erasure_delivery_outbox` | Assente: la feature outbox non è in `main` |

La configurazione `api/config/database.js` usa la variabile `DATABASE_URL` per creare il pool, ma **non dimostra quale identità SQL venga usata effettivamente dal servizio Render**. Non sono state lette variabili d'ambiente segrete né attivati client di produzione.

### Implicazione RLS da verificare

In PostgreSQL 17 un proprietario normalmente bypassa RLS quando `FORCE ROW LEVEL SECURITY` è disattivato; i ruoli non proprietari restano soggetti a policy. Con RLS abilitato e **zero policy**, un ruolo non proprietario (senza BYPASSRLS) non può leggere o inserire righe, **anche se riceve GRANT SELECT/INSERT**. Non proporre `BYPASSRLS`, disabilitazione RLS o permessi pubblici per aggirare questo controllo. Il modello DB del backend va revisionato insieme a ruolo di servizio, proprietario e modalità di connessione. `service_role` Supabase REST **non è** automaticamente il ruolo della connessione `DATABASE_URL`.

## Preflight operativo obbligatorio — query sola lettura, non eseguita da questa PR

Da eseguire *soltanto da operatore autorizzato* tramite il **medesimo pool/connessione realmente usato da `demos-backend`**, in una finestra approvata, senza stampare `DATABASE_URL`, token, password o valori di altre sessioni. La seguente query non legge alcuna riga del ledger:

```sql
SELECT
  current_user AS runtime_sql_role,
  session_user AS login_sql_role,
  current_database() AS database_name,
  c.relrowsecurity AS ledger_rls_enabled,
  c.relforcerowsecurity AS ledger_rls_forced,
  pg_get_userbyid(c.relowner) AS ledger_owner_role,
  has_table_privilege(current_user, c.oid, 'SELECT') AS ledger_select_grant,
  has_table_privilege(current_user, c.oid, 'INSERT') AS ledger_insert_grant,
  r.rolbypassrls AS runtime_has_bypass_rls
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_roles AS r ON r.rolname = current_user
WHERE n.nspname = 'public'
  AND c.relname = 'privacy_erasure_ledger'
  AND c.relkind IN ('r', 'p');
```

**Criteri manuali, mai approvazione automatica:**
- Il risultato deve avere esattamente **una riga** e riferirsi al database di produzione previsto, senza inviare ID/password o URL in issue pubbliche.
- RLS deve restare attivo. L'assenza di policy significa default-deny ai ruoli soggetti a RLS. Verificare la combinazione completa di proprietario, bypass e permessi reali. Un `INSERT` grant isolato **non dimostra** che la scrittura funzionerà.
- L'operatore deve attestare l'identità SQL usata dall'istanza Render *dal suo effettivo pool*, non da una sessione amministrativa Supabase separata; inoltre inventariare gli altri servizi di staging e i worker, con destinazioni verificate senza divulgare segreti.
- Se si vuole un writer non proprietario e privo di `BYPASSRLS`, progettare policy limitate e approvate, con regressioni di inserimento/lettura e senza esporre eventi GDPR tramite Data API. Non applicare modifiche ai permessi senza revisione titolare/DPO.
- Eseguire prima su un ambiente isolato lo schema del ledger e dell'outbox, backfill, deduplicazione/consistenza, ricevute B2, e prove di rollback. Non aggiornare `GDPR_ERASURE_OUTBOX_ENABLED` o `GDPR_ERASURE_OUTBOX_WORKER_ENABLED` fino a disponibilità esterna attestata e coordinamento completo.

## Regressione PostgreSQL 17

`api/scripts/verify-gdpr-transactional-outbox-pg17-ci.js` crea un ruolo sintetico `gdpr_nonowner_ci` con `SELECT`/`INSERT` sul ledger e `USAGE` sullo schema, ma **senza** `BYPASSRLS`. Con RLS attivo e policy assenti, conferma: `SELECT` restituisce zero righe, `INSERT` viene respinto (`42501`), rollback, preservazione dell'evento storico e scrittura lecita del proprietario `postgres` del DB sintetico. Nessun contatto con Supabase/Render/B2.

**Residui della issue #296:** connessione Render reale non attestata, Data API e pooler non isolati, staging non completamente mappato, ledger esterno non certificato completo/fresco, approvazioni non ottenute. **NO-GO**, tutti i cambiamenti rimangono Draft e non distribuiti.

## Diagnostico runtime esclusivamente in sola lettura — PR Draft (27 ottobre 2026)

È disponibile `api/scripts/gdpr-ledger-runtime-role-preflight.js`, un comando **non montato su HTTP, scheduler o avvio di Express**. È inattivo senza la scelta esplicita `DEMOS_GDPR_ROLE_PREFLIGHT_READONLY=acknowledged`. Solo un operatore autorizzato, **dalla shell del servizio `demos-backend` nello stesso ambiente che contiene il suo `DATABASE_URL`**, può eseguirlo. Il codice apre il pool di `api/config/database.js` e invia una sola `SELECT` ai cataloghi di PostgreSQL; non carica eventi GDPR, non emette `GRANT` o `INSERT` di prova, non pubblica un endpoint.

Esito: `NO_GO_LEDGER_MISSING`, `NO_GO_RLS_DISABLED`, `NO_GO_INSUFFICIENT_SQL_GRANTS`, `NO_GO_RLS_DEFAULT_DENY`, oppure `MANUAL_INDEPENDENT_REVIEW_REQUIRED`. Anche se il ruolo SQL proprietario risulta dotato di permessi, il risultato **non certifica** il database di destinazione, la possibilità di completare una transazione applicativa, la quarantena o la completezza del ledger esterno. Stampa soltanto booleani e conteggio policy; **non stampa username SQL, host, DATABASE_URL, password o contenuti GDPR**. Gli errori CLI sono redatti. Il test sintetico riproduce la lettura del catalogo con un proprietario e un non proprietario sotto RLS.

**Attenzione:** non è stato eseguito in Render o Supabase reali. La connessione disponibile tramite API Render non permette di eseguire comandi shell sul backend; la verifica del ruolo reale resta `UNKNOWN` fino all'esecuzione esplicita attraverso la sua connessione e revisione da parte dell'operatore. Eseguire da un ambiente diverso sarebbe una prova di quel diverso ambiente, non della produzione. Non inserire il risultato in un log pubblico contenente eventuale metadata identificativo senza la procedura approvata.

## Correzione del logging e limite dell'identità runtime (27 ottobre 2026 — PR Draft)

La revisione del diagnostico #359 ha trovato che `api/config/database.js:getPool()` crea listener del pool che scrivono eventi ed **errori SQL grezzi** nei log. Un comando che promette l'assenza di dettagli di connessione in output non può usare quel singleton senza controllo sugli effetti collaterali. Il nuovo diagnostico usa quindi `poolConfig` (connection string normalizzata, impostazioni TLS/CA e parametri del backend) ma costruisce **un pool temporaneo autonomo di capacità 1**, senza i listener verbosi dell'applicazione, con timeout ridotti e gestione degli errori redatta. Il pool è chiuso prima di emettere l'esito; anomalie di connessione, query e chiusura producono solo `GDPR_SQL_ROLE_PREFLIGHT_FAILED` e un codice d'uscita non zero. Senza opt-in non viene aperta alcuna connessione. Anche il verdetto di revisione manuale esce con codice 2: **non esiste uscita zero interpretata come GO**.

**Precisazione:** è una connessione **nuova, che usa le medesime variabili e configurazioni DB del backend nel medesimo ambiente Render**, NON la sessione già in uso all'istanza Node che sta servendo utenti. Se l'app esegue `SET ROLE`, usa ulteriori pool, credenziali per altro servizio o ha valori d'ambiente differenti su istanze già attive, il test non li può attestare. Anche il corretto ruolo SQL su tale connessione non identifica crittograficamente il target Supabase e non certifica esistenza, autenticità o completezza degli eventi esterni.

La PR resta **solo codice Draft**: nessuna shell remota Render disponibile, nessun deploy, nessuna credenziale letta e nessun database reale interrogato dal diagnostico. Nessuna autorizzazione recovery.
