# DEMOS — blocchi pubblici e salvataggi canonici delle preferenze politiche

**26 ottobre 2026. PR DRAFT stacked su #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302. Nessun effetto sulla produzione.**

## Rischio

Dopo la PR #333 il consenso politico viene concesso/revocato aggiornando `public.users` e `public.user_consents`. Tuttavia due percorsi di salvataggio ancora usavano `SELECT id FROM users WHERE id=$1 FOR UPDATE`, con letture o scritture personali non qualificate:
- `api/routes/opinioni/user-answers.js` per `POST /api/opinioni/salva`;
- `api/services/politicalSelectionService.js` per candidati/rappresentanti e relative proiezioni legacy.

Se una connessione PostgreSQL acquisisce `search_path=pg_temp,public`, il blocco `FOR UPDATE` può essere acquisito su **pg_temp.users**, che non impedisce alla revoca di aggiornare `public.users`. Il processo può quindi verificare uno stato incoerente e salvare dati politici dopo che la revoca è stata effettuata. Anche `opinioni_risposte`, `political_selections` e `user_representatives` possono essere mascherate da tabelle temporanee.

## Modifiche progettuali isolate

- La scrittura delle opinioni blocca `public.users` prima di leggere il consenso da `public.users` + `public.user_consents`; tutte le letture e `INSERT`/`UPDATE` delle risposte nella stessa transazione usano `public.opinioni_risposte`. La verifica delle colonne ammesse nell'`information_schema` è limitata esplicitamente a `table_schema='public'`.
- `setPoliticalSelection` blocca `public.users`, usa la verifica canonica del consenso e scrive in `public.political_selections`. Le proiezioni legacy consentite restano compatibili, ma i campi in `users` e `user_representatives` sono aggiornati in `public`. Le query di sola lettura per proiezioni e sostenitori sono **fuori dal perimetro di questa PR** e richiedono audit separato.
- Nessun nuovo parametro, migrazione, DDL, flag, transazione, credenziale o accesso B2 nella logica applicativa.

## Regressioni sintetiche

- Gli unit test dei percorsi richiedono esplicitamente la SQL `public`, mantenendo ordine `BEGIN → lock pubblico → stato consenso → INSERT/UPDATE → COMMIT` e le prove di revoca e rollback.
- `verify-political-consent-save-race-ci.js` su PostgreSQL 17 localhost synthetic: tutte le connessioni del pool hanno copie temporanee di `users`, `user_consents` e `opinioni_risposte` e `search_path=pg_temp,public`. Una revoca sul record `public` parte prima del save; il save deve attendere e terminare con 403. Una successiva concessione consente invece il salvataggio della risposta solo nella tabella `public`, lasciando il valore shadow inalterato.
- `verify-political-selection-write-revoke-race-ci.js`: su una connessione borrowed con shadow `users`/`user_consents`/`political_selections`, una seconda transazione blocca `public.users`. Il tentativo di scelta deve scadere con SQLSTATE `55P03` usando `lock_timeout` limitato: non deve bloccare la tabella shadow. Dopo il rollback del revoker, la scelta deve essere salvata solo in `public`; dopo revoca del consenso `public`, una nuova scelta deve fallire anche se la shadow resta favorevole.

I database sono temporanei, isolati, con sentinelle di ambiente `GITHUB_ACTIONS` e credenziali fittizie localhost. Non è una prova di copertura di tutte le altre route.

## Dipendenze bloccanti di issue #296

Non è dimostrata con questi test l'indipendenza e completezza/freschezza di tutti gli eventi GDPR fino al freeze, né il loro salvataggio remoto prima di un guasto che perda il database. Restano indispensabili quarantena di tutte le istanze/ingressi Render e Supabase, inclusi Data API e worker, prove reali B2 COMPLIANCE/VersionId/retention su staging, procedure e approvazioni DPIA/titolare/DPO, retention e costi.

**PR DRAFT: nessun merge, deploy, migrazione, modifica produzione, accesso a dati reali, segreti o attivazione servizi.**
