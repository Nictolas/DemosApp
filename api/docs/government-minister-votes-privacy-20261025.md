# DEMOS — preferenze sui ministri: atomicità, revoca e errori (25 ottobre 2026)

**Stato:** solo PR draft, concatenata alla #281, senza merge, deploy o accesso a produzione.

## Difetto verificato

In `POST /api/governo/vota` il middleware controllava il consenso Art. 9 prima che la richiesta ottenesse una transazione. La route eseguiva **per ogni ministero** il SELECT del voto attuale e il controllo cooldown tramite `pool.query` prima di `BEGIN`. Una revoca del consenso poteva completarsi fra il controllo iniziale e l'inserimento della preferenza. Inoltre due richieste contemporanee potevano lavorare su dati di partenza obsoleti. Un errore durante l'aggiornamento del secondo ministero richiede il rollback anche del primo.

## Modifica proposta

- `Cache-Control: private, no-store, max-age=0` è impostato prima dell'autenticazione, per successi e fallimenti.
- La richiesta deve contenere un oggetto `voti`. I ministeri sono una allowlist **statica**; i valori sono stringhe entro 250 caratteri o `null` per la rimozione. Campi non riconosciuti sono ignorati come in precedenza, senza interpolazione SQL.
- **Una sola connessione/transazione per tutti i ministeri**, con `BEGIN`, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, `getPoliticalConsentState(client,userId)` **dopo** l'acquisizione del lock, e solo poi lettura di ogni preferenza, cooldown, DELETE, eventuale INSERT e registrazione del cambio.
- Una revoca già conclusa restituisce `403 POLITICAL_CONSENT_REQUIRED` e rollback, anche se il middleware aveva prima visto il consenso attivo. Se il salvataggio precede la revoca, questa attende il lock e poi cancella tutte le preferenze del perimetro.
- Se una preferenza non cambia, non viene riscritta e non viene reimpostato il cooldown. Una richiesta interamente invariata esce senza commit. La modifica volontaria di una singola preferenza non tocca i ministeri assenti dal payload.
- Un fallimento nel secondo o successivo ministero esegue `ROLLBACK` **sulla connessione corretta** di tutti i ministeri, incluse le relative registrazioni cooldown; il client è rilasciato in `finally`.
- Gli errori HTTP e i log della route non includono dettagli SQL, ID, nomi delle scelte o stack.

## Verifiche

Test unitari sintetici sulla route reale: lock e consenso, revoca su batch non vuoto/vuoto, 404, no-op, cooldown, rimozione, validazione, allowlist, rollback se il secondo ministero fallisce, no-store ed erasure. Script di integrazione CI con **HTTP Express e PostgreSQL 17** in database effimero localhost e soli ID fittizi: ordine salvataggio→revoca; revoca→salvataggio; consenso attivo; **errore vincolo PostgreSQL nel secondo ministero con verifica di rollback anche nel primo**. Il guard dello script rifiuta connessioni/configurazioni di produzione.

## Limiti residui

La PR non modifica le letture Governo (`GET /voti`, `GET /ideale`, `GET /consenso`) che richiedono un controllo privacy separato, né le cache Android/CDN effettive. Sono necessarie una revisione integrata delle PR #264–#282 e verifiche manuali prima del rilascio. L'utente si è identificato come DPO e ha dichiarato l'approvazione della DPIA; il documento e la versione esatta vanno associati formalmente ai rischi residui delle correzioni ancora in bozza. Nessun accesso a dati personali reali o produzione.
