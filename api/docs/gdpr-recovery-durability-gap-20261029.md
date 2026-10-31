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

## Fase D — dimostrazione SQL del blocco transazionale (29 ottobre 2026)

**Solo PostgreSQL 17 USA-E-GETTA in GitHub Actions; non è una migrazione, non è importato dal runtime.**

- Nuovo test `api/tests/gdprDistributedFencePg17Synthetic.test.js`, eseguito dal workflow di regressione esistente. Guard vincolante su `GITHUB_ACTIONS=true`, `GDPR_OUTBOX_WORKER_CI=isolated`, `TEST_DATABASE_URL` esatto su `127.0.0.1:5432/gdpr_outbox_worker_ci`; nessun endpoint esterno, nessuna credenziale di produzione.
- Lo schema `gdpr_fence_ci` contiene due identità fittizie, un gate `open/epoch`, una tabella di revisioni e un registro minimo di scritture. Il ruolo di applicazione `gdpr_fence_runtime_ci` non ha privilegi DML diretti e possiede soltanto `EXECUTE` su una funzione gateway `SECURITY DEFINER` con search_path fissato. Proprietario dedicato `gdpr_fence_owner_ci` è NOLOGIN, NOBYPASSRLS, NOSUPERUSER (non il superuser postgres).
- La funzione prende un lock transazionale condiviso di manutenzione `pg_advisory_xact_lock_shared` e un lock transazionale esclusivo derivato dal soggetto; entrambi restano fino a COMMIT/ROLLBACK. Soggetti distinti non sono serializzati globalmente. Ogni scrittura valida richiede epoch corrente, gate aperto, revision attesa e ID evento coerente per l'idempotenza.
- Una sessione di manutenzione **nel solo test** prende il lock esclusivo di gate, attende le transazioni correnti e chiude il gate incrementando l'epoch. Le sessioni runtime non possono modificarlo direttamente. Una volta chiuso il gate, perfino una nuova richiesta con epoch corrente viene respinta.
- Risultati su [run GitHub Actions 40918053894](https://github.com/Nictolas/DemosApp/actions/runs/40918053894): **5/5 PASS, zero skip**. Prove: least privilege del writer/owner, scritture utenti diversi in parallelo, attesa del lock per stesso soggetto, rifiuto di revision obsoleta, attesa della manutenzione e chiusura del gate, divieto di accessi DML diretti. Gli altri test della PR non vengono sostituiti.

**Cosa NON dimostra (gate indispensabili):**
1. Il gate `open/epoch` risiede nello stesso DB: uno snapshot vecchio può ripristinarlo in stato aperto insieme ai dati cancellati. **Serve una barriera esterna indipendente, durevole e non aggirabile** prima di riattivare ingress e writer. Advisory lock non sopravvive a PITR/restore e non vincola una connessione con DML privilegiato.
2. La verifica temporanea delle revisioni non implementa ancora la transazione applicativa completa (tabelle reali, RLS, consenso, cancellazione, ledger/outbox), né dimostra un ordine globale tra provider. Il proprietario fittizio è isolato, ma i ruoli, grant, search_path e audit reali richiedono revisione e attestazione separata.
3. Non sono stati implementati token/lease distribuiti o fencing su più database, failover, Render e Supabase reali. Il modello non include l'invio di B2 né prova l'atomicità PostgreSQL↔B2.
4. La matrice della retention RP-10/F5-17, DPIA e la validazione DPO/titolare rimangono prerequisiti. **Non utilizzare il test per trasformare `recoveryReady:false` in `true`.**

**Esito Fase D: schema di prova SQL verificato; enforcement reale ancora assente. GH-296 rimane APERTA / NO-GO.**

## Fase E — modello di admission con epoca esterna, verificato contro vecchio snapshot (29 ottobre 2026)

**Ancora SOLO codice sperimentale in api/tests; nessuna barriera implementata nel runtime o configurazione Render/Supabase/B2.**

- `api/tests/fixtures/gdprIndependentAdmissionEpochSynthetic.js` implementa un'autorità separata *in memoria* dal database. Firma con HMAC uno stato a generazione (`databaseId`), epoca monotona, seriale, checkpoint ed esito `open/blocked`. Le ricevute precedenti o manomesse sono invalidate quando lo stato esterno avanza. Assenza dell'autorità = accesso negato, mai fallback al solo database.
- `api/tests/gdprIndependentAdmissionEpochSynthetic.test.js` esegue **11 test PASS** (run [40919128648](https://github.com/Nictolas/DemosApp/actions/runs/40919128648)): snapshot vecchio apparentemente aperto dopo sospensione esterna, attestazioni scadute/falsificate, indisponibilità, prerequisiti incompleti, generazione nuova obbligatoria e blocco letture/scritture vecchie.
- `api/tests/gdprDistributedFencePg17Synthetic.test.js` ora esegue **7 test PASS** nello stesso database PostgreSQL17 effimero; il gate locale dispone anche di `database_id` sintetico. Simula il ripristino di un gate SQL precedente `open=true,epoch=1` quando l'autorità esterna ha già sospeso l'epoca: sia le letture sia le scritture tramite l'*adapter di ammissione simulato* vengono rifiutate, e una generazione nuova richiede configurazione e ricevuta nuove.
- **Test negativo essenziale:** nello stesso vecchio snapshot la funzione SQL `perform_synthetic_write` è ANCORA chiamabile da un client con le vecchie credenziali se il client salta il preflight esterno. Il test prova tale bypass **solo dentro una transazione effettivamente ROLLBACK**. È la dimostrazione del rischio residuo, non una garanzia di isolamento operativo.
- Le suite sono collegate al workflow esistente della PR Draft #374, senza rete verso provider veri, dati personali, deploy o migrazioni.

### Implicazione architetturale verificata

**Una verifica HMAC dell'epoca in Node prima di una query non è sufficiente.** Può essere aggirata da un processo che abbia ancora credenziali SQL, e una sospensione in corsa può generare una condizione di gara tra preflight e COMMIT. La futura barriera affidabile dovrà essere *enforced* da un controllo indipendente su tutta la superficie di accesso: blocco degli ingressi, separazione delle credenziali e rotazione/revoca delle vecchie sessioni SQL, blocco di ogni writer/reader/job/worker, nuova generazione solo dopo riconciliazione, ed evidenze di isolamento verificabili; poi prova di crash/failover/snapshot e accesso diretto negato. Non è sufficiente un semplice booleano locale o un'altra tabella del medesimo DB.

L'autorità HMAC è soltanto un modello e l'approvazione del ripristino usa booleani di prova: nessuna verifica di disponibilità, durata, freschezza, costi, IAM/secret management, completezza o Object Lock reale. `productionRecoveryReady` resta **sempre false**.

**Esito Fase E: test logici e PostgreSQL superati; prova di bypass evidenziata; GH-296 ancora OPEN / NO-GO.** Prima di un rilascio vanno implementati e attestati il *data-plane cut-off* indipendente e il journal esterno completo, con RP-10/F5-17 e DPIA approvati.

## Fase F — prova del cut-off SQL locale e limite del backup di cluster (29 ottobre 2026)

**Eseguibile esclusivamente sul PostgreSQL 17 temporaneo di GitHub Actions. Nessun comando di questa sezione è autorizzato sulla produzione.**

Il test `api/tests/gdprDistributedFencePg17Synthetic.test.js` dimostra un passaggio ulteriore oltre al preflight HMAC in memoria: disabilitare `LOGIN` e cancellare la password del ruolo di test **impedisce nuove sessioni**, ma **non termina** quelle già esistenti. Una connessione preesistente può ancora invocare la funzione gateway su un backup che ha ripristinato `open=true`. Per il rehearsal il cambiamento è effettuato all'interno di una transazione ROLLBACK, senza persistere dati.

Un operatore di prova con privilegi separati termina poi la sessione con `pg_terminate_backend`; PostgreSQL esegue rollback di una transazione di cancellazione ancora aperta. Una nuova lettura/scrittura tramite le credenziali precedenti è negata. Si verifica la chiusura di tutte le sessioni appartenenti al ruolo fittizio e si rimuove il ruolo al termine. Non si usa B2, Render, Supabase o alcun utente reale.

**Le prove SQL locali non rappresentano un cut-off esterno sufficiente:**
- Una sessione SQL già autenticata sopravvive a `ALTER ROLE NOLOGIN` finché non è terminata; password rotate/revoke non equivalgono a drenaggio di sessioni, pool e worker.
- In un *restore completo dell'intero cluster PostgreSQL* anche i cataloghi globali dei ruoli potrebbero essere ripristinati. Nel restore di un singolo database i ruoli globali invece restano esterni a quel dump: il tipo effettivo di recupero deve essere attestato, senza supposizioni.
- Un processo con credenziali di owner/superuser, una connessione diretta alternativa, un pooler, un processo batch o un secondo accesso applicativo può aggirare la sola funzione di ammissione Node. Il test di un unico ruolo non costituisce censimento di tutti i writer/reader.
- Avere un authority HMAC fuori da PostgreSQL **non evita la gara** fra l'ultimo controllo e la successiva query. Serve un vincolo tecnicamente enforceable alla rete/identità/connessione che prevalga anche sulle credenziali ripristinate.

### Contratto operativo esterno da approvare prima di uno staging reale

1. Identificare e attestare da fonti effettive tutti i punti di ingresso al database, inclusi backend Render, pooler, worker, job, importatori, account amministrativi, API provider e connessioni dirette. Non estrarre o pubblicare password/token.
2. Attivare *prima* del ripristino un blocco di rete e/o IAM **indipendente dal backup SQL** che neghi ai client qualsiasi nuova connessione, lettura o scrittura. Se il provider non permette un blocco esaustivo, il gate resta NO-GO.
3. Congelare gli ingressi HTTP e sospendere job/processi/queue; revocare/ruotare credenziali precedenti **senza divulgare segreti** e terminare ogni sessione preesistente. Attestare il numero zero di sessioni live e connessioni rifiutate per ogni percorso censito; i privilegi amministrativi sono separati dal ruolo runtime.
4. Creare una nuova generazione/epoca esterna non retrocedibile. Ricostruire il database soltanto nella quarantena; verificare la completezza dell'intero journal GDPR e il checkpoint B2 esterno più recente, risolvere ogni operazione incerta secondo protocollo approvato e riprodurre idempotentemente le cancellazioni/revoche.
5. Consentire nuove connessioni **solo per una nuova generazione e nuove identità** dopo controlli end-to-end di assenza dei dati cancellati, credenziali vecchie effettivamente respinte (anche dopo restore), outbox completa, read/write fail-closed e autorizzazioni DPO/titolare. Se manca anche una sola attestazione, non servire traffico.

La decisione su credenziali, network isolation, retention RP-10/F5-17, IAM/B2 Object Lock e DPIA richiede autorizzazione separata. Non attivare nulla in produzione in base ai risultati sintetici. GH-296 resta **OPEN / NO-GO**.
