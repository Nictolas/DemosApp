# DEMOS — GH-296: evidenza del gap di durabilità esterna (29 ottobre 2026)

**Stato: P0 APERTO / recovery NO-GO / sola PR Draft #374.** Questo documento non costituisce approvazione a deploy, migrazioni, B2, restauri, modifiche infrastrutturali o periodi di conservazione.

## Percorso verificato nel codice

- La route canonica `api/routes/user/delete-account.js` conferma la cancellazione dopo `BEGIN → recordEvent(ACCOUNT_DELETED) → enforceAccountDeletion → COMMIT`. L'HTTP di successo non attende una ricevuta B2.
- `PrivacyErasureLedgerService.recordEvent` scrive il solo ledger con `GDPR_ERASURE_OUTBOX_ENABLED` assente/`false` (default), oppure ledger + outbox nella **stessa transazione PostgreSQL** quando il flag è `true`.
- `PrivacyErasureOutboxWorker.runOnce` è un consumer **manuale** e separato: seleziona record pendenti, archivia ogni evento su B2, verifica versione/hash/Object Lock e poi marca la consegna nel DB. Non parte automaticamente.
- Ledger e outbox risiedono nello stesso PostgreSQL. Un evento già confermato, ma ancora pendente nella outbox, può quindi essere perso insieme al database in un guasto totale non recuperabile da WAL/backup aggiornati. Questo è un **gap di garanzia architetturale**, NON prova di perdita avvenuta in produzione.
- Un ripristino da snapshot precedente può esibire ledger/outbox vuoti e `status.ready=true` (= sola coda locale drenata). Per impedire una falsa affermazione di recuperabilità, `status.recoveryReady` è ora **sempre false**: finché non esiste una prova esterna indipendente, la coda locale non abilita mai il recovery.
- `gdprExternalEvidenceVerifier.verifyOffline` attesta integrità/autenticità del bundle offline ma restituisce `externalLedgerCompletenessAttested:false`. Una firma corretta da sola non prova che siano stati acquisiti tutti gli eventi confermati.

## Contratto indispensabile per una vera garanzia

1. **Semantica della risposta:** distinguere richiesta acquisita, operazione applicata nel DB e operazione esternamente durevole. Non mostrare una garanzia di recuperabilità o "completato con protezione del ripristino" in assenza di prova indipendente.
2. **Nessuna finestra di perdita dopo una conferma:** per ogni cancellazione/revoca che il servizio dichiara definitivamente completata occorre una prova esterna durevole e verificabile collegata all'identificativo univoco dell'operazione, ottenuta **prima di quella conferma**. L'outbox asincrona attuale non soddisfa il requisito.
3. **Gestire il dual-write:** PostgreSQL e B2 non condividono una transazione ACID. Una proposta è registrare **prima** un'intenzione firmata e immutabile nel journal esterno, poi applicare la transazione PostgreSQL, confermando l'esito soltanto dopo COMMIT e verifica della ricevuta B2. Se il processo fallisce fra i passaggi, l'intenzione resta *in sospeso*, NON può essere trattata automaticamente come prova di commit. Serve una semantica idempotente e approvata per completararla/riconciliarla durante il ripristino. Le revoche, le cancellazioni e le concessioni di consenso hanno regole di replay diverse.
4. **Ordine e freschezza verificabili:** il journal deve impedire lacune non rilevate, attestare un checkpoint/high-watermark indipendente, coprire operazioni concorrenti e preservare l'ordine effettivo delle revoche e delle successive concessioni. Clock e timestamp da soli non bastano per una prova di completezza.
5. **Barriera di ripristino indipendente:** isolare tutti i writer/reader/worker/HTTP e i provider, quindi importare e riconciliare l'intero journal nel DB ripristinato **prima** di aprire il traffico. Prove mancanti, parziali o obsolete devono lasciare il sistema in NO-GO, senza fallback.
6. **Ritenzione e minimizzazione:** schema, identificativi, durata legale e gestione chiavi del journal devono essere approvati nel gate RP-10/F5-17 con revisione privacy/DPIA. Non riutilizzare il bucket dei log Axiom come prova GDPR, né abilitare Object Lock prima della decisione.

