# DEMOS — Gate di verifica locale e B2 prima del ripristino (26/10/2026)

**PR #302 DRAFT, stacked su #301. Nessun merge, deploy, attivazione o accesso ai dati reali.**

## Correzioni

1. `recordEvent` non esegue piu' DDL di creazione dell'outbox sulla richiesta utente quando `GDPR_ERASURE_OUTBOX_ENABLED=true`. L'installazione e il backfill devono essere compiuti intenzionalmente in quarantena prima dell'attivazione. Se la tabella non esiste, PostgreSQL rifiuta l'inserimento atomico e la transazione chiamante non deve committare. Il ledger legacy usa ancora `ensureTable`; questa PR non cambia il suo schema storico.
2. `PrivacyErasureOutboxWorker.status()` distingue `pending`, `unqueued` (eventi del ledger mai accodati), `invalidReceipts` (marcatori localmente invalidi). `ready=true` e' un'indicazione LOCALE: non certifica l'esistenza dell'oggetto B2 né che il DB contenga tutti gli eventi realmente prodotti.
3. `PrivacyErasureB2Journal.verifyArchivedReceipt` verifica il VersionId specifico senza PUT, con readback del corpo, SHA256, dati di evento, retention e Object Lock COMPLIANCE. Non riscrive automaticamente una versione B2 mancante.
4. `verifyOutboxRecoveryReadiness` e' un controllo OFFLINE: richiede attestazione manuale della quarantena, un client PostgreSQL DEDICATO (non `pool.query`), un exporter B2 configurato, e scorre il ledger in una transazione `REPEATABLE READ READ ONLY` senza modificare lo schema. Per ogni evento esige outbox consegnata e ricevuta B2 coerente e verificata. Fallisce con tabella mancante, eventi non accodati, pendenti, ricevute false, versioni remote non disponibili o limite di sicurezza superato. Restituisce solo conteggi aggregati.

## Limite critico

