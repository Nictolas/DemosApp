# DEMOS — fonti ufficiali referendum

## Produzione

Il database effettivamente usato dal backend Render è il progetto Supabase `Demos` (`wxnblcqoyjqxktwkcqok`), non il vecchio progetto Neon usato in precedenza per alcune verifiche.

La migrazione `20261017_referendum_ballots.sql` è stata applicata in produzione il 17 ottobre 2026.

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

## Regole DEMOS

- Referendum abrogativo: quorum di affluenza al 50%.
- Referendum confermativo costituzionale: nessun quorum di affluenza.
- Le preferenze DEMOS si bloccano all'apertura dei seggi.
- Un referendum già iniziato non viene esposto come nuova possibilità di voto DEMOS.
- Le vecchie preferenze di priorità tra referendum restano ritirate e separate dal nuovo modello.

## Da completare

- Arricchimento diretto da Ministero dell'Interno/Eligendo per orari ufficiali, affluenza e risultati.
- Gestione automatica di eventuali decreti successivi che riformulano il quesito già indetto.
- Statistiche territoriali e confronto finale previsione/risultato.
