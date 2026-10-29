# DEMOS — Voto Capo di Stato vs revoca del consenso politico (25/10/2026)

**Stato:** bozza su ramo concatenato dopo la PR #277; nessun merge né deploy.

## Problema confermato

Il POST `/api/capo-stato/vota` controllava il consenso nel middleware **prima** di iniziare la transazione. La lettura del voto corrente e il cooldown erano anch'essi eseguiti fuori dalla transazione: in una corsa con la revoca, una richiesta già avviata poteva creare una nuova preferenza anche **dopo** che la revoca aveva cancellato i voti. Gli errori 500 includevano il messaggio SQL (campo `details`) e i log riportavano identificativi utente, stack e dettagli SQL.

## Soluzione proposta

- `Cache-Control: private, no-store, max-age=0` impostato prima dell'autenticazione.
- Validazione del payload prima di qualsiasi interrogazione; limite di un candidato; candidatura non idonea respinta.
- Singola transazione sullo stesso client PostgreSQL: `BEGIN`, lock `SELECT id FROM users WHERE id = $1 FOR UPDATE`, verifica `getPoliticalConsentState(client, userId)` **dopo** il lock, lettura del voto e cooldown, sostituzione/rimozione, `recordPreferenceChange`, `COMMIT`.
- Ritorno `403 POLITICAL_CONSENT_REQUIRED` se il consenso risulta revocato; nessuna scrittura neppure se la scelta sembra invariata.
- `ROLLBACK` e rilascio del client in ogni percorso di errore, mantenendo `PREFERENCE_COOLDOWN` e il formato delle risposte precedenti.
- Identificatori consentiti `userid`, `userId`, `user_id`, sempre quotati; compatibilità ID voto UUID o testo.
- Eliminati log delle scelte, degli identificativi e dei dettagli tecnici; l'HTTP 500 restituisce solo un errore generico.

## Test

- Test di unità con pool e lock simulati: sequenza lock/consenso/voto, revoca, 404, no-op, rimozione, cooldown, rollback dopo INSERT fallito, tipo ID legacy, invalidazione e header `no-store`.
- Test end-to-end CI con **Express reale e PostgreSQL 17 locale**, sole identità sintetiche: ordine salvataggio-prima-revoca, revoca-prima-salvataggio, nuovo consenso esplicito. Il test rifiuta ogni configurazione diversa dal DB CI di localhost e simula un middleware di consenso già passato prima del cambio di stato.
- Suite privacy e compilazione già esistenti.

**Rischi residui:** la modifica non serializza le letture già in corso con la revoca; le cache Android/CDN vanno ancora verificate manualmente. Le PR concatenate non sono state revisionate come rilascio integrato. L'interlocutore ha dichiarato di essere il DPO e di approvare la DPIA: non è ancora collegata una specifica versione firmata/registrata della valutazione con tutte le variazioni delle PR. Nessuna modifica a dati reali, produzione o deploy.
