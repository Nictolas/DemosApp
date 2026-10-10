# DEMOS — Architettura globale dei processi civici

## Decisione di prodotto — 9 ottobre 2026

DEMOS deve essere una sola piattaforma globale con un core condiviso. Italia, Francia, Stati Uniti e le altre giurisdizioni non devono diventare applicazioni o codebase indipendenti salvo vincoli esterni di compliance, distribuzione o infrastruttura.

L'Italia è il primo adapter nazionale, non il modello universale da hardcodare nel core.

## Principi

1. Il core DEMOS gestisce identità, Opinioni, matching, profili politici, notifiche, statistiche, preferenze e relazioni tra utenti e rappresentanti.
2. Le regole istituzionali appartengono a una giurisdizione e a un tipo di processo civico.
3. Un processo civico può avere fasi, soglie, autorità, fonti ufficiali e azioni DEMOS differenti da Paese a Paese.
4. Le fonti esterne sono adapter: Ministero italiano, Camera, Senato, Commissione UE, Congress.gov o altre fonti future non devono definire il dominio centrale.
5. Lo stesso processo può essere osservato da più fonti ufficiali e deve essere riconciliato in un unico record canonico.
6. Deployment separati restano possibili quando richiesti da legge o infrastruttura, ma devono riusare il core quanto più possibile.

## Modello obiettivo

Entità concettuali da introdurre progressivamente, senza migrazione big-bang:

- `jurisdiction`: Paese, unione sovranazionale, regione, stato federato, comune o altro livello.
- `civic_process_type`: definizione del meccanismo istituzionale nella giurisdizione.
- `civic_process`: singola iniziativa, referendum, ballot initiative, recall o processo equivalente.
- `civic_process_stage`: fase corrente e storico delle transizioni.
- `civic_process_source`: una o più fonti istituzionali che attestano lo stesso processo.
- `civic_process_rule`: soglie e regole specifiche della giurisdizione.
- `demos_action_policy`: quali azioni DEMOS hanno senso in quella fase (firma esterna, priorità, posizione sul quesito, sola informazione, ecc.).

## Adapter Italia — stato desiderato

### Iniziative popolari

- Raccolta firme: fonte Ministero della Giustizia quando disponibile.
- Iter parlamentare: fonti ufficiali Camera/Senato.
- Le iniziative entrate nell'iter devono comparire anche se assenti dal portale firme del Ministero.
- Ministero, Camera e Senato sono fonti dello stesso processo, non tre archivi utente separati.
- La priorità DEMOS ha senso per le iniziative ufficialmente nell'iter parlamentare.
- Il solo contatore grezzo delle firme non sostituisce la verifica istituzionale dell'ingresso nell'iter.

### Referendum

- Raccolta firme e stato istituzionale sono informazioni ufficiali da sincronizzare.
- Non esiste una classifica DEMOS di referendum “preferiti” o “da trattare prima”.
- Un eventuale futuro SÌ/NO o posizione sul quesito è una funzione distinta dalla priorità e richiede un proprio modello.

## Strategia di migrazione

1. Ritirare le semantiche italiane chiaramente errate senza aspettare il nuovo modello globale.
2. Introdurre identificatori di giurisdizione e adapter dietro le API esistenti.
3. Creare il modello canonico dei processi civici in modo additivo.
4. Migrare l'Italia al nuovo modello mantenendo compatibilità temporanea con le route attuali.
5. Aggiungere nuovi Paesi solo tramite configurazione/adapters, evitando fork dell'app.

## Ordine di priorità iniziale

1. Rimuovere la priorità tra Referendum italiani.
2. Definire il contratto canonico `jurisdiction + civic_process + source + stage`.
3. Integrare Camera/Senato per le Iniziative italiane e deduplicare con Ministero.
4. Migrare progressivamente le route italiane al modello canonico.
5. Preparare il primo secondo adapter nazionale solo dopo aver validato il modello con l'Italia.

