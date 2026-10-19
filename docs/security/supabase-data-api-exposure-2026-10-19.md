# DEMOS — esposizione Supabase Data API (19 ottobre 2026)

## Stato e perimetro

Questo documento prepara una correzione sicura; **non certifica che il database sia stato messo in sicurezza**.
Non contiene segreti, dati di utenti, né istruzioni di deploy automatico. Nessuna modifica in produzione è inclusa.

Evidenze raccolte:
- Progetto Supabase `Demos` (`wxnblcqoyjqxktwkcqok`, PostgreSQL 17, eu-central-1) attivo.
- Il tool `list_tables` segnala **100 tabelle in `public` con RLS disattivata**. La sola assenza di RLS non prova un accesso pubblico: sono necessari anche schema USAGE e privilegi sulle singole tabelle.
- Supabase Security Advisor segnala **11 tabelle con RLS attiva e nessuna policy** e **29 funzioni con `search_path` non esplicitato** (rilievo distinto).
- In `api/config/database.js` il backend usa `pg` + `DATABASE_URL`. Le istruzioni `api/MIGRAZIONE_NEON_SUPABASE.md` descrivono un collegamento server-side al pooler Supabase.
- Ricerca nel repository `Nictolas/DemosApp`: non emergono chiamate applicative `/rest/v1`, `supabase.from`, `@supabase/supabase-js` nei file sorgenti; una vecchia istruzione allegata ne parla ma non ne dimostra l'utilizzo corrente. L'assenza dai risultati di ricerca **non è prova definitiva**.
- Nei log recenti sono presenti messaggi dal servizio `postgrest_logs`, prevalentemente di inizializzazione/cache: non sono una misura attendibile delle richieste utente.

## Problema operativo

Il connettore Supabase consente di consultare tabelle e avvisi, ma nella sessione corrente le richieste `execute_sql` vengono bloccate prima dell'esecuzione. Non aggirare il blocco applicando SQL di produzione tramite altri canali.

## Preflight da eseguire (sola lettura)

File: `api/database/security/supabase_data_api_readonly_audit_20261019.sql`.

1. Verificare schema `public` esposto in **Integrations → Data API → Settings** e la configurazione **Hardening**.
2. Eseguire lo script SQL in ambiente autorizzato e conservare solo i conteggi dei privilegi.
3. Controllare il ruolo effettivo di `DATABASE_URL` sul servizio backend Render senza esporre password o URI complete.
4. Verificare se una qualche integrazione esterna usa PostgREST, GraphQL, `supabase-js` o RPC e se Auth/Storage usano endpoint differenti.
5. Testare su staging: login, lettura/scrittura opinioni, voti, preferenze, area admin, sincronizzazioni e lavori periodici.

## Intervento consigliato **solo se** non esistono consumatori Data API

Da Supabase Dashboard: **Integrations → Data API → Overview → Enable Data API: off**.

Secondo la documentazione Supabase, se l'app accede soltanto tramite PostgreSQL dal server, disattivare la Data API impedisce l'accesso agli endpoint REST generati senza interrompere le connessioni SQL dirette. Verificarlo sullo staging prima della produzione.

Se invece la Data API è necessaria, mantenerla attiva ma rimuovere `public` dagli schemi esposti e creare uno schema API minimale con grant/RLS/policy specifici e testati.

## Hardening permanente (seconda fase)

- Limitare esplicitamente `USAGE` e i privilegi `SELECT/INSERT/UPDATE/DELETE` di `anon` e `authenticated` a sole risorse realmente necessarie; rivedere anche le default privileges.
- Abilitare RLS con policy minime solo dopo la mappatura completa delle chiamate e dei ruoli effettivi: non applicare indiscriminatamente gli `ALTER TABLE` suggeriti dal linter.
- Proteggere in modo prioritario `users`, `user_profile`, `user_consents`, `opinioni_risposte`, sessioni/token e verifiche identità; per il backend preferire ruoli SQL dedicati con permessi minimi.
- Esaminare le 29 funzioni con `search_path` mutabile; fissare path e qualificare nomi nelle funzioni adatte, con priorità alle `SECURITY DEFINER`.
- Verificare autenticazione, salvataggio opinioni, creazione utente, amministrazione e accesso negato a `anon` dopo ogni singola fase.

## Criteri di completamento

1. Verifica negativa su accessi non autorizzati a tabelle con dati personali e politici.
2. Verifica positiva delle funzioni effettivamente necessarie al backend.
3. Supabase Security Advisor riesaminato e scostamenti documentati.
4. Nessuna regressione nei test end-to-end e nel deploy.
5. Rollback validato e documentato prima dell'applicazione in produzione.

## Riferimenti ufficiali

- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

**Nota:** la modifica alla default-exposure annunciata da Supabase per il 30 ottobre 2026 riguarda soprattutto le *nuove* tabelle: quelle esistenti conservano i grant attuali; non attendere il rollout come rimedio per i dati già presenti.

## Test di superficie API anonima (aggiunto il 19 ottobre 2026)

Il controllo `api/scripts/verify-supabase-data-api-exposure.cjs` usa esclusivamente richieste HTTP **HEAD** con `limit=0` per un elenco di tabelle sensibili. Non richiede un login utente e non scarica record.

Esecuzione su un ambiente autorizzato che possa raggiungere Internet:

```bash
node --test api/tests/supabaseDataApiExposure.test.js

# Impostare queste variabili nell'ambiente del terminale, senza salvarle in Git:
# SUPABASE_PUBLIC_URL=https://<project>.supabase.co
# SUPABASE_PUBLISHABLE_KEY=sb_publishable_<public-key>
# In alternativa SUPABASE_ANON_KEY=<legacy-anon-JWT>; il tool rifiuta JWT service_role.
node api/scripts/verify-supabase-data-api-exposure.cjs
```

Significato dell'exit code:

- `0`: le richieste anonime a tutte le tabelle controllate risultano negate (401/403/404). Non basta per certificare ogni via di accesso: verificare anche RPC, schemi aggiuntivi, policy e altri privilegi.
- `1`: almeno un endpoint sensibile ha accettato una richiesta anonima (risposta 2xx). In presenza di RLS disattivata e grant di SELECT, trattare come esposizione potenzialmente grave. Una risposta 2xx, da sola, **non prova** che siano state effettivamente lette righe.
- `2`: risposta inattesa, problema di rete o configurazione; test inconclusivo e nessun pass implicito.

Non usare `service_role`, `sb_secret_...` o chiavi amministrative. Il test impedisce deliberatamente l'uso di token JWT il cui `role` non sia `anon`.

La pipeline GitHub `.github/workflows/supabase-data-api-audit.yml` esegue **solo i test unitari offline**, non il probe verso Supabase. Eseguire il test reale su staging e produzione solo dopo aver verificato il contesto e senza inserire chiavi pubbliche o segreti nel repository.

### Rimedio operativo

Quando è accertato che le app DEMOS e le eventuali integrazioni esterne non usano Data API: da Supabase Dashboard → **Integrations → Data API → Overview**, disabilitare **Enable Data API**, rieseguire il probe, poi controllare da backend login, lettura/scrittura opinioni e job periodici. Per rollback riabilitare la stessa impostazione. La modifica non sostituisce le verifiche sulle credenziali SQL o le future politiche RLS.
