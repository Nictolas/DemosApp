# DEMOS — concorrenza revoca e scelta referendum (25 ottobre 2026)

**Stato:** proposta in PR di bozza, non distribuita. DPIA ancora da validare con il DPO.

## Rischio riscontrato
Il POST autenticato `/api/referendum/vote-real/:ballotId/choice` controllava il consenso tramite middleware prima di aprire la transazione, ma bloccava solo la scheda referendum. Una revoca concorrente poteva completare la cancellazione di `civic_ballot_positions` mentre una richiesta che aveva superato il middleware salvava successivamente una nuova scelta politica.

## Modifica
La transazione di salvataggio blocca prima la riga `users` del soggetto con `SELECT id FROM users WHERE id = $1 FOR UPDATE`. In una **query successiva** legge il consenso corrente tramite `getPoliticalConsentState`, includendo l'override `user_consents`. Se il consenso è revocato risponde 403 (`POLITICAL_CONSENT_REQUIRED`) dopo ROLLBACK; se l'utente non esiste risponde 404. Solo dopo questa verifica blocca la scheda e registra la scelta. La revoca usa la stessa riga `users` e cancella `civic_ballot_positions` nella sua transazione.

## Test
Il workflow privacy estende la verifica HTTP su PostgreSQL 17 locale e **solo dati sintetici** con tre scenari: scelta prima della revoca (poi cancellata), revoca prima della scelta (403, nessuna riga residua), consenso attivo (scelta salvata). La prova usa due richieste concorrenti realmente coordinate sul lock della riga utente, non soltanto richieste sequenziali. Il test statico `referendumRealVote.smoke.test.js` richiede il lock e la rilettura transazionale.

## Limiti
La correzione copre **solo la scrittura delle previsioni referendum reali**. Altri endpoint che utilizzano il middleware di consenso senza rilettura transazionale possono avere una corsa analoga e richiedono audit separato. Restano prove manuali di logout/cache su Android, configurazione CDN effettiva, revisione dell'intera catena PR e validazione della DPIA da parte del DPO. Nessuna operazione su produzione o dati personali reali.
