# DEMOS — voto alle opinioni proposte e revoca del consenso (25 ottobre 2026)

**Stato:** modifica su PR draft concatenata alla #279. Nessun merge né deploy.

## Problema nel codice precedente

L'endpoint `POST /api/opinioni-proposte/:id/vota` eseguiva l'inserimento tramite `pool.query` dopo un controllo preliminare del consenso nel middleware. Una revoca completata tra il middleware e l'inserimento lasciava la possibilità di registrare un voto successivo alla revoca. Inoltre, la risposta HTTP 500 esponeva il messaggio di errore e lo stack SQL, mentre il logging riportava ID utente, ID dell'opinione e dettagli del voto.

## Correzione proposta

- `Cache-Control: private, no-store, max-age=0` prima dell'autenticazione, anche in caso di errore;
- unica transazione su un solo client DB: `BEGIN`, lock `SELECT id FROM users WHERE id=$1 FOR UPDATE`, successivo `getPoliticalConsentState(client,userId)`, schema check, ricerca proposta e `INSERT ... ON CONFLICT DO NOTHING`, `COMMIT`;
- dopo la revoca: `403 POLITICAL_CONSENT_REQUIRED`, rollback e nessuna scrittura, anche se il middleware aveva già autorizzato la richiesta;
- mantenuta la compatibilità con il fallback `opinioni_domande` in stato da approvare e con i voti idempotenti;
- errori interni sanitizzati e nessun valore/ID politico scritto nei log dell'endpoint;
- la rimozione volontaria `DELETE /:id/vota` resta invariata e possibile anche senza consenso.

## Verifiche

Test unitari con pool sintetico e handler estratto dal sorgente per sequenza lock/consenso/schema/insert, revoca, rollback, errori, fallback e no-store. Test di concorrenza HTTP/Express + PostgreSQL 17 su database CI **effimero e sintetico**, con due sequenze forzate: salvataggio-prima-revoca e revoca-prima-salvataggio. Accesso a database reali o credenziali di produzione esplicitamente vietato dallo script.

**Limiti residui:** altre superfici di scrittura o lettura politica non sono automaticamente coperte da questa modifica. Test manuali Android/CDN e revisione delle PR concatenate necessari prima del rilascio. Il DPO ha dichiarato in chat l'approvazione della DPIA; la versione esatta e gli aggiornamenti ai rischi residui richiedono ancora associazione documentale. Nessuna modifica alla produzione.
