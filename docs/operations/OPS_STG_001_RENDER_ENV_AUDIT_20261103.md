# OPS-STG-001 — audit configurazioni Render (3 novembre 2026)

Audit in sola lettura delle variabili d'ambiente **direttamente associate** ai 12 servizi Render (10 staging, 2 produzione), seguito da correzione circoscritta **soltanto al futuro staging condiviso**. Non sono riportati valori delle credenziali, password, token o URL completi.

## Dipendenze rilevate

- `demos-staging` (id `srv-db52l1g473hc739ld250`), ancora bootstrap, aveva una `DATABASE_URL` diretta al vecchio PostgreSQL Render `demos-civic-staging-db`, la cui scadenza è prevista l'8 novembre. Nessun riferimento al progetto Supabase produzione è stato rilevato nelle variabili dirette di questo servizio.
- Backend **di produzione** `demos-backend`: la `DATABASE_URL` diretta usa il riferimento del progetto Supabase di produzione. Non risulta puntare al vecchio PostgreSQL Render.
- Gli altri nove web service staging NON riportano il riferimento al vecchio Render PostgreSQL nelle rispettive variabili direttamente interrogate. Alcuni usano già il progetto Supabase `Demos-Staging`. **Questo non esclude** riferimenti indiretti tramite Environment Groups, job, configurazioni del repository o servizi esterni: la dismissione non è ancora autorizzata.
- In quattro vecchi web service staging (`demos-sondaggi-op37-http-staging`, `demos-b2-readonly-restore-staging`, `demos-security-gates-staging`, `demos-security-staging`) la variabile `NODE_ENV` è `production`. È una configurazione da verificare prima del consolidamento, **non prova da sola** che l'ambiente usi credenziali o dati di produzione.

## Intervento eseguito sul solo `demos-staging`

Tramite connessione ufficiale Render è stata aggiornata la configurazione del servizio condiviso:

- `DATABASE_URL` azzerata: nessun collegamento database utilizzabile nel bootstrap. Sostituirla con una connessione esclusiva al progetto `Demos-Staging` solo dopo il gate di isolamento, schema e privilegi.
- `ENABLE_MINISTERO_SYNC=false`, `ENABLE_CIVIC_PROCESS_SYNC=false`: impediscono l'avvio dei job opt-in se il codice applicativo venisse caricato accidentalmente. In `api/app.js` entrambi i job partono soltanto quando il valore è esattamente `'true'`.
- `DEMOS_STAGING_ANDROID_PUSH_E2E=false` e `ALLOW_DEMOS_STAGING_MIGRATIONS=false`.

Render ha pubblicato il deploy `dep-dbkhh4fb9u1s73bf15ag` con esito **LIVE**. Verifica HTTP reale:

| Endpoint | Risposta | Interpretazione |
| --- | --- | --- |
| `GET /health` | 200, `bootstrap_only` e `ready_for_app_tests=false` | Solo liveness |
| `GET /health/ready` | 503 | Non pronto per E2E/app |
| `GET /api/notifiche` | 404 | Nessun endpoint applicativo esposto |

Auto-deploy resta disabilitato; nessuna modifica ai servizi di produzione, agli altri nove staging, al database Supabase o al servizio Render Key Value.

## Stato e prossimi gate

- Copia del vecchio Render PostgreSQL disponibile sul disco D: (archivio e hash registrati nella documentazione precedente, **non nel repository**); vecchio database non cancellato.
- Supabase `Demos-Staging`: 25 tabelle `public`, tutte e nove quelle del controllo minimo presenti. Ciò **non** costituisce readiness funzionale. Nel backend sono ancora citate tabelle pubbliche che mancano dallo staging.
- **Gate 1:** inventario dei collegamenti indiretti (Environment Groups, altri fornitori, dipendenze di startup) e controllo credenziali per evitare produzione.
- **Gate 2:** selezione delle tabelle necessarie alle route applicative e migrazioni additive con privilegi minimi, senza dati personali di produzione.
- **Gate 3:** connessione PostgreSQL esclusivamente verso `Demos-Staging`, autorizzazioni e TLS verificati, push/email/cron in dry-run, suite E2E multiutente e regressione.
- **Gate 4:** solo dopo i test, dismissione graduale dei nove web service ridondanti, valutazione KV e scadenza/eliminazione del vecchio PostgreSQL Render.

**Direttiva permanente:** nessun nuovo staging cloud permanente per ogni PR o chat; non usare ancora il bootstrap per test applicativi. L'infrastruttura condivisa è coordinata da OPS-STG-001. Non dichiarare GO né eliminare risorse sulla base dei soli controlli di liveness.
