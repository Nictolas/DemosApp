# DEMOS — voto di fiducia al governo e revoca del consenso (25/10/2026)

**Stato:** proposta su nuova PR in bozza, concatenata alla #280. Nessun merge o deploy.

## Problema confermato

`POST /api/governo/consenso` controllava il consenso Art. 9 solo nel middleware, poi leggeva la preferenza esistente e il cooldown *prima* di aprire la transazione. Se una revoca si completava fra il controllo iniziale e l'INSERT, poteva risultare un nuovo voto politico dopo la revoca. Il gestore degli errori della transazione eseguiva `ROLLBACK` tramite `pool.query`, non attraverso il client transazionale, e non rilasciava esplicitamente il client DB: ciò poteva produrre salvataggi parziali e saturazione delle connessioni. I log includevano l'oggetto errore SQL.

## Correzione proposta

- `Cache-Control: private, no-store, max-age=0` prima dei middleware di autenticazione/consenso.
- Validazione di `risposta` fra `Sì`, `Non so`, `No` prima della connessione.
- Transazione con una sola connessione: `BEGIN` → lock `SELECT id FROM users WHERE id = $1 FOR UPDATE` → `getPoliticalConsentState(client, userId)` → lettura della preferenza → cooldown sullo stesso client → `DELETE`/`INSERT` → tracciamento cooldown → `COMMIT`.
- Se il consenso è già revocato quando viene acquisito il lock: `403 POLITICAL_CONSENT_REQUIRED`, senza scritture. Se il salvataggio precede la revoca, la cancellazione attende il lock e poi rimuove il voto.
- Percorsi `404` e `no-op` rilasciati con rollback sul client; `ROLLBACK` su errore e `release()` garantito via `finally`.
- In caso di errore: messaggio HTTP generico, nessun ID, scelta personale, SQL, stack o dati grezzi in log.
- Mantiene il campo `data` della risposta, la stringa ID legacy e il vincolo delle 24 ore.

## Verifiche

Test unitari sintetici: sequenza lock/consenso, 403, no-op, 404, cooldown, errore insert/commit con rollback, validazione e leak. Test di concorrenza reale HTTP Express+PostgreSQL 17 **solo in ambiente sintetico locale CI**: salvataggio prima della revoca, revoca prima del salvataggio, consenso nuovamente attivo. Controllo guard su variabili ambiente per rifiutare produzione.

**Rischi residui:** non sono corrette in questa PR le altre route governo (`/vota`, `/voti`, `/ideale`) né cache Android/CDN effettive. Prima di rilascio servono verifiche integrate della catena di PR, prove manuali e versionamento dei documenti DPIA. Il DPO ha dichiarato in chat di aver approvato la DPIA; l'esatta versione approvata non è attestata qui con documento firmato. Non si impiegano dati reali né si modifica la produzione.
