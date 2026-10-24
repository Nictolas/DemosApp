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
2. **Importante — usare il pooler IPv4, non la connessione diretta IPv6.** Sul dashboard **Demos-Staging** scegliere **Connect → Session pooler** (porta **5432**) e copiare il **PGHOST esatto** dalla connessione proposta. Deve corrispondere al formato `aws-<indice>-eu-central-1.pooler.supabase.com` (l'indice non va indovinato). Render non supporta IPv6 outbound, mentre su Supabase Free il collegamento diretto `db.fkeayjzvtuvzesljhjbc.supabase.co:5432` è normalmente solo IPv6 e dunque NON va usato. Per il ruolo custom il nome utente Supavisor deve essere precisamente `op37_http_staging_reader.fkeayjzvtuvzesljhjbc`. Sul solo servizio Render dedicato (non `demos-backend`), impostare `PGHOST` copiato, `PGPORT=5432`, `PGDATABASE=postgres`, `PGUSER` col suddetto suffisso tenant, `PGPASSWORD` con la password unica del ruolo staging; aggiungere un token di almeno 48 caratteri casuali in `OP37_HTTP_TOKEN`. Mantenere `RENDER=true` e `OP37_STAGING_HTTP_ONLY=yes`. **Solo a configurazione verificata**, cambiare `OP37_STAGING_SETUP_ONLY=no`.
3. NON configurare `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` e non collegare gruppi di variabili dei servizi produzione. Lasciare auto-deploy disattivato.
4. Dal dashboard Render, avviare esplicitamente il deploy del ramo di PR #258; non distribuire nel backend principale. Il codice rifiuta all'avvio host, ruolo, schema o variabili non attesi. Con TLS valido e permessi limitati, esegue 12 campioni della route HTTP su loopback interno Render collegandosi via rete a **Supabase staging**, poi chiude il pool SQL e pubblica soltanto una sintesi aggregata a `/benchmark/summary`.
5. Se il **pooler sessione** non è raggiungibile, fallisce l'autenticazione tenant-suffixed o non è verificabile il TLS, non impostare `rejectUnauthorized=false`, non inventare un hostname, non cambiare verso il database di produzione e non acquistare un add-on IPv4 per aggirare il problema. Controllare il vero hostname dalla pagina Connect di **Demos-Staging** e la configurazione del ruolo, quindi rivalutare il collegamento. Il server richiede username e hostname staging prima di aprire una connessione.
6. Dopo la prova, rimuovere `PGPASSWORD` e `OP37_HTTP_TOKEN` da Render, riportare `OP37_STAGING_SETUP_ONLY=yes` ed eseguire un nuovo deploy. Nel SQL Editor staging: `ALTER ROLE op37_http_staging_reader NOLOGIN;`. Verificare nuovamente `/health=503` e i log di modalità setup-only.

Questi sono **passaggi da eseguire sui pannelli dei provider**, non risultano eseguiti in questo checkpoint. Niente valori di credenziali sono stati salvati nei file del repository.

## Stato e blocchi

- OP-37 **In corso**: CI TEXT e staging **SQL server-side** verificati; confronto HTTP Render→Supabase ancora da misurare.
- OP-36 e KPI-20: p50/p95 applicativi end-to-end **non verificati**; non attribuire i millisecondi SQL staging alla rete o all'app Android.
- OP-39: privacy end-to-end staging non ancora conclusa.
- Nessuna migrazione binaria, merge o release. PR #247 resta in bozza e sospesa operativamente.


## Correzione DOC-061: compatibilità IPv4 verificata con i provider

Secondo la documentazione di [Render](https://render.com/articles/how-to-connect-a-render-service-to-supabase-postgres) e [Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), il backend Render usa uscita IPv4 e i collegamenti diretti Supabase Free sono IPv6. Il pooler condiviso, modalità **sessione** (5432), è disponibile via IPv4 gratuitamente; con ruoli custom il nome utente include **`.<project_ref>`**.

È stato quindi corretto l'HTTP harness in PR #258: **rifiuta** connessione diretta, tenant produzione, porta 6543 non richiesta, altro host/region, password/token corti e variabili di ambiente di produzione. Non è stata attivata alcuna password né modificato il servizio Render esistente, che resta sul commit live `80db6a4` e in `setup-only`.

**Nota:** il valore preciso di `PGHOST` dipende dall'indice del pooler assegnato a Demos-Staging: deve essere copiato dalla pagina Connect, non ricostruito per supposizione. Nessun costo a pagamento autorizzato. Il test pubblico senza credenziali, ove disponibile, controlla solo i dinieghi `503/404`, non la connessione al database.
