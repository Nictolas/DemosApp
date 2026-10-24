# DOC-060 · Handoff sicuro per HTTP staging di Sondaggi

24 ottobre 2026. PR [#258](https://github.com/Nictolas/DemosApp/pull/258) **DRAFT**; nessun merge o deploy della produzione.

## Accertato

Il servizio Render gratuito [demos-sondaggi-op37-http-staging](https://dashboard.render.com/web/srv-dbeeca5g1s2s73fb7pd0) è **LIVE** sul commit `80db6a4`, dal ramo `feature/sondaggi-text-bulk-op37-20261024`, con auto-deploy **OFF**. I log Render contengono `OP37_RENDER_SETUP_ONLY_NO_DATABASE`. Nessuna password PG o token del benchmark è configurata e il servizio non è collegato al database.

Il ruolo Supabase `op37_http_staging_reader` esiste **solo su Demos-Staging**, con `NOLOGIN`, non superuser, senza `BYPASSRLS`, `SELECT` consentito sulle quattro tabelle sintetiche `op37_sondaggi_ci` e senza privilegi `INSERT`/`UPDATE`. Le quattro tabelle hanno RLS, e `anon`, `authenticated`, `service_role` non hanno `USAGE` sullo schema privato. La produzione DEMOS non è stata toccata.

### Test automatici del fail-closed

`api/tests/sondaggiRenderStagingIsolation.test.js` esegue la vera applicazione Node in un processo figlio senza credenziali, controlla via HTTP localhost:
- `/` indica `setup_required`, `databaseConnected=false`, `productionConnected=false`;
- `/health` risponde **503**, `/benchmark/summary` **503**;
- `/api/sondaggi`, le tre varianti geografiche e `/api/users` rispondono **404** senza token;
- il processo termina senza aprire alcuna connessione se la configurazione include una password inattesa in modalità `setup-only` o se manca un parametro di sicurezza;
- la riscrittura SQL ammette soltanto lo schema privato di staging e rifiuta SQL mutante, tabelle non riconosciute e `public/auth/storage`.

I test reali di query aggregate sul PostgreSQL sintetico CI continuano ad essere eseguiti dallo stesso workflow. **La prova di sicurezza HTTP è locale nella CI; un test HTTP pubblico esterno non è stato verificato tramite questa connessione.**

## Handoff manuale, senza inviare segreti in chat

La creazione e il trasferimento automatici delle credenziali tra Supabase e Render sono stati bloccati dai controlli di sicurezza. Non cercare di bypassarli o copiare credenziali `postgres`, `service_role` o di produzione.

Per abilitare una singola misurazione HTTP occorre agire nei pannelli dei rispettivi provider:

1. Nel progetto **Demos-Staging** (non **Demos**) aprire SQL Editor. Generare una password unica, lunga e casuale usando un gestore credenziali sicuro. Abilitare soltanto il ruolo già limitato con `ALTER ROLE op37_http_staging_reader LOGIN PASSWORD '<password_forte_esclusiva_di_staging>';`. Non pubblicare la password in GitHub, nei log o in chat.
2. Sul servizio Render dedicato (non `demos-backend`), impostare `PGHOST=db.fkeayjzvtuvzesljhjbc.supabase.co`, `PGPORT=5432`, `PGDATABASE=postgres`, `PGUSER=op37_http_staging_reader`, `PGPASSWORD` con la nuova password; creare un token separato di almeno 48 caratteri casuali in `OP37_HTTP_TOKEN`. Mantenere `RENDER=true` e `OP37_STAGING_HTTP_ONLY=yes`. **Solo quando il controllo è completo**, portare `OP37_STAGING_SETUP_ONLY=no`.
3. NON configurare `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` e non collegare gruppi di variabili dei servizi produzione. Lasciare auto-deploy disattivato.
4. Dal dashboard Render, avviare esplicitamente il deploy del ramo di PR #258; non distribuire nel backend principale. Il codice rifiuta all'avvio host, ruolo, schema o variabili non attesi. Con TLS valido e permessi limitati, esegue 12 campioni della route HTTP su loopback interno Render collegandosi via rete a **Supabase staging**, poi chiude il pool SQL e pubblica soltanto una sintesi aggregata a `/benchmark/summary`.
5. Se il collegamento diretto Supabase non è raggiungibile dalla rete Render o il TLS non è verificabile, **non** impostare `rejectUnauthorized=false` e **non** ripiegare su credenziali di produzione. La configurazione va rivalutata prima di ritentare.
6. Dopo la prova, rimuovere `PGPASSWORD` e `OP37_HTTP_TOKEN` da Render, riportare `OP37_STAGING_SETUP_ONLY=yes` ed eseguire un nuovo deploy. Nel SQL Editor staging: `ALTER ROLE op37_http_staging_reader NOLOGIN;`. Verificare nuovamente `/health=503` e i log di modalità setup-only.

Questi sono **passaggi da eseguire sui pannelli dei provider**, non risultano eseguiti in questo checkpoint. Niente valori di credenziali sono stati salvati nei file del repository.

## Stato e blocchi

- OP-37 **In corso**: CI TEXT e staging **SQL server-side** verificati; confronto HTTP Render→Supabase ancora da misurare.
- OP-36 e KPI-20: p50/p95 applicativi end-to-end **non verificati**; non attribuire i millisecondi SQL staging alla rete o all'app Android.
- OP-39: privacy end-to-end staging non ancora conclusa.
- Nessuna migrazione binaria, merge o release. PR #247 resta in bozza e sospesa operativamente.
