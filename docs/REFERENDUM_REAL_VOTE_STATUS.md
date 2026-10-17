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
- Database di produzione identificato e verificato: Supabase `Demos` (`wxnblcqoyjqxktwkcqok`), distinto dal vecchio Neon non più allineato alla produzione.

## In integrazione

- Adapter Ministero dell'Interno / Eligendo per risultato nazionale definitivo Italia + Estero.
- Associazione fail-closed dei quesiti multipli: DEMOS non usa l'ordine della scheda quando il mapping non è verificabile.
- Proiezione di affluenza, Sì e No ufficiali dentro `civic_ballots` solo a scrutinio completo.

## Restano da completare

- Gestione automatica di eventuali decreti successivi che riformulano il quesito già indetto.
- Statistiche geografiche Regione → Provincia → Comune.
- Snapshot/trend temporale aggregato.
- UI dedicata al confronto previsione finale DEMOS / risultato ufficiale, oltre ai campi dati già predisposti.

Se non esiste una convocazione ufficiale futura, l'endpoint di availability restituisce `available: false` e la UI resta fail-closed senza pulsante Referendum. Questo comportamento è intenzionale.
