# DEMOS — Preferenze Grazia e revoca del consenso (25 ottobre 2026)

**Stato:** correzione proposta su PR **draft** concatenata alla #278, senza merge né deploy.

## Lacuna verificata

Il precedente POST `/api/grazia/vota` aveva un guard preliminare per il consenso politico, ma recuperava voto già presente e cooldown con `pool.query` **prima** della transazione e senza lock dell'utente. Se la revoca cancellava i voti dopo la verifica iniziale, una richiesta in volo poteva ancora inserire un nuovo voto. Log e 500 potevano contenere identificativi, dettagli DB ed error stack.

## Correzione

- Middleware `Cache-Control: private, no-store, max-age=0` prima di autenticazione, controllo identità e consenso, anche sui percorsi d'errore.
- Input validato prima della transazione: array di zero o un nominativo stringa non vuoto; il nome viene normalizzato con `trim()`.
- Una sola connessione e transazione PostgreSQL per `BEGIN`, `SELECT id FROM users WHERE id=$1 FOR UPDATE`, `getPoliticalConsentState(client, userId)`, introspezione schema, lettura scelta/cooldown, `DELETE`, eventuale `INSERT`, registrazione cambio preferenza e `COMMIT`.
- Se la revoca ha precedenza sul blocco, il salvataggio termina con 403, `POLITICAL_CONSENT_REQUIRED`, rollback e nessun nuovo voto. Se il salvataggio precede la revoca, la revoca elimina la preferenza, conservando l'atomicità.
- Compatibilità con colonne `userid`, `user_id`, `userId`; timestamp `timestamp`, `data_voto`, `created_at`; ID voto UUID o testo. I nomi di colonna sono soltanto valori hardcoded da allowlist, quotati prima dell'interpolazione.
- In caso di errore: rollback e rilascio client; nessun dettaglio SQL, stack, nome della scelta o identificativo personale esposto nei log operativi/HTTP.

## Test e limitazioni

Test unitari sintetici: lock e consenso, revoca, mancanza utente, invariato, rimozione, errori inserimento/schema, cooldown, nomi colonne legacy, input e autenticazione. Test concorrente CI con Express reale e PostgreSQL 17 in ambiente **locale sintetico**: salvataggio → revoca; revoca → salvataggio; consenso attivo. Il test rifiuta variabili di produzione e utilizza un ID fittizio dedicato.

Non sono coperti da questa correzione le letture già iniziate prima della revoca e i rischi di inferenza da piccoli aggregati; necessarie prove manuali Android/CDN. Approvazione DPIA dichiarata dall'interlocutore in qualità di DPO; associare formalmente la versione esatta e le valutazioni dei rischi di queste PR prima di un rilascio. Nessuna scrittura di dati personali reali, merge o deploy.
