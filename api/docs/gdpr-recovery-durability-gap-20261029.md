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
