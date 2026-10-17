# DEMOS — fonti ufficiali referendum

## Produzione

Il database effettivamente usato dal backend Render è il progetto Supabase `Demos` (`wxnblcqoyjqxktwkcqok`), non il vecchio progetto Neon usato in precedenza per alcune verifiche.

Le migrazioni `20261017_referendum_ballots.sql`, `20261017_civic_source_sync_state.sql` e `20261017_referendum_forecast_snapshots.sql` sono state applicate in produzione il 17 ottobre 2026.

## Gazzetta Ufficiale

Il backend acquisisce i decreti di indizione dalla Serie Generale della Gazzetta Ufficiale.

Flusso:
1. legge l'archivio annuale ufficiale;
2. considera solo i fascicoli dentro la finestra incrementale;
3. individua gli atti che riguardano referendum;
4. legge il testo completo tramite il permalink ufficiale;
5. estrae quesito, date dei comizi e tipo di referendum;
6. salva la fonte in `civic_process_source_records`;
7. proietta la consultazione in `civic_ballots`.

Il primo avvio usa una finestra di bootstrap limitata; i successivi usano un checkpoint persistente in `civic_source_sync_state` con sovrapposizione di sicurezza.

## Ministero dell'Interno / Eligendo

Dopo la chiusura dei seggi il backend interroga l'API pubblica che alimenta Eligendo per acquisire il risultato ufficiale.

Flusso:
1. seleziona soltanto consultazioni Gazzetta concluse di recente e senza risultato definitivo già acquisito;
2. deriva dalla data di apertura il codice data `YYYYMMDD` usato da Eligendo;
3. recupera una sola volta per data i dati nazionali Italia (`scrutiniFI`) e Estero (`scrutiniFE`);
4. associa il quesito solo se il mapping è univoco: codice esplicito, singolo quesito oppure corrispondenza testuale sufficientemente discriminante;
5. con più quesiti indistinguibili non usa l'ordine come scorciatoia e resta fail-closed;
6. considera definitivo il risultato soltanto quando tutte le sezioni Italia e Estero risultano pervenute;
7. calcola affluenza nazionale su tutti gli elettori e percentuali Sì/No sui voti validi;
8. salva il dato come fonte `it.interior.eligendo`, collegandolo allo stesso processo civico della Gazzetta;
9. la proiezione `civic_ballots` dà precedenza a Eligendo per affluenza e risultato ufficiale.

Endpoint di riferimento:
- `scrutiniFI/DE/{YYYYMMDD}/TE/09`
- `scrutiniFE/DE/{YYYYMMDD}/TE/09`

DEMOS non pubblica come "risultato ufficiale" conteggi parziali o privi della componente Estero.

## Statistiche DEMOS, geografia e storico

Le statistiche DEMOS restano separate dalle fonti istituzionali:
- la geografia Regione → Provincia → Comune descrive la previsione DEMOS in base alla residenza registrata degli utenti, non i risultati territoriali ufficiali Eligendo;
- ogni territorio deve avere almeno 10 risposte prima di essere restituito al client;
- lo storico usa `civic_ballot_forecast_snapshots`, che contiene solo conteggi aggregati e nessun `user_id`;
- prima dell'apertura dei seggi gli snapshot sono aggiornati nella finestra temporale corrente;
- al primo ciclo successivo all'apertura viene creato uno snapshot finale immutabile ancorato a `opens_at`;
- l'archivio confronta quella previsione finale DEMOS con affluenza, Sì e No ufficiali quando disponibili da Eligendo.

## Regole DEMOS

- Referendum abrogativo: quorum di affluenza al 50%.
- Referendum confermativo costituzionale: nessun quorum di affluenza.
- Le preferenze DEMOS si bloccano all'apertura dei seggi.
- Un referendum già iniziato non viene esposto come nuova possibilità di voto DEMOS.
- Le vecchie preferenze di priorità tra referendum restano ritirate e separate dal nuovo modello.

## Da completare

- Gestione automatica di eventuali decreti successivi che riformulano il quesito già indetto.
- Eventuale confronto territoriale anche con i risultati ufficiali Eligendo, mantenuto distinto dalla previsione DEMOS per residenza.
- Raffinamenti visuali dello storico quando saranno disponibili serie reali sufficientemente lunghe.
