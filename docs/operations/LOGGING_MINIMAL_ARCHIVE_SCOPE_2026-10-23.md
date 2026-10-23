# DEMOS — B2: solo eventi audit/security; niente nuove copie tecniche

Decisione operativa del titolare: **conservare il minimo realmente necessario**. Questa modifica interviene *prospetticamente* sulla duplicazione dei log da Axiom a Backblaze e non cancella record né approva una durata generale.

## Effetto del codice

- `centralized_logs` e `real-time` continuano a esistere su **Axiom**, con retention account verificata di **30 giorni** (screenshot 23/10/2026).
- L'archiviatore Axiom → B2 consulta le stesse sorgenti, ma ora include nei file `data/` **soltanto gli eventi classificati `audit` e `security`**; esclude gli eventi classificati `technical`, che rimangono su Axiom per la diagnostica.
- `AXIOM_ARCHIVE_INCLUDE_TECHNICAL` è un flag di eccezione: **non impostato / false** = non duplicare file tecnici; **true** = ripristino esplicito della precedente archiviazione ampia. Nessuna nuova chiave e nessuna modifica al bucket.
- Manifest e checkpoint continuano a registrare il solo conteggio effettivamente archiviato, anche se la finestra contiene soltanto eventi tecnici (conteggi pari a zero); il ripristino read-only verifica l'integrità dei file audit/security senza aspettarsi tecnici mancanti.
- I dati **già** presenti in `data/technical` non vengono rimossi e conservano l'attuale impostazione B2 `Keep all versions` finché non sarà approvata un'adeguata regola lifecycle. Non attivare cancellazioni senza preflight non distruttivo e parere DPO.
- L'archivio B2 di eventi audit/security resta **senza TTL** e continua a richiedere policy separata e motivata; la modifica non garantisce conformità di retention.
- **Non** si introduce l'outbox PR #218, che resta in bozza. Non si deve attribuire un obbligo GDPR generale a `centralized_logs`.

## Ambito ed eccezioni da verificare

La classificazione `classifyRecord` usa marcatori espliciti `log_type` / `auditEvent` / `securityEvent`, campi evento e fallback storico. Eventi privi di tali elementi vengono classificati `technical` e non avranno una nuova copia B2: verificare che tutti gli eventi realmente critici siano correttamente marcati, senza presumere che ogni evento tecnico sia legalmente obbligatorio. La copertura effettiva degli accessi degli amministratori di sistema e l'eventuale obbligo dei sei mesi devono essere valutati separatamente con il DPO. Un unico Admin applicativo non equivale automaticamente a un unico AdS.

## Verifiche

- Axiom 30 giorni: confermato per `centralized_logs` e `real-time` con screenshot del titolare del 23/10/2026.
- B2: `demos-log-archive-eu` privato, encryption on, `Keep all versions`; **nessun lifecycle impostato con questa modifica**.
- Test isolati: Axiom→B2 con `technical`, `audit`, `security`, verifica che i primi non generino file di dati, checksum, integrità manifest/restore e checkpoint anche per finestre tecniche vuote.
- DPO Mattia: parere su necessità, completezza e durate degli eventi conservati, oltre alle impostazioni B2 e al perimetro AdS. Decisione del titolare separata nella matrice `Log - matrice DPO`.

**Sicurezza**: la riduzione dei dati non equivale a spegnere il sistema di allerta o i log tecnici temporanei. Le credenziali dei provider e le attività pregresse rimangono invariate.
