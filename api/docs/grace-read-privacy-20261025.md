# DEMOS — Privacy endpoint Grazia (25 ottobre 2026)

**Stato:** correzione proposta sulla PR draft successiva alla #275. Non integrata, non distribuita. Test soltanto sintetici.

## Problemi confermati nel codice

- Il GET anonimo `/api/grazia` eseguiva `SELECT * FROM voti_grazia` e pubblicava in `richieste` tutte le righe individuali, comprese eventuali colonne identificative e date. La UI Grazia attuale utilizza soltanto `classifica`, `mieiVoti` e `blocco`.
- La classifica includeva righe residue di utenti privi di consenso Art. 9; lo stesso valeva per la lettura del voto proprio.
- La query React Query era condivisa fra account (`['graziaData']`), senza cancellazione specifica dopo revoca.

## Mitigazioni

- Il GET risponde con i soli aggregati della classifica, l'eventuale scelta del richiedente autorizzato e il cooldown relativo. `richieste: []` conserva la forma della risposta ai vecchi client, senza record grezzi.
- I filtri sul consenso si trovano **nelle stesse SELECT** che leggono preferenze personali e voti conteggiati. Supportate le colonne legacy `userid`, `user_id` e `userId` mediante allowlist.
- Impostato `Cache-Control: private, no-store, max-age=0` **prima** dell'elaborazione del token, incluso l'errore. Esclusione esplicita del percorso dalla policy CDN.
- Query key distinta per account, cancellazione HTTP mediante `AbortSignal` e pulizia della cache `graziaData` dopo revoca. Eliminati i debug client che stampavano la risposta o le scelte.
- Nessun cambiamento al GET `/api/grazia/richieste` riservato agli Admin né alla logica di voto.

## Test e rischi residui

Test unitari con router reale estratto dal sorgente e pool sintetico: anonimato, autorizzazione, revoca, campi legacy, errore fail-closed e policy CDN. Test client: cache per account, `AbortSignal`, assenza log personali, pulizia dopo revoca. Script PostgreSQL 17 esegue le SELECT reali contro **sole tabelle TEMP sintetiche**, in transazione poi rollback, con guard restrittiva locale e senza connessioni a dati reali. La CI verifica inoltre build e regressioni già presenti.

**Limiti:** le SELECT non serializzano le letture già iniziate con una revoca concorrente. Restano da valutare con DPO soglie di inferenza degli aggregati molto piccoli e prove fisiche Android/CDN. L'approvazione comunicata dal titolare del progetto non equivale alla validazione della DPIA da parte del DPO. Nessun merge, deploy o modifica di dati reali.
