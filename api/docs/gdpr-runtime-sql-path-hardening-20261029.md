# DEMOS — GH-296: audit delle route SQL attive e riduzione dei pool duplicati (29 ottobre 2026)

**Ambito:** modifica esclusivamente nella PR Draft #374. Nessun deploy, modifica ai database, permessi reali, credenziali, account o dati personali. Questo documento NON attesta l'isolamento dell'intero data-plane; `recoveryReady:false` e `GH-296 OPEN / NO-GO` restano obbligatori.

## Nuove evidenze dal codice

1. **Il semplice non-mount di una route non impedisce i side-effect degli import.** Prima della presente modifica, `api/app.js` importava incondizionatamente `api/routes/test-db.js` e `api/routes/migrate-columns.js` / `api/routes/fix-database.js`. Alcuni di questi moduli costruiscono immediatamente `new Pool`, indipendentemente dal fatto che la route sia poi montata. Anche in assenza di query, ciò crea un oggetto di connessione separato che non è gestito dallo shutdown del pool canonico. Il codice in Draft ora imposta `mountDevApiSurface = !isProductionApp` **prima** degli import e carica 12 moduli solo quando la guardia è vera.
2. **La route amministrativa live può eseguire DDL.** `api/routes/admin/database.js` è montato sotto `/api/admin` e includeva `POST /add-opinioni-columns` protetto da Admin ma dotato di `ALTER TABLE opinioni`. Nella PR Draft quel POST viene registrato solo se `NODE_ENV !== 'production'`. `GET /opinioni-structure` continua a essere registrato e a richiedere Admin. Questo non impone isolamento dei processi SQL privilegiati né modifica ruoli: riduce soltanto un endpoint amministrativo obsoleto.
3. **Due route GDPR/privacy utilizzavano `api/config/db.js` nella base originale.** Il modulo crea immediatamente un pool indipendente con `ssl.rejectUnauthorized:false` e lo esporta come `{pool}`. La route `api/routes/user/privacy-settings.js` importava il modulo in `db` e poi chiamava `db.query`, metodo assente in quell'export: questa implementazione non poteva completare le query. Nel Draft usa ora `getPool()` da `api/config/database.js`, riutilizzando il singleton verificato per TLS già impiegato da `middleware/auth`. La route `api/routes/user/gdpr-requests.js` nel ramo #374 mantiene temporaneamente l'import originale: il suo percorso è invece di competenza della PR Draft #376, che implementa le richieste persistite e rende `api/config/db.js` un wrapper del singleton. La modifica di rimozione dell'import su #374 è stata ritirata perché produceva un conflitto di merge nella suite composita. Non unire o distribuire #374 da sola per risolvere il tema GDPR-requests.
4. **Una precedente limitazione resta:** `api/config/db.js` non è stato eliminato; la diagnostica legacy `api/routes/test-db.js` lo utilizza ancora fuori produzione. La ricerca del codice non sostituisce l'inventario completo di script, processi e client indipendenti.

## Evidenza di schema Supabase, solo lettura

Una query `SELECT` su `information_schema.columns` del progetto Supabase Demos ha confermato l'esistenza in `public.users` delle quattro colonne necessarie a `privacy-settings`: `email_notifications` (boolean), `push_notifications` (boolean), `data_analytics` (boolean), `updated_at` (timestamptz). **Nessuna riga utente è stata consultata** e nessuna richiesta di modifica ai dati è stata effettuata.

## Test e limiti

- `api/tests/gdprDataPlaneRouteSurface.test.js` impedisce il ritorno degli import eager dei 12 moduli dev in produzione.
- `api/tests/gdprLegacyAdminSchemaMutationRouteIsolated.test.js` carica il router amministrativo con pool e auth falsi; verifica che in produzione, anche con `ALLOW_DEV_API_SURFACE=true`, l'endpoint POST DDL non esista, mentre il GET read-only resti presente.
- `api/tests/gdprPrivacyCanonicalPoolIsolated.test.js` esegue le route effettive GET/PUT di privacy su HTTP localhost, con DB, autenticazione e audit **simulati**. Verifica selezione e update parametrizzati con un solo singleton, nessun accesso SQL sulla richiesta non valida e nessun import del vecchio pool.
- Tutte le prove sopra si eseguono nel workflow `.github/workflows/gdpr-b2-worker-retry-isolated-ci.yml` usando il runner CI, senza credenziali dei provider. Non costituiscono test della route Render live. L'esito delle workflow è tracciato nell'issue GH-296 e nel Google Sheet di roadmap.

## Rischio scoperto e non risolto in questa fase

La route `api/routes/user/gdpr-requests.js` della sola PR #374 conserva lo storico segnaposto, con GET vuoto e POST che dichiara registrazione senza persistenza. **La PR #376 risolve già questo problema** con la scrittura persistente in `public.user_rights_requests`, un protocollo di idempotenza e uno storico reale; i suoi test SQL PG17 ne verificano il contratto. La compatibilità della composizione #374+#376 deve restare verde prima di qualsiasi proposta di merge. Non attribuire al solo ramo #374 il miglioramento implementato in #376.

## Cosa resta per GH-296

L'identità di `current_user/session_user` dal processo Render live non è stata attestata: la sessione Supabase Management API è diversa. L'isolamento per recovery richiede blocco reale indipendente dal backup SQL di tutte le connessioni PostgreSQL/Supavisor **e** degli endpoint HTTPS PostgREST/Storage/Auth, inclusi i writer esterni e le credenziali obsolete; un test di route non può sostituirlo. Servono inoltre evidenze durevoli B2 e autorizzazioni RP-10/F5-17 e DPO/DPIA.

**GH-296 resta NO-GO.** La PR Draft non deve essere fusa o distribuita in produzione senza revisione e approvazione separate.
