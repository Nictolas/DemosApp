# DEMOS — Lettura voto di fiducia Governo, revoca, cache (25 ottobre 2026)

**Stato:** correzione su PR draft concatenata alla #282, senza merge né deploy.

## Difetto confermato

`GET /api/governo/consenso` consentiva accesso pubblico alle statistiche, ma se riceveva un Bearer token restituiva anche `mioConsenso` e il cooldown senza verificare il consenso politico. La statistica includeva inoltre righe residue di utenti con consenso revocato. La route stampava nei log gli **header HTTP completi**, la struttura del token JWT decodificato e l'identificativo utente: potenziale divulgazione di credenziali e informazioni politiche. Mancava una direttiva esplicita `Cache-Control: no-store`. La query frontend `['consensoGovernoData']` era condivisa fra account, e la revoca non cancellava tale cache. Anche `['governoVoti']` non era isolata per account e non veniva ripulita.

## Correzioni proposte

- Header `Cache-Control: private, no-store, max-age=0` sul GET, anche per anonimi, token invalidi ed errori; il prefisso `/api/governo/` è già incluso nel bypass CDN configurabile dell'app.
- Verifica dei Bearer token tramite `verifyAccessToken` (tipo access, firma, issuer, audience, algoritmo, scadenza), senza log di header/token/payload. Token assente o non valido: solo statistica pubblica, mai scelta o cooldown personali.
- La scelta dell'utente è filtrata tramite `users` + `user_consents` **nella stessa SELECT**. Se manca consenso, `mioConsenso` è `null`, `blocco` non espone informazioni sui cambi precedenti.
- La statistica aggregata conta soltanto gli account con consenso politico attivo; scelta e cooldown riconsultano il consenso prima del ritorno, per limitare la divulgazione se la revoca termina durante la lettura.
- La cache React Query del consenso è indicizzata per account e le richieste supportano la propagazione dell'`AbortSignal` al fetch. Anche la cache `governoVoti` è isolata per account; la revoca annulla le due richieste in corso e rimuove le rispettive cache prima di mostrare il successo.
- Errori del database sanitizzati, nessuna credenziale o preferenza sensibile registrata dalla route.

## Test

Test unitari con il vero handler estratto dal sorgente: risposta con consenso attivo, residui dopo revoca, assenza/invalidità del token, revoca durante il cooldown, DB fail-closed, privacy logging e bypass CDN. Test frontend: cache per account, `AbortSignal`, cancellazione e rimozione prima della notifica. Query reali su PostgreSQL 17 **locale e sintetico**, in tabelle TEMP con rollback finale: voto attivo, voto revocato residuo, vista anonima, token invalido e revoca dopo precedente consenso.

## Limiti

Il controllo del consenso nella stessa SELECT e la verifica finale riducono l'esposizione, ma non serializzano una risposta HTTP già avviata con una revoca successiva. La statistica aggregata di piccoli gruppi potrebbe consentire inferenze e richiede valutazione dedicata. Gli endpoint `GET /api/governo/voti` e `/ideale` non sono corretti lato server in questa PR: la pulizia della cache client non basta a impedire la lettura dopo una nuova richiesta, perciò **restano un rischio da risolvere prima del merge**. Non sono state eseguite prove Android/CDN su dispositivi o produzione. La DPIA è stata approvata dichiarativamente dall'interlocutore che si identifica come DPO; resta da collegare alla versione documentale e ai rischi residui pertinenti alle PR in bozza.

**Nessun merge, deploy, accesso a dati personali reali o modifica di produzione.**
