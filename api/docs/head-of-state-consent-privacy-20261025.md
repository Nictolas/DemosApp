# DEMOS — Consenso Capo di Stato: lettura, scrittura e revoca (25/10/2026)

**Stato:** proposta su PR draft concatenata alla #274; non integrata e non distribuita.

## Problemi verificati nel codice precedente

- `POST /api/capo-stato/consenso` controllava il consenso soltanto nel middleware, prima della transazione: la revoca poteva concludersi prima di una successiva INSERT.
- La verifica della preferenza già salvata e il controllo cooldown erano esterni alla transazione, con rischio di letture obsolete.
- Il rollback del POST veniva inviato a `pool.query('ROLLBACK')`, non al client che aveva aperto la transazione; mancava inoltre il rilascio esplicito del client.
- `GET /api/capo-stato/consenso` leggeva preferenze e aggregati senza filtrare il consenso Art. 9 nella stessa SELECT, e il debug registrava intestazioni HTTP e token decodificati.

## Modifica proposta

- GET e POST inviano `Cache-Control: private, no-store, max-age=0` prima dell'autenticazione; la cache CDN esclude esplicitamente il percorso.
- Le SELECT del GET applicano il consenso attivo direttamente ai dati personali e agli aggregati, escludendo righe residue di utenti revocati. Rimangono pubblici i totali autorizzati.
- Il POST acquisisce `FOR UPDATE` sulla riga `users` e **poi** rilegge il consenso sul medesimo client. Solo dopo legge la preferenza, controlla il cooldown, sostituisce il voto e registra il cambiamento; `COMMIT`/rollback e rilascio avvengono sullo stesso client.
- Rimossi i log del GET/POST che stampavano headers, JWT decodificati o body politico.

## Test e limiti

`api/tests/headOfStateConsentPrivacy.smoke.test.js` include 10 test sintetici: sequenza lock/consenso/scrittura, consenso revocato e override, assenza utente, scelta invariata, errore INSERT/rollback, 401 no-store, lettura e aggregati filtrati, GET anonimo/token non valido, policy CDN e tabella cancellata dalla revoca. Il workflow privacy esegue questi test insieme alle regressioni esistenti e ai controlli PostgreSQL 17 già presenti.

**Limiti:** i 10 test nuovi usano un client DB sintetico e verificano SQL/ordine, non costituiscono una prova concorrente PostgreSQL reale specifica per Capo di Stato. Non verificano configurazioni CDN effettive, cache persistenti Android o logout. Non effettuati accessi a dati personali reali, merge o deploy. DPIA da validare con il DPO.
