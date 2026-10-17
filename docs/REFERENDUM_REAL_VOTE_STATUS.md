# Stato implementazione — Referendum reali DEMOS

Data: 17/10/2026

## Implementato e LIVE

- UI `/vota-referendum` con scelte Sì / No / Non voterei.
- Pulsante Referendum dinamico nella sezione Vota.
- Layout simmetrico quando non ci sono referendum: Iniziativa Popolare occupa l'intera ultima riga.
- Modello dati `civic_ballots` + `civic_ballot_positions` applicato al DB Supabase di produzione.
- Cooldown 24h per modifica della scelta.
- Freeze della previsione all'apertura ufficiale dei seggi.
- Statistiche nazionali con affluenza prevista, Sì/No e astensione dichiarata.
- Soglia privacy minima di 10 risposte per mostrare gli aggregati.
- Quorum configurabile per singola scheda, non hardcoded nel frontend.
- Cancellazione delle posizioni alla revoca del consenso politico.
- Adapter diretto Gazzetta Ufficiale per convocazione, quesito e date dei seggi, con sincronizzazione incrementale e checkpoint persistente.
- Adapter Ministero dell'Interno / Eligendo per risultato nazionale definitivo Italia + Estero.
- Associazione fail-closed dei quesiti multipli: DEMOS non usa l'ordine della scheda quando il mapping non è verificabile.
- Proiezione di affluenza, Sì e No ufficiali dentro `civic_ballots` solo a scrutinio completo.
- Database di produzione identificato e verificato: Supabase `Demos` (`wxnblcqoyjqxktwkcqok`), distinto dal vecchio Neon non più allineato alla produzione.

## In validazione per il rollout successivo

- Statistiche geografiche della previsione DEMOS Regione → Provincia → Comune basate sulla residenza registrata.
- Soglia privacy applicata separatamente a ogni territorio: nessun gruppo con meno di 10 risposte viene restituito al client.
- Snapshot temporali esclusivamente aggregati, senza `user_id`, per conservare l'andamento della previsione.
- Archivio delle consultazioni già iniziate con previsione finale DEMOS congelata.
- Confronto nella UI tra previsione finale DEMOS e risultato ufficiale acquisito da Eligendo.

## Restano da completare dopo questo rollout

- Gestione automatica di eventuali decreti successivi che riformulano il quesito già indetto.
- Eventuale confronto geografico anche con i risultati istituzionali territoriali Eligendo, distinto dalle statistiche DEMOS per residenza.
- Raffinamenti visuali del trend, se utili dopo dati reali sufficienti.

Se non esiste una convocazione ufficiale futura, l'endpoint di availability restituisce `available: false` e la UI resta fail-closed senza pulsante Referendum. Questo comportamento è intenzionale.
