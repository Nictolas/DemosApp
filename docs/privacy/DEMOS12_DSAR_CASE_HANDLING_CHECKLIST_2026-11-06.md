# DEMOS 12 — Registro operativo DSAR (bozza DPO, NON certificazione)

Data: 06/11/2026. Ambito: richieste a `privacy@demos.community` relative a Grazia, Attivisti, Organizzazioni e Proponi soggetto. Nessuna richiesta reale viene registrata in questo file.

## Stato delle prove

- **DSAR-01 — ricezione tecnica: PASS limitato.** Un messaggio sintetico proveniente da Outlook è arrivato nella Gmail di destinazione passando per l'inoltro Porkbun. Evidenza: intestazioni RFC822 e `Delivered-To` conservate nella casella autorizzata; runbook `DEMOS12_GRAZIA_DSAR_RUNBOOK_2026-11-05.md`. Questo non dimostra una procedura di risposta, né una garanzia di consegna futura.
- **DSAR-02..06: NON TESTATI / NO-GO.** Nessuna richiesta di un interessato reale, nessuna verifica identità, decisione giuridica, rettifica o cancellazione, né risposta finale è attestata.

## Procedura minima da approvare ed eseguire su caso reale

1. **Ricezione e protocollo (DSAR-02):** il DPO controlla la mailbox e registra *in archivio privato con accesso ristretto* ID caso pseudonimo, data/ora di ricezione, tipo richiesta, scadenza e stato. Non inserire email, nomi, dettagli giudiziari o documenti d'identità in GitHub, Google Sheet tecnici, log o issue pubbliche. Evitare inoltri a gruppi.
2. **Qualificazione e identità (DSAR-03):** distinguere soggetto pubblicato, proponente, votante o terzo; verificare che la richiesta provenga dall'interessato o da rappresentante autorizzato con mezzi proporzionati al rischio. Non richiedere automaticamente un documento d'identità; non confermare dati privati a un indirizzo non verificato. Se la richiesta riguarda informazioni pubblicate da terzi, valutare le basi e l'eventuale necessità di sospensione cautelativa, senza automatismi irreversibili.
3. **Valutazione e azione (DSAR-04):** individuare le sole tabelle/record pertinenti tramite operatore autorizzato, documentare finalità, base giuridica, limiti ed eccezioni applicabili; applicare rettifica, limitazione, ritiro o cancellazione solo dopo autorizzazione e test. Per i soggetti già approvati, valutare la funzione Admin di ritiro; verificare anche cache e directory. Nessun accesso o modifica a dati reali da questa checklist.
4. **Risposta e termini (DSAR-05):** rispondere all'interessato con esito comprensibile e motivazione appropriata, senza divulgare informazioni di altri. Termine ordinario: **un mese dal ricevimento**; proroga fino a due mesi ulteriori solo nei casi consentiti, comunicandola entro il primo mese con motivi. Gestire separatamente eventuali obblighi di conservazione o contestazioni.
5. **Chiusura e minimizzazione (DSAR-06):** registrare data/ora della risposta, tipo di decisione, operatore, eventuale revisione e prova privata di invio. Definire e applicare una durata di conservazione giustificata del registro e delle evidenze, con accesso ristretto e cancellazione a scadenza. La retention **non è approvata** da questo documento.

## Mappa minima Grazia verificata nel codice (per DSAR-03/04)

Questa mappa deriva da `api/routes/grazia.js` sul ramo Draft, non da una lettura del database reale. Non implica che tutte le informazioni qui elencate siano automaticamente oggetto di cancellazione, né che siano stati trattati dati giudiziari.

| Superficie | Dati effettivamente usati dal codice | Accesso / intervento da verificare |
| --- | --- | --- |
| `richieste_grazia` | `id`, `utente_id`, `nome`, `url_prova`, `status`, `data_creazione`, `withdrawn_at`, `withdraw_notification_sent` | Proposte private, storico approvazioni e ritiri; `GET /api/grazia/mia-proposta` restituisce soltanto stato e data all'utente autenticato; gli elenchi Admin sono separati. L'eventuale ritiro va valutato senza cancellare indiscriminatamente l'audit. |
| `grazia_carcerati` | `id`, `nome`, `attivo` | Catalogo dei soggetti approvati: il feed pubblico legge soltanto i nomi attivi e conteggi aggregati. Il ritiro Admin richiede verifica anche del feed/cache. |
| `voti_grazia` | identificativo del voto, identificativo utente (`userid` o `user_id`), `nome`, timestamp (varianti ammesse dal codice) | Preferenza personale: `GET /api/grazia` restituisce `mieiVoti` soltanto con token valido; scrittura autenticata con consenso e identità civica verificata. Nessun nominativo del votante deve comparire nel feed pubblico. |
| `preference_change_cooldowns` | `user_id`, `scope='grazia:preferenza'`, `last_changed_at` | Stato tecnico del limite 24 ore, distinto dal voto. Una richiesta di rettifica/cancellazione deve valutarlo separatamente, con base e conservazione documentate. |
| `notifiche_demos` | Notifica generica agli amministratori dopo proposta accettata | Il testo non include il nominativo proposto; verificare soltanto l'eventuale esistenza di record riferibili all'utente in un processo DSAR autorizzato. |

