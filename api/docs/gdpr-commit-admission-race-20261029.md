# DEMOS — GH-296, finestra tra preflight e COMMIT (29 ottobre 2026)

**Solo dimostrazione sintetica in Draft PR #374. Non eseguita su Render, Supabase o Backblaze B2. Non autorizza un ripristino e non imposta `recoveryReady` a true.**

## Evidenza e problema

Le verifiche reali in sola lettura del 29 ottobre hanno confermato che nel progetto Supabase **Demos** esistono connessioni di servizio PostgREST (`authenticator`) e Supavisor (`postgres`), ma **non è stata attestata l'identità della connessione runtime di Render**. L'interfaccia collegata di Render espone metadati e deploy, non un comando sicuro di esecuzione SQL nello stesso processo già attivo; le query SQL della Supabase Management API attestano solo la propria sessione, non la connessione di Render. Il servizio `demos-functional-staging` esiste e ha auto-deploy disattivato, ma **non esiste un'attestazione remota in-process già attiva**; non occorre creare un servizio o mutare quello esistente senza un'esplicita autorizzazione di deploy/probe.

### Rischio TOCTOU non risolto da un HMAC esterno

1. Il writer valida un checkpoint HMAC `epoch=1` fuori dal database.
2. Il controllo esterno viene sospeso e passa a `epoch=2`.
3. Il writer che **aveva già superato il preflight** può completare una scrittura SQL sulla vecchia istanza PostgreSQL che dispone ancora di credenziali/privilegi: la verifica esterna prima della query non impedisce il COMMIT.

**Non basta verificare più spesso il ticket**: un'altra gara può avvenire tra la verifica e la scrittura effettiva. Gli accessi SQL diretti e HTTP alternativi restano vie di bypass.

### Contratto di drain proposto, ma non implementato sui provider

Un servizio di coordinamento esterno al cluster PostgreSQL dovrebbe:

- Rifiutare **sincronicamente** nuove ammissioni appena inizia il freeze e registrare le scritture già ammesse tramite identità/lease non falsificabili.
- Aspettare l'esito **reale e confermato** di COMMIT o ROLLBACK di tutte le transazioni in corso **prima** di dichiarare freeze completato.
- Non consentire l'auto-approvazione quando un writer perde il contatto o il processo muore: in tal caso l'esito è **UNKNOWN**, va forzato un isolamento indipendente rete/identità e va riconciliato il commit.
- Non riaprire su ticket obsoleti, snapshot SQL precedenti, un altro `databaseId` o prova del journal incompleta.
- Non affidarsi a un registro di lease solo in RAM: in produzione dovrà essere durevole, autenticato, indipendente dall'immagine di ripristino e soprattutto **applicato a tutti i canali di accesso**. Il cut-off deve funzionare anche se il processo ignora completamente il servizio di lease.

Inoltre, `lease.finish()` deve avvenire **dopo** una conferma di COMMIT/ROLLBACK. Se il codice rilascia la lease prima del commit, il coordinatore potrebbe attestare falsamente lo stop mentre SQL è ancora aperto. Una risposta HTTP o la chiusura della connessione non sono, da sole, prova che l'ultima transazione SQL sia stata committata o no; se l'esito è incerto la procedura resta bloccata.

## Fixture tecnica

Nuovi file SOLO in `api/tests`:

- `fixtures/gdprCommitAdmissionLeaseSynthetic.js`: modello in-memory con authority sintetica già testata e API `begin/freeze/finish`. `freeze` chiude immediatamente l'ammissione e attende l'uscita di tutte le lease. NON interagisce con un database e NON rappresenta un contratto distribuito reale.
- `gdprCommitAdmissionLeaseSynthetic.test.js`: test con esito positivo e **controlli negativi**: preflight vecchio che consente una scrittura dopo sospensione, blocco di nuovi ingressi mentre esistono lease, più writer contemporanei, rilasci falsificati/doppi, authority non disponibile, lease abbandonata dopo crash, errore release-before-COMMIT, vecchia generazione SQL.
- Workflow esistente `.github/workflows/gdpr-b2-worker-retry-isolated-ci.yml`, senza nuove infrastrutture, con i guard PG17 isolati già presenti. I test logici non richiedono PostgreSQL reale e non toccano segreti.

### Precondizioni per successivo passo di staging

Prima di eseguire un test su `demos-functional-staging` o sui servizi collegati, serve un piano *eseguibile e circoscritto* con approvazione distinta del target, prova della sua indipendenza da produzione, un comando read-only che legge il ruolo **dentro il processo** e senza logging di URI/credenziali, e divieto di chiamate DDL/DML, job, deploy main, rotazione credenziali o provisioning. La sola etichetta 'staging' non prova indipendenza dei collegamenti effettivi.

**GH-296 OPEN / NO-GO.** Nessuna prova sintetica può far approvare il recovery. Mancano ancora cut-off SQL+HTTPS imposto sui provider, sessioni/credenziali vecchie impedite, verifica B2/outbox durevole, RP-10/F5-17 e DPIA.