**Anche quando questo test passa, non autorizza il rilascio o un restore:** non puo' vedere eventi GDPR perduti prima di essere registrati nel database sopravvissuto, e non può dimostrare che un checkpoint esterno sia il piu' recente. Un DB ripristinato potrebbe mostrare `pending=0` con eventi completamente mancanti. Servono pin esterno fresco e indipendente (#299), continuita' verificabile della cronologia B2, integrita' anti-rollback, quarantena di tutte le API/worker Render/Supabase e DPIA/DPO.

## Sicurezza e utilizzo

- Nessun collegamento automatico all'app, alle route utente o alle procedure di deploy.
- Nessun client B2/DB reale disponibile o invocato dai test.
- Un controllo con `maintenanceConfirmed=true` e' una dichiarazione del chiamante: la funzione NON puo' dimostrare che Supabase Data API, altre istanze o vecchi client siano davvero isolati.
- **Semantica fail-closed del flag outbox (bozza):** `GDPR_ERASURE_OUTBOX_ENABLED` assente oppure esattamente `false` indica la modalità legacy; esattamente `true` richiede l'evento e la riga outbox atomici. Ogni altro valore configurato, anche stringa vuota o `TRUE`, causa errore **prima di qualunque query** in `recordEvent` e nel replay offline, invece di salvare eventi GDPR senza coda B2. Prima di attivare in produzione, verificare esplicitamente il valore effettivo del flag su **tutte** le istanze: non si deve assumere che il blocco HTTP o questa validazione dimostrino l'isolamento dei worker/Supabase.
- **Semantica fail-closed del flag HTTP (bozza):** `DEMOS_PRIVACY_RECOVERY_MAINTENANCE` non impostato o esattamente `false` lascia proseguire il normale traffico; esattamente `true` risponde 503. Qualsiasi altro valore **impostato**, compresi `TRUE`, `false ` (spazi), `0` o una stringa vuota, risponde **503**: un errore di battitura in una configurazione di recovery non deve sbloccare silenziosamente l'API. Per il normale servizio usare una variabile assente o `false`; non interpretare il blocco HTTP come prova di quarantena infrastrutturale.

- Per una prova corretta eseguire solo su database isolato con client dedicato e checkpoint esterno approvato. Non passare identita' o preferenze in log.
- Il controllo B2 completo richiede una lettura per evento: costi, latenza e limiti delle API vanno valutati a parte.

## Test sintetici previsti

PostgreSQL 17 su GitHub Actions: schema assente e SQL fail-closed, backfill, transazioni e retry, coda pendente, eventi ledger non accodati, receipt alterata, oggetto remoto eliminato, scansione paginata e limite massimo di verifica. Nessun dato di produzione.


## Drill sintetico: perdita contemporanea del database e di un evento non ancora archiviato

- Evento inventato **A**: presente nel backup e nel relativo oggetto B2 immutabile.
- Evento inventato **B**: registrato dopo il backup, non ancora esportato in B2 prima del guasto; il restore recupera soltanto A. La verifica locale di outbox/ledger può quindi apparire regolare.
- **Caso con fonte indipendente recente:** il manifesto firmato e il digest di checkpoint ottenuti tramite un canale esterno affidabile includono A+B. La scansione del DB ripristinato rileva B mancante, esegue ROLLBACK e rifiuta ready=true.
- **Caso di rollback del manifesto:** il manifesto firmato contiene soltanto A, ma il pin indipendente più recente è relativo ad A+B. Il controllo rifiuta il manifesto **prima di SQL e B2**.
- **Limite non risolvibile con questi test:** se il checkpoint indipendente è esso stesso vecchio, compromesso, o non ha mai incluso B, un insieme coerente A-only può superare i controlli tecnici. Nessuna firma o SHA256 dimostra da sola quale sia l'ultima scrittura realmente avvenuta. Il risultato ready=true resta **solo tecnico**, non autorizzazione a servire il database.

### Blocco operativo non aggirabile senza nuova decisione

Prima di qualsiasi ripristino reale serve una sorgente *indipendente e attendibile* che certifichi completezza, ordine e freschezza della cronologia fino al punto di interruzione delle scritture, insieme a prove di quarantena di tutti gli ingressi (API, Data API Supabase, worker, istanze e credenziali già distribuite). Se non è dimostrabile che B fosse stato acquisito da tale fonte, il guasto lascia una **finestra di perdita non dimostrabilmente recuperabile**: non riaprire il servizio solo perché le ricevute degli eventi sopravvissuti passano.

Definire e approvare con titolare/DPO: autorità del checkpoint, barriera/durabilità degli eventi di revoca, retention, recovery point objective, procedura di incident response, attestazioni e costi della verifica B2. Non stabilire implicitamente questi parametri nel codice o nella CI.

I due nuovi test dual-loss drill in api/tests/privacyRecoveryGate.test.js usano esclusivamente eventi fittizi, DB simulato e mock B2, senza credenziali o connessioni reali. Nessun merge, deploy, migrazione o attivazione.


## Preflight della dimensione eventi nella modalità outbox (PR successiva a #320)

Con `GDPR_ERASURE_OUTBOX_ENABLED=true`, ogni `recordEvent` valida **prima della prima query PostgreSQL** lo stesso evento con lo stesso normalizzatore usato da `PrivacyErasureB2Journal`. La previsione usa un UUID canonico già generato, l'ID soggetto, il tipo, i dettagli e un timestamp ISO sintetico della stessa lunghezza di quello reale.

- Rifiuta eventi oltre 8192 byte dopo serializzazione canonica e dettagli non-oggetto (es. array), o identificativi soggetto non archiviabili. Un evento non consegnabile non deve entrare nel ledger/outbox atomico.
- Regressione sintetica verifica **zero query SQL** per tutti i casi rifiutati e una singola query atomica ledger+outbox per un evento valido sotto il limite.
- Non ripara eventuali eventi troppo grandi già presenti in snapshot precedenti; richiede inventario e decisione documentata prima di qualsiasi migrazione o azione su registri reali. Non cancellare o alterare registrazioni per aggirare il gate.
- La modalità legacy senza outbox non viene modificata da questa PR. Non dimostra completezza o freschezza del checkpoint esterno e non sostituisce la prova di quarantena infrastrutturale.

Test solo con oggetti e client PostgreSQL simulati. Nessun accesso a B2 o a dati reali.


## Correzione della divergenza tra JSON preflight e JSON PostgreSQL

Un controllo basato sull'oggetto JavaScript originale non garantisce che i byte validati siano quelli effettivamente inseriti in PostgreSQL. Per esempio un oggetto con metodo `toJSON` ereditato può apparire piccolo all'enumerazione delle proprietà ma produrre un JSON superiore a 8192 byte. Un serializzatore che cambia risposta fra due invocazioni crea lo stesso rischio.

In modalità outbox il codice **serializza i dettagli una sola volta**, rifiuta una serializzazione non valida e sottopone a `PrivacyErasureB2Journal.normalizeEvent` esattamente il valore JSON ottenuto, deserializzato. La **stessa stringa originale** viene passata al parametro JSONB nella query atomica. In questo modo la verifica della dimensione coincide con il contenuto che PostgreSQL riceve, anche per valori con `Date` o `toJSON`. In modalità legacy il percorso non è modificato.

La regressione usa esclusivamente valori inventati e un client SQL simulato: oggetto con `toJSON` ereditato sovradimensionato, serializzatore mutevole, serializzazione `undefined`, e caso positivo con `Date` serializzata. Non implica cambiamenti al database, riscritture di eventi esistenti, modifiche a B2 o decisioni sulla DPIA. Questa correzione **non** dimostra completezza/freschezza della cronologia esterna.
