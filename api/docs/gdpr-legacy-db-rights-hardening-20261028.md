# DEMOS — sicurezza dei percorsi GDPR legacy (28 ottobre 2026)

**Stato: PR Draft #375, base main, nessun deploy, produzione invariata.** Intervento indipendente dalla catena #366→#374 e dal recovery #296.

## Evidenze dal codice esistente

1. `api/config/db.js` costruiva un **secondo** `pg.Pool` con `ssl.rejectUnauthorized=false` per ogni host, compresi Supabase e altri database esterni. A differenza di `api/config/database.js`, non applicava la CA Supabase né filtrava i parametri TLS sulla URL. Il modulo è importato da `api/routes/user/privacy-settings.js`, `api/routes/user/gdpr-requests.js` e `api/routes/test-db.js`.
2. `privacy-settings.js` invocava `db.query(...)`, ma il modulo esportava solo `{pool}`. La chiamata non poteva raggiungere PostgreSQL attraverso questo import. Il middleware `verifyToken` fornisce `req.user.id` e `req.userId`.
3. L'endpoint autenticato `POST /api/user/gdpr-requests` rispondeva `success=true` e assegnava un ID dal tempo locale **senza INSERT**. Il GET restituiva `success=true, data=[]` **senza SELECT**. Ciò non è una garanzia di presentazione o ricezione della richiesta da parte del titolare/DPO.

## Intervento proposto

- `api/config/db.js` è adesso un semplice **alias lazy** per il singleton TLS-aware `getPool()` del backend. Le due forme già usate dalle route `{pool}` e `db.query(...)` rimangono disponibili. Nessun secondo Pool è creato e nessuna connessione avviene al caricamento del modulo. Il percorso legacy `DB_HOST` senza `DATABASE_URL` non è supportato da questo alias; il backend ordinario dipende già da `DATABASE_URL`.
- Il POST usa `INSERT ... RETURNING id` **parametrizzato** nella tabella già esistente `public.user_rights_requests` e risponde 201 solamente a scrittura confermata. `request_data` contiene `source=gdpr_requests_api` e massimo 2.000 caratteri di dettagli, senza ripetere il testo nella ricevuta. Dati mancanti, tipi non validi, errori DB o assenza di ID restituito producono una risposta di errore, mai una ricevuta inventata. **In caso di timeout dopo un COMMIT non è possibile sapere dal solo HTTP se la scrittura sia già avvenuta:** la risposta segnala perciò «registrazione non confermata» e invita a controllare lo storico prima di ritentare, senza affermare falsamente che il database non abbia salvato nulla. L'idempotenza end-to-end richiederebbe uno schema/contratto aggiuntivo, che questa PR non introduce.
- Il GET restituisce fino a 50 **vere** richieste dell'utente autenticato, ordinate per data, omettendo `request_data`. Un DB non disponibile restituisce 503. Prima della lettura, l'endpoint esegue `pg_catalog.row_security_active('public.user_rights_requests'::regclass)` nel **ruolo effettivo del pool**; se la visibilità del ruolo è filtrata da RLS, risponde 503 senza pubblicare uno storico potenzialmente incompleto. Non basta che esista una policy: una policy `USING (false)` o limitata ad altri soggetti può comunque nascondere righe. Tale scelta conservativa blocca anche policy selettive legittime e richiede una futura revisione del percorso di lettura least-privilege, anziché disattivare RLS.
- Non viene introdotta alcuna tabella o nuova policy sul database, non viene spedito un messaggio automatico al DPO e non si pretende di conoscere se/come la richiesta sarà effettivamente lavorata; il salvataggio e il workflow DPO rimangono controlli distinti.

## Schema effettivo verificato (metadati, non dati personali)

Su Supabase produzione, **solo SELECT sui cataloghi PostgreSQL**: `public.user_rights_requests` esiste con `id UUID DEFAULT gen_random_uuid()`, `user_id VARCHAR(255)`, `request_type VARCHAR(50)`, `request_data JSONB`, `status VARCHAR(20) DEFAULT 'pending'`, `created_at TIMESTAMPTZ`. La tabella ha `RLS=true`, `FORCE RLS=false`, **0 policy**, nessun privilegio DML dei tre ruoli Data API `anon/authenticated/service_role`, ed è owned by `postgres`.

**Implicazione per il rollout:** una connessione backend con ruolo non-owner e senza BYPASSRLS, su cui non sia stata prevista una policy dedicata, **non potrà leggere/scrivere questa tabella**. La PR fail-closed eviterà finte conferme, ma **non prova che la connessione Render abbia i permessi richiesti**. La soluzione non è disattivare RLS o usare `service_role` nel frontend: l'identità SQL effettiva e il modello di accesso devono essere verificati dal titolare/DPO in ambiente isolato prima del merge.

Le quattro colonne `users.email_notifications`, `push_notifications`, `data_analytics`, `updated_at` invocate da `privacy-settings.js` risultano effettivamente presenti in produzione; ciò non prova tutti i percorsi HTTP o i privilegi runtime. Non sono state consultate righe o valori personali.

## Test sintetici

- [Workflow offline/PG17 della PR](https://github.com/Nictolas/DemosApp/actions/runs/40601897143): **12/12 test offline** (TLS canonico, alias legacy lazy, query parametrizzate, scope utente, input guard, errori e rifiuto dello storico falsamente vuoto) e **1/1 test di integrazione su PostgreSQL 17 usa-e-getta**.
- Il test PG17 salva realmente una richiesta in una tabella sintetica con schema equivalente, legge la ricevuta da PostgreSQL, controlla la visibilità per un altro utente e verifica che un ruolo `NOBYPASSRLS` senza policy non possa ottenere né una finta ricevuta né uno storico apparentemente vuoto. **Nessun dato/credenziale di provider usato**.

**Gate ancora aperti:** review del contratto API e della UX, verifica effettiva del ruolo SQL Render per `user_rights_requests`, controllo della presa in carico da parte del DPO, idempotenza delle richieste in caso di ritentativi HTTP dopo timeout, scelta di una strategia di lettura sicura che non dipenda da un ruolo SQL con visibilità parziale, CI completa dell'app, decisione separata sul deploy e sul recovery #296. **Nessun GO implicito.**