La strategia di intenzione esterna è una **proposta da validare**, non un fix già implementato. Non è corretto limitarsi ad aggiungere un PUT B2 dopo il COMMIT: se il PUT fallisce, la cancellazione potrebbe essere già applicata senza prova recuperabile. Né un PUT prima del COMMIT può essere riprodotto ciecamente: potrebbe rappresentare un'operazione che nel DB non è stata confermata.

## Prove sintetiche obbligatorie prima di proporre GO

- Simulare snapshot `S0`, evento cancellazione `E1` confermato dopo `S0`, perdita del database e ripristino `S0`. Un journal esterno senza `E1` deve produrre **NO-GO**; nessuna coda locale vuota deve passare.
- B2 non raggiungibile o ricevuta errata **prima** della conferma: nessun messaggio di esito durevole positivo.
- Crash fra journal esterno, COMMIT PostgreSQL e riconciliazione: intenzione pendente isolata, nessuna perdita silenziosa o replay non autorizzato.
- Revoca seguita da concessione, richieste parallele, retry idempotenti, ripristino ripetuto: nessuna concessione erroneamente annullata, nessun dato cancellato che ricompaia nel traffico.
- Checkpoint mancante, vecchio, firmato ma incompleto; versione B2 mancante o scaduta; RLS visibilità parziale; worker bloccato: **NO-GO**.
- Solo dopo simulazioni positive: attestare writer SQL Render, B2 indipendente, isolamento provider e restore effettivo in ambiente autorizzato.

## Modifiche circoscritte già applicate nella Draft #374

- `PrivacyErasureOutboxWorker.status`: aggiunto `recoveryReady:false` in ogni ramo di uscita (coda assente, RLS parziale, coda locale apparentemente pronta). **`ready` conserva temporaneamente il significato legacy di stato SQL locale**, non si usa mai come recovery GO.
- `api/tests/gdprOutboxWorkerIsolated.pg17.test.js`: verifica che un ledger/outbox sintetico vuoto risulti eventualmente pronto **solo localmente**, non per il ripristino; stessa aspettativa dopo consegna al FakeB2.
- Nessuna interazione con provider reali, backup, restore, SQL live o informazioni degli utenti.

**Esito fase A:** gap identificato e falsa interpretazione della readiness resa esplicita nel contratto. **NON chiuso** il gap di durabilità, nessuna prova E2E esterna. Prossimo lavoro: disegnare e testare in CI isolata la macchina a stati del journal esterno e la barriera di ammissione recovery, senza collegare provider reali, e sottoporre il protocollo a revisione prima di qualsiasi integrazione.

## Fase B — prototipo e verifiche riproducibili (29 ottobre 2026)