## Stato implementazione IMP-028 — 9 ottobre 2026

Prima fondazione implementata localmente:

- registro unico delle giurisdizioni e dei tipi di processo civico in `api/config/civicProcesses.js`;
- adapter/fonte identificati separatamente dal processo (`Ministero`, `Camera`, `Senato`);
- servizio di risoluzione `jurisdiction + source + raw type -> civic process type + stage + rules + DEMOS policy`;
- soglie firme italiane centralizzate nel registro, non più possedute da sync, mapper o componenti UI;
- payload legacy Ministero arricchiti in modo additivo con `jurisdiction_id`, `civic_process_type_id`, `civic_process_stage`, `civic_process_source_id`, `signature_threshold` e `demos_actions`;
- policy fail-closed per combinazioni non conosciute;
- priorità referendum sempre disabilitata;
- priorità iniziative consentita dal contratto solo nello stage `parliamentary_review`;
- vecchio flusso `?vota=true` delle iniziative e relativo POST sono temporaneamente fail-closed finché Camera/Senato non attestano ufficialmente l'ingresso nell'iter;
- la cancellazione di una vecchia preferenza iniziativa resta disponibile per permettere la pulizia dello stato legacy.

Questa fase non introduce ancora una nuova tabella canonica `civic_process`: evita una migrazione big-bang e crea prima il contratto applicativo. La persistenza canonica multi-fonte e la riconciliazione Ministero/Camera/Senato appartengono a IMP-029.


## Stato implementazione IMP-029 — 10 ottobre 2026

La persistenza canonica multi-fonte italiana è implementata localmente senza migrazione automatica del database reale:

- `civic_processes` rappresenta il processo canonico indipendentemente dalla fonte;
- `civic_process_source_records` conserva Ministero, Camera e Senato come attestazioni separate dello stesso processo;
- `civic_process_identifiers` permette la riconciliazione automatica soltanto tramite identificatori istituzionali forti condivisi;
- l'uguaglianza del titolo non provoca mai un merge automatico: genera un candidato in `civic_process_reconciliation_candidates`;
- gli stage canonici avanzano in modo monotono secondo il registry e uno stato parlamentare terminale non può essere degradato da una fonte in una fase precedente;
- la priorità DEMOS delle iniziative usa il processo canonico ed è abilitata soltanto con evidenza Camera/Senato nello stage `parliamentary_review`;
- il sync Ministero/Camera/Senato resta opt-in tramite `ENABLE_CIVIC_PROCESS_SYNC=true` e isola gli errori delle singole fonti senza inventare fallback;
- è disponibile una coda amministrativa protetta da autenticazione + ruolo Admin (`/api/admin/civic-process-reconciliation`) per elencare i candidati pendenti e accettare o rifiutare esplicitamente la riconciliazione;
- l'accettazione fonde l'intero processo sorgente nel processo canonico scelto, inclusi identificatori e source records, dentro una transazione; il rifiuto registra revisore e data senza modificare i processi;
- una riconciliazione già revisionata fallisce chiusa e non può essere applicata due volte.

Gate locale IMP-029: 48 test mirati PASS / 0 FAIL. Nessun push, deploy, GitHub Actions o modifica al database reale eseguiti durante il gate.

## Realizzazione normativa verificata dallo Staff

Lo stage parlamentare e la realizzazione sostanziale sono concetti distinti. Una iniziativa popolare resta eleggibile alla priorità DEMOS dopo la chiusura della raccolta e il raggiungimento della soglia anche se l'iter parlamentare parte, si interrompe, decade o viene respinto. Esce dalla classifica solo quando lo Staff/Admin DEMOS verifica manualmente che il suo obiettivo sia stato effettivamente realizzato da una legge. Il modello conserva un flag `realized`, il riferimento alla legge e data/autore della verifica; non esiste classificazione automatica o parziale.
