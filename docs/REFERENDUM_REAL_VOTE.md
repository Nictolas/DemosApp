# DEMOS — Referendum reali: Sì / No / Non voterei

Stato: specifica di prodotto approvata il 17/10/2026.

Questa funzione è distinta sia dalla raccolta firme (`/referendum-abrogativi`) sia dalla vecchia e ritirata classifica di priorità tra referendum (`/vota-referendum-abrogativo`).

## Semantica

- La superficie di voto è `/vota-referendum`.
- Compare nella sezione **Vota** solo quando esiste almeno un referendum ufficialmente convocato e ancora aperto alla raccolta delle intenzioni DEMOS.
- Ogni quesito ha una scelta corrente indipendente: `YES`, `NO`, `ABSTAIN` (`Non voterei`).
- La prima scelta è immediata; un cambio successivo usa il cooldown canonico di 24 ore.
- All'apertura ufficiale dei seggi le scelte DEMOS vengono congelate e la superficie diventa read-only.
- I risultati mostrano separatamente affluenza prevista e rapporto Sì/No tra chi dichiara che voterebbe.
- I risultati segmentati rispettano la soglia privacy DEMOS; gruppi con meno di 10 risposte valide non vengono mostrati.
- Dopo il voto reale, quando disponibile da fonte ufficiale, DEMOS può confrontare previsione finale e risultato istituzionale.

## Fonti

Nessun referendum viene creato dagli utenti. La convocazione, il quesito, le date dei seggi e i risultati devono provenire da fonti istituzionali configurate e verificabili. Il core resta jurisdiction-neutral: tipo di referendum, quorum e regole del quesito non sono hardcoded nel frontend.

## UX quando non ci sono referendum attivi

Il pulsante **Referendum** non viene mostrato. Per mantenere simmetrica la sezione **Vota**, il pulsante **Iniziativa Popolare** occupa l'intera ultima riga. Quando compare Referendum, i due pulsanti tornano ad occupare una colonna ciascuno.
