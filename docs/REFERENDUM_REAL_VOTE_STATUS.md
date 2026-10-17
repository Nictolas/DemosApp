# Stato implementazione — Referendum reali DEMOS

Data: 17/10/2026

## Implementato nel branch `feat/real-referendum-vote-v0`

- UI `/vota-referendum` con scelte Sì / No / Non voterei.
- Pulsante Referendum dinamico nella sezione Vota.
- Layout simmetrico quando non ci sono referendum: Iniziativa Popolare occupa l'intera ultima riga.
- Modello dati `civic_ballots` + `civic_ballot_positions`.
- Cooldown 24h per modifica della scelta.
- Freeze della previsione all'apertura ufficiale dei seggi.
- Statistiche nazionali con affluenza prevista, Sì/No e astensione dichiarata.
- Soglia privacy minima di 10 risposte per mostrare gli aggregati.
- Quorum configurabile per singola scheda, non hardcoded nel frontend.
- Cancellazione delle posizioni alla revoca del consenso politico.
- Contratto di sincronizzazione automatica da fonti civiche ufficiali.

## Ancora da completare prima dell'attivazione reale

- Adapter di acquisizione diretto per una fonte ufficiale delle convocazioni (Gazzetta Ufficiale) e per i risultati (Ministero dell'Interno / Eligendo).
- Applicazione della migrazione `20261017_referendum_ballots.sql` al database di produzione dopo conferma del database effettivamente collegato a Render.
- Statistiche geografiche Regione → Provincia → Comune.
- Snapshot/trend temporale aggregato.
- Confronto automatico previsione finale / risultato reale dopo disponibilità del feed ufficiale risultati.

Finché la migrazione o una convocazione ufficiale attiva non sono disponibili, l'endpoint di availability restituisce `available: false` e la UI resta fail-closed senza pulsante Referendum.