**Verifica giuridica specifica ancora aperta:** `nome` e URL di fonte pubblica non equivalgono automaticamente a dati su condanne o reati. Esaminare il contenuto realmente pubblicato e l'eventuale informazione indirettamente rivelata, poi motivare l'applicabilità o meno dell'art. 10 GDPR; analogamente per art. 9. Evitare di presupporre categorie particolari senza evidenza. Per le nomine di terzi valutare anche art. 14 e relative eccezioni caso per caso.

## Esercitazione sintetica DSAR-02..06 — matrice da eseguire, non eseguita

| Caso fittizio | Azione consentita senza dati reali | Criterio di accettazione e prova da custodire privatamente |
| --- | --- | --- |
| S1: interessato identificato chiede rettifica di nome pubblicato | Simulare presa in carico, verifica proporzionata, decisione Admin e controllo del feed in ambiente autorizzato | ID caso fittizio, data di ingresso, decisione motivata, risposta simulata; nessun nome reale nei tracker |
| S2: mittente non verificato chiede dati dei voti di un altro utente | Simulare classificazione e richiesta di informazioni aggiuntive proporzionate | Nessuna conferma dell'esistenza di preferenze private e nessuna divulgazione |
| S3: richiesta di cancellazione della proposta e dell'audit | Simulare analisi separata di catalogo, richiesta, voti, cooldown e log/retention | Motivazione per ciascuna superficie: cancellazione, limitazione o conservazione lecita; nessuna operazione reale |
| S4: messaggio incompleto, risposta non consegnabile o termine prossimo | Simulare gestione scadenza e canale di risposta | Scadenza calcolata dal ricevimento, motivazione di eventuale proroga entro un mese, esito e conservazione minima |
| S5: richiesta di persona pubblicata da un terzo | Simulare valutazione dei dati effettivamente esposti e delle basi giuridiche | Decisione DPO motivata su artt. 5, 6, 9, 10, 14 (secondo applicabilità), ritiro cautelativo solo se autorizzato |

**Regola di prova:** una checklist compilata non dimostra l'esecuzione. Segnare PASS soltanto dopo esercitazione realmente eseguita con esiti, data, operatore e traccia privata; finché non avviene, DSAR-02..06 restano NO-GO.

## Prove di accettazione ancora necessarie

- Simulare con dati fittizi un intero caso: ricezione → registrazione privata → verifica proporzionata → valutazione → eventuale ritiro/rettifica autorizzata → risposta → archiviazione minima. Testare separatamente richiesta incompleta, richiesta da terzo non autorizzato e impossibilità di consegna.
- Documentare titolare e incaricati, accessi, policy di conservazione, informativa e basi giuridiche (artt. 5, 6, 9, 10, 14 GDPR secondo applicabilità), e valutare la necessità di DPIA. Richiedere la decisione DPO; l'approvazione generica non sostituisce la verifica specifica.
- Il collaudo staging DEMOS10, Android fisico e l'autorizzazione al rilascio restano indipendenti e non vengono superati da questa procedura.

**Gate:** NO-GO per DSAR-02..06 e rilascio. Questo file è una procedura proposta, non un registro contenente richieste reali, non una consulenza legale conclusiva e non una prova di esecuzione.

## Evidenza tecnica S3 — cancellazione concorrente e limite della prova (06/11/2026)

La PR Draft contiene una regressione sintetica PostgreSQL 17 con due account fittizi: la cancellazione dell'account A elimina preferenze Grazia, cooldown e notifiche personali, preservando i record dell'account B. Una seconda prova tiene una cancellazione aperta mentre arriva un POST di voto: il voto prende un lock sulla riga dell'account, attende la cancellazione e risponde 401 dopo il commit, senza ricreare voto o cooldown. Codice/test ai commit `8e811c8d76bbbbc36cf2e8fc1a1765cf670b9122`, `78a3bbdda9a8e2af1f7631e923df24bede3c335b`, `63cacdb3448aadc92d11fb95385a6d4cf0a9da46`. Sullo SHA finale sono passati 15/15 workflow pull_request, compreso PostgreSQL 17 temporaneo.

**Interpretazione rigorosa:** il test S3 dimostra soltanto l'isolamento tecnico delle operazioni sintetiche esaminate. Non attesta un'istanza DSAR reale, la cancellazione di ogni possibile copia/backup/log, la retention lecita dello storico delle pubblicazioni, la verifica dell'identità o la comunicazione all'interessato. S3 procedurale e DSAR-02..06 restano NO-GO. Prima di chiudere una richiesta reale occorrono un inventario dei sistemi/backup interessati, una decisione DPO documentata sulla conservazione residua, la prova privata dell'azione autorizzata e una risposta inviata tramite canale verificato.
