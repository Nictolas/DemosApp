# DOC-060 · Handoff sicuro per HTTP staging di Sondaggi

24 ottobre 2026. PR [#258](https://github.com/Nictolas/DemosApp/pull/258) **DRAFT**; nessun merge o deploy della produzione.

## Accertato

Il servizio Render gratuito [demos-sondaggi-op37-http-staging](https://dashboard.render.com/web/srv-dbeeca5g1s2s73fb7pd0) è **LIVE** sul commit `c785ea1` (deploy `dep-dbeev0q9lscs73auoo20`, verificato il 24/10/2026), dal ramo `feature/sondaggi-text-bulk-op37-20261024`, con auto-deploy **OFF**. I log Render contengono `OP37_RENDER_SETUP_ONLY_NO_DATABASE`. Nessuna password PG o token del benchmark è configurata e il servizio non è collegato al database.

Il ruolo Supabase `op37_http_staging_reader` esiste **solo su Demos-Staging**, con `NOLOGIN`, non superuser, senza `BYPASSRLS`, `SELECT` consentito sulle quattro tabelle sintetiche `op37_sondaggi_ci` e senza privilegi `INSERT`/`UPDATE`. Le quattro tabelle hanno RLS, e `anon`, `authenticated`, `service_role` non hanno `USAGE` sullo schema privato. La produzione DEMOS non è stata toccata.

### Test automatici del fail-closed

`api/tests/sondaggiRenderStagingIsolation.test.js` esegue la vera applicazione Node in un processo figlio senza credenziali, controlla via HTTP localhost:
- `/` indica `setup_required`, `databaseConnected=false`, `productionConnected=false`;
- `/health` risponde **503**, `/benchmark/summary` **503**;
- `/api/sondaggi`, le tre varianti geografiche e `/api/users` rispondono **404** senza token;
- il processo termina senza aprire alcuna connessione se la configurazione include una password inattesa in modalità `setup-only` o se manca un parametro di sicurezza;
- la riscrittura SQL ammette soltanto lo schema privato di staging e rifiuta SQL mutante, tabelle non riconosciute e `public/auth/storage`.

I test reali di query aggregate sul PostgreSQL sintetico CI continuano ad essere eseguiti dallo stesso workflow. **La prova delle route SQL senza credenziali è locale nella CI, ma è stata eseguita anche una verifica indipendente via HTTP pubblico sul servizio Render reale**: workflow GitHub Actions [#40116951974](https://github.com/Nictolas/DemosApp/actions/runs/40116951974) SUCCESS, marcatore `OP37_RENDER_PUBLIC_SETUP_DENIALS_PASS`: `/` restituisce 200, `/health` e `/benchmark/summary` 503, le quattro route Sondaggi e `/api/users` 404. Non sono state impiegate password e non è stata aperta alcuna connessione al database.

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

È stato quindi corretto l'HTTP harness in PR #258: **rifiuta** connessione diretta, tenant produzione, porta 6543 non richiesta, altro host/region, password/token corti e variabili di ambiente di produzione. Non è stata attivata alcuna password. Il servizio Render dedicato è stato aggiornato al commit `c785ea1` con deploy manuale, rimanendo in `setup-only` senza collegamento al DB.

**Nota:** il valore preciso di `PGHOST` dipende dall'indice del pooler assegnato a Demos-Staging: deve essere copiato dalla pagina Connect, non ricostruito per supposizione. Nessun costo a pagamento autorizzato. Il test pubblico senza credenziali, ove disponibile, controlla solo i dinieghi `503/404`, non la connessione al database.


**CI sul protocollo IPv4 corretto:** GitHub Actions [#40117107029](https://github.com/Nictolas/DemosApp/actions/runs/40117107029) **SUCCESS** sul commit `64a10d5`: test unitari che negano endpoint diretto IPv6, tenant produzione, regione errata, porte non previste, configurazioni o URL di produzione e credenziali insufficienti. Il codice corretto è ora LIVE sul servizio Render dedicato tramite deploy manuale, ma ancora in modalità `setup-only`, con deploy automatici disattivati e credenziali non abilitate.


## DOC-062 · Distribuzione della versione protetta, senza DB

Il 24 ottobre 2026 è stato eseguito un **deploy manuale soltanto sul servizio gratuito di staging** `demos-sondaggi-op37-http-staging` (non `demos-backend`): deploy [`dep-dbeev0q9lscs73auoo20`](https://dashboard.render.com/web/srv-dbeeca5g1s2s73fb7pd0), commit GitHub `c785ea1344735015c51859420cf974b12855ace8`, stato **LIVE**. I log del nuovo deploy hanno confermato checkout di quel commit, avvio `node staging/op37_render_http_probe.js` e `OP37_RENDER_SETUP_ONLY_NO_DATABASE`. Auto-deploy ancora **OFF**.

È stata verificata direttamente nel progetto **Demos-Staging** la configurazione del ruolo PostgreSQL `op37_http_staging_reader`: `NOLOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`; `SELECT` sulle fixture sintetiche, nessun `INSERT`/`UPDATE`/`DELETE`; impostazioni persistenti `statement_timeout=11000ms`, `idle_in_transaction_session_timeout=15000ms`, **`default_transaction_read_only=on`**. Quest'ultima è stata applicata al solo ruolo staging per impedire transazioni di scrittura accidentali anche in caso di cambi futuri ai privilegi di tabella.

Non è stato attivato il login né configurato alcun segreto su Render; il codice HTTP collegato al DB non è stato eseguito. La pipeline GitHub Actions per la PR verifica gli endpoint pubblici `/`, `/health`, `/benchmark/summary`, le quattro route Sondaggi e `/api/users` con soli dinieghi, senza credenziali. Si attende il risultato del workflow sul commit documentale.

**Restante dipendenza necessaria:** configurazione manuale e temporanea nei dashboard di Supabase **Demos-Staging** e Render del pooler di sessione IPv4 e di un ruolo con password esclusiva; non chiedere, copiare o trasferire segreti in chat né aggirare i controlli di sicurezza. La PR #258 resta DRAFT, nessun deploy produzione, nessuna migrazione BYTEA.

## DOC-070 · Correzione TLS verificata (24/10/2026)

L'utente ha abilitato **LOGIN** per il ruolo dedicato sul solo progetto Demos-Staging e inserito credenziali temporanee sul servizio gratuito Render `demos-sondaggi-op37-http-staging`. La configurazione IPv4 Session pooler è `aws-1-eu-central-1.pooler.supabase.com:5432` e il nome utente del pooler è `op37_http_staging_reader.fkeayjzvtuvzesljhjbc`. **Non riportare qui password o token.**

Il deploy Render `dep-dbehj6cs728c73c8rmq0` sul commit `0ee0f612` è stato tentato il 24 ottobre: **UPDATE FAILED** con errore `SELF_SIGNED_CERT_IN_CHAIN`, prima dell'autenticazione PostgreSQL. Questo errore è coerente con la CA privata di Supabase, non con una password errata. Non disattivare mai `rejectUnauthorized` e non usare `sslmode=require` senza verifica del certificato.

La nuova versione della PR #258 introduce `OP37_SUPABASE_CA_CERT`, una variabile ambientale che contiene il **certificato di CA pubblico** fornito da Supabase. Il programma rifiuta un PEM mancante, sintatticamente non valido, non di CA o scaduto; lo passa a `pg` con `ssl: { ca, servername: PGHOST, rejectUnauthorized: true }`. La verifica del certificato e dell'hostname resta obbligatoria. **Il codice aggiornato non è ancora distribuito su Render.**

### Passaggio manuale residuo (certificato pubblico, non password)

1. Accedere al dashboard del solo progetto Supabase **Demos-Staging** → **Database → Settings / Database settings → SSL Configuration** → **Download Certificate**. I documenti ufficiali Supabase chiamano spesso il file `prod-ca-2021.crt`, anche quando è usato per lo staging. Non usare certificati inventati o scaricati da fonti alternative.
2. Aprire il file scaricato come **testo**; copiare integralmente il certificato, comprese le righe `-----BEGIN CERTIFICATE-----` e `-----END CERTIFICATE-----`. Questo certificato è una CA **pubblica**, non una chiave privata; non copiare alcuna password/chiave privata.
3. Nel servizio Render isolato → **Environment**, aggiungere una sola variabile `OP37_SUPABASE_CA_CERT` incollandone il contenuto PEM. Usare **Save only** per non distribuire vecchio codice senza CA.
4. Controllare che `PGHOST`, `PGUSER`, `PGPORT`, `PGDATABASE`, `PGPASSWORD`, `OP37_HTTP_TOKEN` siano quelli *dello staging*, e che `OP37_STAGING_SETUP_ONLY=no`. Non condividere valori segreti o screenshot che li rivelino.
5. Una volta salvato il PEM, eseguire il deploy **manuale solo del ramo PR #258 nel servizio Render isolato**. Il servizio è configurato con deploy automatici OFF. Controllare marker `OP37_RENDER_STAGING_HTTP_PASS` e la sintesi `/benchmark/summary`; se TLS fallisce ancora, indagare in modalità fail-closed senza aggirare la verifica.
6. A benchmark concluso, ripristinare staging setup-only: rimuovere password e token dal servizio e disabilitare LOGIN nel DB staging. Il software **setup-only** rifiuta l'avvio se una password rimane configurata; la pulizia e il deploy di rollback devono essere coordinati.

Fonti: https://supabase.com/docs/guides/database/connecting-to-postgres e https://supabase.com/docs/guides/platform/ssl-enforcement. La sola verifica HTTP connessa potrà misurare il costo della rete Render→Supabase; nessuna misura realistica al momento.

## DOC-071 · HTTP Render↔Supabase verificato e chiusura credenziali (24/10/2026)

**Ambiente autorizzato:** solo progetto Supabase **Demos-Staging**, schema `op37_sondaggi_ci` e servizio Render FREE `demos-sondaggi-op37-http-staging`. La PR #258 rimane **DRAFT**; la produzione DEMOS e la PR separata #247 (2-bit) non sono state modificate.

- L'utente ha caricato il certificato pubblico Supabase **Root 2021 CA**, `CA:TRUE`, con validità da aprile 2021 ad aprile 2031; nessuna chiave privata era presente. La CA è stata installata temporaneamente nella variabile Render `OP37_SUPABASE_CA_CERT`. Il codice in PR #258 richiede `ssl.ca`, `servername=PGHOST` e `rejectUnauthorized=true`, senza bypass TLS.
- **Deploy di misurazione:** `dep-dbehsm3ncjis73ea5vfg`, commit `5a3b31c87cc0e760200d8e2b3f6f94d8ca4fabd3`, stato Render **LIVE**. Il log applicativo `OP37_RENDER_STAGING_HTTP_PASS` conferma **48 richieste HTTP misurate** (12 per ambito) dopo il warm-up, 3 query SQL per richiesta, filtri di accesso, soglia privacy sintetica esattamente pari a 10, e controllo che una chiamata priva del token non divulghi dati.

| Ambito | HTTP p50 (ms) | HTTP p95 (ms) |
|---|---:|---:|
| Nazionale | 37,32 | 199,62 |
| Regionale | 31,51 | 121,45 |
| Provinciale | 40,01 | 101,42 |
| Comunale | 40,46 | 52,32 |

**Significato delle misure:** HTTP su loopback interno Render con query attraverso rete TLS al PostgreSQL Supabase staging Frankfurt; **non** includono RTT del dispositivo, login, Android o traffico concorrente. Dataset privato interamente inventato da 1.200 account/risposte e 93 opinioni pubblicate. Sono campioni limitati: p95 e proporzioni nel piano Free non sono previsione di capacità per un milione di utenti. Non è stato eseguito un confronto HTTP con il candidato SQL `COUNT FILTER`; il relativo flag rimane default OFF.

- **Pulizia avvenuta:** sul progetto Supabase Demos-Staging, `ALTER ROLE op37_http_staging_reader NOLOGIN PASSWORD NULL`; controllo esplicito `rolcanlogin=false`, `rolsuper=false`, `rolbypassrls=false`. Sul solo servizio Render staging, valori correnti `PGPASSWORD`, `OP37_HTTP_TOKEN` e `OP37_SUPABASE_CA_CERT` **svuotati**, `OP37_STAGING_SETUP_ONLY=yes`, senza sostituire o alterare altre variabili esistenti. Le chiavi vuote possono ancora comparire nella UI, ma non contengono le credenziali temporanee; la cronologia dei provider non è stata cancellata.
- **Deploy di ripristino:** `dep-dbehti9srm7s73c6tfcg` sullo stesso commit, stato **LIVE**. I log attestano `OP37_RENDER_SETUP_ONLY_NO_DATABASE`, e non compare un nuovo tentativo di collegamento al DB. AutoDeploy del servizio rimane OFF.
- Le credenziali temporanee **non sono mai state salvate nel repository o riportate nel documento**. La CA è pubblica e il file può essere riscaricato da Supabase. Nessuna migrazione BYTEA né merge.

**Stato dopo DOC-071:** OP-37 verifica HTTP staging 12×4 **completata**; KPI-20 prima misura HTTP staging **registrata**, con ulteriori prove di carico/consenso in-app ancora da eseguire; OP-39 privacy end-to-end dell'app non dichiarata conclusa. Si può ora valutare una strategia di rilascio senza lasciare accessi temporanei aperti.
