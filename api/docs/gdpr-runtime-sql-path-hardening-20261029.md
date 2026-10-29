# DEMOS — GH-296: audit delle route SQL attive e riduzione dei pool duplicati (29 ottobre 2026)

**Ambito:** modifica esclusivamente nella PR Draft #374. Nessun deploy, modifica ai database, permessi reali, credenziali, account o dati personali. Questo documento NON attesta l'isolamento dell'intero data-plane; `recoveryReady:false` e `GH-296 OPEN / NO-GO` restano obbligatori.

## Nuove evidenze dal codice

1. **Il semplice non-mount di una route non impedisce i side-effect degli import.** Prima della presente modifica, `api/app.js` importava incondizionatamente `api/routes/test-db.js` e `api/routes/migrate-columns.js` / `api/routes/fix-database.js`. Alcuni di questi moduli costruiscono immediatamente `new Pool`, indipendentemente dal fatto che la route sia poi montata. Anche in assenza di query, ciò crea un oggetto di connessione separato che non è gestito dallo shutdown del pool canonico. Il codice in Draft ora imposta `mountDevApiSurface = !isProductionApp` **prima** degli import e carica 12 moduli solo quando la guardia è vera.
2. **La route amministrativa live può eseguire DDL.** `api/routes/admin/database.js` è montato sotto `/api/admin` e includeva `POST /add-opinioni-columns` protetto da Admin ma dotato di `ALTER TABLE opinioni`. Nella PR Draft quel POST viene registrato solo se `NODE_ENV !== 'production'`. `GET /opinioni-structure` continua a essere registrato e a richiedere Admin. Questo non impone isolamento dei processi SQL privilegiati né modifica ruoli: riduce soltanto un endpoint amministrativo obsoleto.
3. **Due route GDPR/privacy importavano ancora `api/config/db.js`.** Il modulo crea immediatamente un pool indipendente con `ssl.rejectUnauthorized:false` e lo esporta come `{pool}`. La route `api/routes/user/privacy-settings.js` importava il modulo in `db` e poi chiamava `db.query`, metodo assente in quell'export: questa implementazione non poteva completare le query. Nel Draft usa ora `getPool()` da `api/config/database.js`, riutilizzando il singleton verificato per TLS già impiegato da `middleware/auth`. La route `api/routes/user/gdpr-requests.js` importava il vecchio pool senza mai eseguire alcuna query: l'import è stato rimosso per evitare connessioni inutili.
4. **Una precedente limitazione resta:** `api/config/db.js` non è stato eliminato; la diagnostica legacy `api/routes/test-db.js` lo utilizza ancora fuori produzione. La ricerca del codice non sostituisce l'inventario completo di script, processi e client indipendenti.

## Evidenza di schema Supabase, solo lettura

Una query `SELECT` su `information_schema.columns` del progetto Supabase Demos ha confermato l'esistenza in `public.users` delle quattro colonne necessarie a `privacy-settings`: `email_notifications` (boolean), `push_notifications` (boolean), `data_analytics` (boolean), `updated_at` (timestamptz). **Nessuna riga utente è stata consultata** e nessuna richiesta di modifica ai dati è stata effettuata.

## Test e limiti

- `api/tests/gdprDataPlaneRouteSurface.test.js` impedisce il ritorno degli import eager dei 12 moduli dev in produzione.
- `api/tests/gdprLegacyAdminSchemaMutationRouteIsolated.test.js` carica il router amministrativo con pool e auth falsi; verifica che in produzione, anche con `ALLOW_DEV_API_SURFACE=true`, l'endpoint POST DDL non esista, mentre il GET read-only resti presente.
- `api/tests/gdprPrivacyCanonicalPoolIsolated.test.js` esegue le route effettive GET/PUT di privacy su HTTP localhost, con DB, autenticazione e audit **simulati**. Verifica selezione e update parametrizzati con un solo singleton, nessun accesso SQL sulla richiesta non valida e nessun import del vecchio pool.
- Tutte le prove sopra si eseguono nel workflow `.github/workflows/gdpr-b2-worker-retry-isolated-ci.yml` usando il runner CI, senza credenziali dei provider. Non costituiscono test della route Render live. L'esito delle workflow è tracciato nell'issue GH-296 e nel Google Sheet di roadmap.

## Rischio scoperto e non risolto in questa fase

La route `api/routes/user/gdpr-requests.js` contiene ancora implementazione segnaposto: `GET` restituisce sempre un elenco vuoto e `POST` comunica successo costruendo una richiesta fittizia in memoria **senza registrare niente**. È un rischio funzionale e di corretta informazione, distinto dalla rimozione del suo import SQL. Occorre decidere, in una modifica dedicata e testata, se delegare al servizio GDPR persistente oppure rispondere esplicitamente che la funzione non è attiva; non si deve spacciare la risposta fittizia per una richiesta legale conservata. Verificare anche i percorsi GDPR già implementati in `api/routes/user/gdpr-rights.js` prima di qualsiasi migrazione.

## Cosa resta per GH-296

L'identità di `current_user/session_user` dal processo Render live non è stata attestata: la sessione Supabase Management API è diversa. L'isolamento per recovery richiede blocco reale indipendente dal backup SQL di tutte le connessioni PostgreSQL/Supavisor **e** degli endpoint HTTPS PostgREST/Storage/Auth, inclusi i writer esterni e le credenziali obsolete; un test di route non può sostituirlo. Servono inoltre evidenze durevoli B2 e autorizzazioni RP-10/F5-17 e DPO/DPIA.

**GH-296 resta NO-GO.** La PR Draft non deve essere fusa o distribuita in produzione senza revisione e approvazione separate.