**Solo codice di test, NON integrato nelle API o nei provider.**
- api/tests/fixtures/gdprDurableRecoveryPrototype.js: journal fittizio append-only con hash-chain, testimone HMAC esterno simulato, preparazione/commit, idempotenza, blocco intenzioni ambigue e sigillo del registro.
- api/tests/gdprDurableRecoveryProtocolSynthetic.test.js: 14 test con dati inventati (guasti, registro troncato/manomesso, testimone mancante o falsificato, retry, revoca e successiva concessione).
- api/tests/gdprDurableRecoveryPg17Synthetic.test.js: 3 test PostgreSQL 17 con transazioni SQL vere ma SOLO su database temporaneo locale di GitHub Actions e schema dedicato. Il vecchio snapshot viene simulato ricreando le righe: non è un vero pg_restore/PITR.
- Suite integrata nel workflow esistente gdpr-b2-worker-retry-isolated-ci.yml: [run 40915481806](https://github.com/Nictolas/DemosApp/actions/runs/40915481806) SUCCESS, 14/14 test JS e 3/3 test PG17, zero errori e zero skip.

**Contratto modellato:** l'intenzione va attestata esternamente prima di cambiare PostgreSQL; la conferma durevole richiede COMMIT SQL e successivo testimone esterno del commit. Un guasto fra i due rende incerto il risultato e blocca il ripristino: non si deduce un commit da una semplice intenzione. Prima di riprodurre eventi si richiedono tutti i writer fermati, ingress bloccato, provider isolati, testimone corrente, catena continua, journal sigillato e zero intenzioni ambigue. Il replay usa soltanto commit verificati, con ordine e idempotenza. Le attestazioni infrastrutturali sono qui soltanto flag simulati.

**Limiti fondamentali:** l'HMAC in memoria NON è prova B2/Object Lock, completezza o freschezza; il modello serializza globalmente le intenzioni e NON è pronto alla concorrenza/scalabilità; non include autentificazione/API/RLS reale né tutte le tabelle dati di DEMOS. Nessuna prova su provider reale o backup autentico. Lo stato restituito è sempre productionRecoveryReady=false, anche dopo test positivi. Non cambiare il recoveryReady=false del worker Draft in base a questo prototipo. Prima di integrare nel runtime sono necessari design di concorrenza e ordering, enforcement di un unico writer, durabilità realmente indipendente, trattamento delle intenzioni ambigue, verifica di tutti i restore/writer, RP-10/DPIA e approvazioni separate.

**Risultato: Fase B sintetica superata. Issue GH-296 ancora APERTA / NO-GO.**

## Fase C — concorrenza per soggetto e intenzioni ambigue (29 ottobre 2026)

**Ancora SOLO fixture e test; nessuna route DEMOS modifica il proprio comportamento.**

- `api/tests/fixtures/gdprDurableRecoveryPrototype.js`: operazioni con ID e payload canonici; intenzioni pendenti bloccano soltanto lo stesso soggetto, consentendo altri utenti in parallelo. Journal, hash-chain e testimone di sequenza restano globali. Il recupero globale continua a fallire se anche una sola intenzione è irrisolta.
- Le prove di commit sintetiche ora conservano *ID + hash del payload*, non soltanto un ID; una chiave riciclata su soggetto/azione diversi è respinta. L'ordine delle revoche e successive concessioni viene ricostruito in base agli eventi `commit` testimoniati, non all'orologio del dispositivo.
- Un operatore **simulato** può finalizzare un'intenzione interrotta soltanto con tutte queste precondizioni: database **originale** ancora disponibile e attestato, tutti i writer fermati, testimone indipendente aggiornato e marker SQL originario corrispondente a ID e payload. Uno snapshot ripristinato, un marker errato o una semplice intenzione non bastano. In assenza di questi elementi: NO-GO.
- `api/tests/gdprRecoveryConcurrencySynthetic.test.js`: 12 test di interleaving, blocco per soggetto, retry, confronto del payload e negazione di falsa conferma. `api/tests/gdprDurableRecoveryPg17Synthetic.test.js`: ora 5 test PG17, due dei quali con due transazioni contemporanee su utenti distinti e finalizzazione simulata basata su lettura della riga SQL nel database di test.
- **CI verificata** sul commit `9b4964d5b4cd2beeff3779dbdd5653b25470d5c4`: [worker PG17 e modello](https://github.com/Nictolas/DemosApp/actions/runs/40916575273) SUCCESS (12/12 nuovi test concorrenza, 5/5 PG17; la precedente suite 14/14 resta superata); tutti i 5 workflow della PR #374 SUCCESS.

**Confini e rischi ancora aperti prima di qualunque integrazione:**

1. Il blocco per soggetto è **solo logica in memoria**: deve diventare un vero fencing distribuito, con lease/epoch non riutilizzabili e verifica lato database per impedire writer concorrenti non cooperativi. Le prove SQL non attestano questo fencing.
2. `originalPrimaryVerified`, `writersFenced`, `ingressBlocked` e `providersQuarantined` sono booleani di test, **non certificazioni ottenute dalla piattaforma**. Nessun operatore può trasformarli in `true` su un sistema reale senza attestazione esterna specifica.
3. Il testimone HMAC risiede in memoria e simula durabilità/indipendenza; manca ancora la specifica concreta di checkpoint immutabili, periodo di conservazione, clock/ordine e prevenzione di ritardi o perdite dell'ultima ricevuta. Il commit tra PostgreSQL e B2 continua a non essere atomico.
4. La finalizzazione di un'operazione interrotta con database originale mancante **non è risolta**: blocco e intervento di incident response, mai completamento dedotto da snapshot vecchio.
5. La matrice completa delle tabelle e dei processi che possono riscrivere consensi/account, la compatibilità con i permessi RLS e la DPIA/retention RP-10 restano gate non approvati.

**Risultato:** controllo concorrenza e procedura di riconciliazione modellati e testati; protocollo reale ancora non sviluppato/attestato. **GH-296 OPEN / recovery NO-GO.**
