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


## Gate S4 — scadenze e recapito (specifica non eseguita)

Nel registro privato separare data di ricezione, scadenza ordinaria in mesi di calendario, eventuale proroga motivata comunicata entro il primo mese, nuova scadenza, data di risposta e prova di consegna. La proroga non è automatica: motivare complessità o numero delle richieste e verificare l'art. 12(3) GDPR. Non presumere che richieste di chiarimento sospendano automaticamente i termini.

Casi sintetici ancora DA ESEGUIRE: ricezione 31 gennaio con mese successivo più corto; febbraio bisestile; proroga motivata notificata in tempo; proroga tardiva da rifiutare; risposta non recapitata che non può essere segnata come consegnata. Nessuna email di test senza autorizzazione; risultati e ricevute solo in archivio privato. Validazione DPO richiesta per il computo concreto dei termini.

**Stato: specifica di accettazione aggiunta, nessun test S4 eseguito, DSAR-05 NO-GO.**

## Prove di accettazione ancora necessarie

- Simulare con dati fittizi un intero caso: ricezione → registrazione privata → verifica proporzionata → valutazione → eventuale ritiro/rettifica autorizzata → risposta → archiviazione minima. Testare separatamente richiesta incompleta, richiesta da terzo non autorizzato e impossibilità di consegna.
- Documentare titolare e incaricati, accessi, policy di conservazione, informativa e basi giuridiche (artt. 5, 6, 9, 10, 14 GDPR secondo applicabilità), e valutare la necessità di DPIA. Richiedere la decisione DPO; l'approvazione generica non sostituisce la verifica specifica.
- Il collaudo staging DEMOS10, Android fisico e l'autorizzazione al rilascio restano indipendenti e non vengono superati da questa procedura.

**Gate:** NO-GO per DSAR-02..06 e rilascio. Questo file è una procedura proposta, non un registro contenente richieste reali, non una consulenza legale conclusiva e non una prova di esecuzione.

## Evidenza tecnica S3 — cancellazione concorrente e limite della prova (06/11/2026)

La PR Draft contiene una regressione sintetica PostgreSQL 17 con due account fittizi: la cancellazione dell'account A elimina preferenze Grazia, cooldown e notifiche personali, preservando i record dell'account B. Una seconda prova tiene una cancellazione aperta mentre arriva un POST di voto: il voto prende un lock sulla riga dell'account, attende la cancellazione e risponde 401 dopo il commit, senza ricreare voto o cooldown. Codice/test ai commit `8e811c8d76bbbbc36cf2e8fc1a1765cf670b9122`, `78a3bbdda9a8e2af1f7631e923df24bede3c335b`, `63cacdb3448aadc92d11fb95385a6d4cf0a9da46`. Sullo SHA finale sono passati 15/15 workflow pull_request, compreso PostgreSQL 17 temporaneo.

**Interpretazione rigorosa:** il test S3 dimostra soltanto l'isolamento tecnico delle operazioni sintetiche esaminate. Non attesta un'istanza DSAR reale, la cancellazione di ogni possibile copia/backup/log, la retention lecita dello storico delle pubblicazioni, la verifica dell'identità o la comunicazione all'interessato. S3 procedurale e DSAR-02..06 restano NO-GO. Prima di chiudere una richiesta reale occorrono un inventario dei sistemi/backup interessati, una decisione DPO documentata sulla conservazione residua, la prova privata dell'azione autorizzata e una risposta inviata tramite canale verificato.

## Controllo aggiuntivo della superficie DSAR (06/11/2026)

Contratto sintetico `api/tests/graziaVoteSchemaCache.synthetic.test.js`: il percorso personale `GET /api/grazia/mia-proposta` deve mantenere `personalNoStore`, `verifyToken`, il filtro `utente_id = $1` parametrizzato con `req.user.id` e una proiezione limitata a identificativo, stato e data. Il contratto impedisce di introdurre accidentalmente nel `SELECT` nome del soggetto, URL della prova, note o identificativo del proponente nella risposta. È un controllo statico sul sorgente, non un test di autorizzazione con token reali né una verifica di risposta GDPR. La CI sul commit che introduce il test va verificata separatamente; DSAR-02..06 e gate legali rimangono NO-GO.

## Prova sintetica S4 automatizzata (06/11/2026)

Aggiunto `api/tests/demos12DsarS4.synthetic.test.js` (commit `81de11633a7ba4f7ae3e121cce286a11f0563c82`) con esempi di calendario per 31 gennaio, febbraio bisestile, proroga motivata comunicata entro la scadenza ordinaria, proroga tardiva/non motivata e messaggio inviato ma non recapitato. La funzione del test è una **specifica sintetica isolata**, non un calcolatore giuridico in produzione e non un registro DSAR. La scelta di date mensili con ultimo giorno disponibile è una convenzione da convalidare giuridicamente, non una certificazione DPO. Il test non invia email, non interroga utenti o database e non modifica scadenze reali. La CI sul commit finale deve essere verificata separatamente; DSAR-05 e DSAR-02..06 restano NO-GO finché non esiste una prova operativa autorizzata.


## 06/11/2026 — S4: correzione validazione date e collegamento CI

- **Difetto verificato nel test sintetico precedente:** in `api/tests/demos12DsarS4.synthetic.test.js` la regex di input usava due backslash letterali per ciascun `\d` nella regex JavaScript. Di conseguenza non riconosceva nemmeno la data ISO valida `2027-01-31`. Il precedente HEAD `93a00c135acf80d84b69f07f9e15e8562893043b` aveva CI generale 15/15 SUCCESS, ma il file S4 non era esplicitamente eseguito nel workflow di moderazione: **quel verde non convalidava S4**.
- **Correzione della sola specifica sintetica:** `api/tests/demos12DsarS4.synthetic.test.js` ora controlla l'input con `/^\d{4}-\d{2}-\d{2}$/` e include casi negativi per `2027/01/31`, `2027-2-3`, `2027-02-30` e testo non-data, oltre agli scenari preesistenti di febbraio, proroga e ricevuta. Commit `e4dcb7135aab712ad0fb42cb597ff156ea5dafd7`.
- **Copertura CI resa obbligatoria:** `.github/workflows/civic-moderation-contracts.yml` include ora il file nei `paths` e lo esegue tramite `node --test api/tests/demos12DsarS4.synthetic.test.js` nella job di sicurezza/privacy. Commit `8930f13012e894ae1aabc315bba9d0c3645ffc3e`. Attendere gli esiti sul **nuovo HEAD dopo questo aggiornamento documentale**, non riciclare quelli dei commit precedenti. QA Node locale non disponibile da Desktop Commander (dispositivo offline); CI sul runner isolato è la fonte automatizzata.
- **Confini:** nessun codice applicativo o engine reale di scadenze DSAR modificato. Calcolo mesi del test illustrativo, da valutare legalmente; DSAR-02..06, retention, valutazioni DPO/GDPR, staging DEMOS10, Android fisico e release continuano NO-GO. Nessun dato personale reale, database, email, merge, deploy o feature flag toccato da questa correzione.


## 07/11/2026 — S4: rifiuto date di proroga malformate e comunicazioni premature

- **Difetto nel solo helper di prova**: la data `extensionNotified` era confrontata come stringa e non validata come data; una data inesistente, ma lessicograficamente precedente alla scadenza, poteva essere accettata in modo ingannevole. Anche una comunicazione precedente alla ricezione o una motivazione con soli spazi passava i controlli.
- **Correzione test sintetico**: commit `4041e1b55748b7bf68a08ed6b53064b5b1e1e8b5` su PR Draft #502. Validazione ISO reale della data di proroga, intervallo compreso tra ricezione e scadenza ordinaria, motivazione non vuota dopo `trim`. Test locale Node 22: 5/5 PASS, comprensivo di quattro date di notifica malformate, notifica prematura e motivo composto da spazi. Non è stato modificato alcun algoritmo applicativo o calendario GDPR operativo.
- **Stato probatorio**: la CI sul commit va verificata separatamente e la successiva HEAD può cambiare per contributi paralleli. Il test automatizzato resta una *specifica sintetica*, non una procedura DSAR operativa, una verifica della casella email o un'approvazione legale del computo dei termini.
- **NO-GO invariato**: DSAR-02..06, decisione DPO per artt. 5/6/9/10/14 e retention/DPIA secondo applicabilità, staging DEMOS10 e Android fisico. Nessun invio email, database reale, deploy o merge.


## 07/11/2026 — S4: rifiuto dei valori non booleani nella conferma di consegna

- Rilevato un falso positivo **nel solo test sintetico**: `Boolean(responseSent && delivered)` considerava consegnata una risposta con marcatori non booleani, ad esempio `responseSent:'false'` o `delivered:'false'`, perché stringhe non vuote sono truthy in JavaScript. Nessuna anomalia su una risposta DSAR reale è stata osservata.
- Commit [`6051bde63b00108c701f34b19f07e5e103f0fb7c`](https://github.com/Nictolas/DemosApp/commit/6051bde63b00108c701f34b19f07e5e103f0fb7c): verifica rigorosa `responseSent === true && delivered === true`; nuovo test per mancato invio, stringhe e numeri truthy. **Node 22 isolato: prima del fix 5/6 PASS (un test rosso), dopo il fix 6/6 PASS**; la verifica CI dello SHA pubblicato va riletta separatamente.
- Non è un sistema DSAR in produzione e un valore booleano fittizio non costituisce una ricevuta: la prova reale di invio/consegna e la gestione di mancati recapiti richiedono il registro privato autorizzato e approvazione DPO. **DSAR-02..06, artt. 5/6/9/10/14, retention/informative, eventuale DPIA, staging DEMOS10, Android fisico e rilascio: NO-GO**. Nessuna email, SQL reale, deploy o merge.


## 07/11/2026 — S4: confine d'anno e notifica all'ultimo giorno

- Verificato sul commit `e355e3003adaa5facf0f3a890cca0a2145b90488` l'esito GitHub Actions: **15/15 workflow pull_request completati SUCCESS**, incluso `Civic privacy and moderation contracts`. La verifica vale per quello SHA, non per commit successivi.
- Nuovo caso sintetico nel commit `a8945851deb443b1dce386d931b98ff755826d73`: ricezione 31/12/2026, scadenza ordinaria 31/01/2027, notifica di proroga il giorno di scadenza vs. il giorno dopo, scadenza illustrativa prorogata 31/03/2027; nessuna consegna dichiarata se i flag sono false. Non eseguito localmente in questa esecuzione: attendere la CI sul nuovo HEAD. Il computo dei termini rimane illustrativo e soggetto a validazione legale.
- DSAR-02..06 e prova di ricezione della casella privacy, verifica identità, rettifica, consegna effettiva, retention, artt. 5/6/9/10/14, eventuale DPIA, staging coordinato DEMOS10 e Android fisico restano **NO-GO**. Nessuna operazione su caselle email, dati reali, database o release.


## 07/11/2026 — Mandato operativo DPO: decisioni procedurali e gate giuridici separati

**Perimetro dell'autorizzazione ricevuta in chat:** il DPO/Admin di DEMOS ha autorizzato a procedere con *tutto il lavoro DPO* relativo a DEMOS 12. Questa è autorizzazione a predisporre e migliorare istruzioni, controlli tecnici isolati e documentazione; **non** è una firma attestante la liceità di ogni trattamento, una DPIA approvata, una prova di funzionamento su casi reali o un permesso implicito per invii di email, staging condiviso, migrazioni, dati reali, merge o deploy. La PR resta Draft.

### Regole operative approvate come impostazione prudenziale per il lavoro tecnico

1. **Registro DSAR-02:** ogni richiesta va protocollata in un archivio *privato con accessi limitati*, usando un identificatore pseudonimo e le sole date, categoria, assegnatario, stato, termine e riferimento alla prova privata. Non archiviare in GitHub o Google Sheet tecnici nomi, indirizzi, contenuti giudiziari, preferenze di voto, URL riferibili a persone o documenti di identità.
2. **Identità DSAR-03:** preferire verifica tramite account già autenticato o canale già associato. Richiedere elementi ulteriori soltanto quando vi siano ragionevoli dubbi, in modo proporzionato; non raccogliere automaticamente fotografie di documenti. Un terzo non verificato non deve ottenere conferma dell'esistenza di voti, candidature o richieste riferite ad altri.
3. **Decisione DSAR-04:** distinguere i dati del proponente (`richieste_grazia`), la pubblicazione nel catalogo (`grazia_carcerati`), i voti privati (`voti_grazia`), i cooldown e le notifiche. La rettifica di un nome pubblico e la cancellazione di un voto personale non sono lo stesso procedimento; lo storico/audit non va conservato indiscriminatamente né eliminato senza decisione motivata per finalità e base giuridica. Eventuali interventi reali sono esclusi da questo mandato tecnico e richiedono autorizzazione esecutiva specifica.
4. **Termini DSAR-05:** registrare il termine ordinario di un mese dalla ricezione; una proroga fino a due ulteriori mesi richiede le condizioni dell'art. 12(3) e comunicazione motivata entro il primo mese. Distinguere risposta predisposta, inviata e ricevuta/consegna verificabile; non segnare `delivered` senza prova, né presumere sospensioni automatiche.
5. **Chiusura DSAR-06:** registrare decisione, operatore, data, prova di invio/consegna disponibile, motivazioni delle eventuali esclusioni e piano di cancellazione del fascicolo. La durata del fascicolo DSAR e delle copie di backup resta da motivare in una politica di retention dedicata; niente valore numerico scelto arbitrariamente.

### Esame di liceità per superfici distinte — NON un'assoluzione generale

| Trattamento | Valutazione conservativa | Decisione / condizione per il GO |
| --- | --- | --- |
| Proposte pubbliche Attivisti/Organizzazioni | Dati di terzi e possibili indizi di opinioni/associazioni politiche (artt. 5, 6, 9); art. 14 se dati non raccolti dall'interessato. | Documentare titolare, finalità, base per ciascuna categoria, provenienza, necessità, informativa o eccezione concreta e gestione opposizione/rettifica; non derivare una base valida dalla sola fonte online. |
| Proposte Grazia (`nome`, `url_prova`) e catalogo visibile in pagina Grazia | Non è dimostrato che *ogni* nominativo sia dato giudiziario; tuttavia il contesto può rivelare condanne o reati anche senza descriverli. Quando si applica art. 10, art. 6 o consenso non lo sostituiscono: occorre una specifica autorizzazione normativa e garanzie appropriate ai sensi dell'art. 10 GDPR e 2-octies del Codice. | **NO-GO giuridico mirato per pubblicazione di nuovi nominativi** finché non si documentano il contenuto concreto, la norma autorizzativa quando applicabile e le garanzie. Non inferire che il mero link a notizia pubblica autorizzi il trattamento. Mantenere i gate tecnici fail-closed. |
| Preferenza personale di voto Grazia | Voto/adesione attribuibile all'utente; possibile inferenza su orientamenti personali. Art. 9 va valutato sul contenuto concreto e sul contesto; consenso politico già previsto nel codice non costituisce prova generale di validità. | Conservare isolamento tra account e minimizzazione; verificare informativa specifica, prova e revoca del consenso ove necessaria, accesso e cancellazione secondo finalità. |
| Avvisi amministrativi e log | Metadati o contenuti possono ricollegare utenti e proposte. | Testi generici senza nomi, ridurre identificatori e controllare anche retention/copie; verificare su sistema autorizzato prima del GO. |

### DPIA e responsabilità della decisione

La combinazione di dati politici, nominativi di terzi e possibile rivelazione di informazioni giudiziarie impone **screening DPIA documentato** ai sensi dell'art. 35 prima dell'eventuale nuova pubblicazione/rilascio. Per prudenza progettuale preparare una DPIA completa; l'eventuale decisione di non eseguirla richiede motivazione del titolare dopo screening. Non è sufficiente un flag CI. Separare in modo esplicito il parere DPO dalla decisione e responsabilità del titolare (artt. 5(2), 24, 35, 39). Nessun parere individualizzato sulla norma che autorizza un eventuale trattamento ex art. 10 è attestato qui.

### Gate e prossima evidenza richiesta

- **Procedura tecnica / istruzioni:** DEFINITE PER LA PREPARAZIONE, da esercitare su casi fittizi S1–S5 e verificare con evidenze private; non etichettare DSAR-02..06 come PASS.
- **DSAR-01:** prova limitata di recapito tecnico già documentata; non effettuare nuovi invii senza autorizzazione espressa.
- **Giuridico:** RICHIEDE valutazione specifica delle basi e dell'art. 10, informativa art. 14 quando applicabile, retention e screening/DPIA con approvazione finale motivata.
- **Staging e Android fisico:** NON AUTORIZZATI da questo mandato DPO; coordinare con DEMOS 10 e operatore dispositivo.
- **Release:** NO-GO. Baseline 98% tecnica / 82% preparazione rilascio invariata sino a prove ulteriori.

**Fonti normative da consultare per ogni decisione specifica:** Reg. (UE) 2016/679 https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679 (artt. 5, 6, 9, 10, 12–14, 17, 25, 35, 39); Codice privacy, art. 2-octies https://www.normattiva.it/atto/caricaDettaglioAtto?atto.articolo.numero=2&atto.articolo.sottoArticolo=1&atto.articolo.tipoArticolo=0&atto.codiceRedazionale=18G00129&atto.dataPubblicazioneGazzetta=2018-09-04 .


## 07/11/2026 — Lettura personale Grazia: token di accesso obbligatorio

- **Difetto accertato nel sorgente precedente:** `GET /api/grazia` accettava qualsiasi JWT con firma valida sotto `JWT_SECRET` tramite `jsonwebtoken.verify`, senza convalidare `type='access'`, `issuer`, `audience` né richiedere il prefisso `Bearer `. Poiché lo stesso secret è previsto anche per i token `oauth_pending`, il percorso poteva tentare letture personali con un token firmato di registrazione non completata o con un header non conforme. La rotta restava pubblica per il feed; non è stata dimostrata un'esposizione di dati personali reali né una lettura effettiva con token OAuth.
- **Correzione sul solo ramo Draft #502:** commit `42d11e1b680d0f04f256cf0e6856ecab77f225b3` sostituisce la verifica generica con `verifyAccessToken` dal modulo comune `api/utils/jwt.js` e richiede l'header `Bearer ` prima di risolvere `userId`. Token non validi/non-accesso mantengono visibile solo la classifica aggregata senza leggere `mieiVoti` o cooldown; le richieste anonime legittime restano invariate.
- **Regressione isolata:** commit `b601d5067973260dca79f252af829d53598214c9` estende `api/tests/graziaVoteReadEfficiency.synthetic.test.js` con casi per token raw, Basic, refresh, OAuth-pending, Bearer vuoto e token malformati: nessuna query ai voti personali o cooldown. Il file è già incluso nel workflow `Civic privacy and moderation contracts`. **Esecuzione CI sul nuovo HEAD da verificare**. Il computer Desktop Commander risulta offline, perciò in questa esecuzione non è disponibile il test locale sul dispositivo.
- **Limiti:** `verifyAccessToken` valida firma, scadenza, tipo, issuer e audience; non equivale a una verifica della revoca della sessione o dello stato dell'account tramite middleware autenticato. Questa correzione non supera DSAR-02..06, basi giuridiche, rischio art. 10 nella pubblicazione di nominativi, art. 14, retention, DPIA, staging DEMOS10 o Android fisico. Nessun deploy, SQL reale, invio email, merge o modifica di flag.


## 07/11/2026 — PostgreSQL17: fixture allineata alla verifica JWT di accesso

- Sul commit `b601d5067973260dca79f252af829d53598214c9` la job `security-contracts` è **SUCCESS**, ma `postgres-concurrency` del workflow `Civic privacy and moderation contracts` è **FAIL**: il GET con token sintetico `Bearer a` ha restituito `mieiVoti=[]` invece del voto atteso. La causa è nella *fixture del test*: essa intercettava `jsonwebtoken` sul router, che dopo il fix JWT usa `../utils/jwt.verifyAccessToken`. Non equivale a un leak né a un errore dimostrato sul database reale.
- Commit `a08120b81537f06263fdeed37087a69f457ab743`: aggiornata la fixture del solo test `api/tests/graziaPostgresConcurrency.integration.test.js` per intercettare il verificatore di accesso condiviso e ammettere soltanto le identità fittizie A/B. Il PG17 del workflow rimane effimero, con guardia locale `127.0.0.1:5432/demos_civic_ci` e `CIVIC_TEST_MODE=isolated-synthetic`. **CI nuovo HEAD da verificare** senza attribuirgli i PASS dei vecchi SHA.
- Gate indipendenti invariati: DSAR-02..06, articolo 10 contestuale per Grazia, informativa art. 14 se pertinente, retention e DPIA, staging coordinato DEMOS10, Android fisico e rilascio. Nessun merge/deploy/SQL su database reali.


## 07/11/2026 — Account inattivo e letture private Grazia

- **Problema riscontrato nel codice:** dopo la correzione del tipo di JWT, `GET /api/grazia` accettava comunque un token di accesso firmato per leggere `mieiVoti` senza controllare che l'account fosse ancora attivo. Un token non ancora scaduto può persistere dopo sospensione, e una query ai voti individuali non deve basarsi soltanto sulla firma. Non è stata verificata un'esposizione su utenti reali.
- **Fix fail-closed sul solo Draft:** commit `b3096683de794342e4da16f18048e13633709569`. La query personale esegue **in una sola richiesta SQL** un controllo di `users.status='a'` con `EXISTS` e `LEFT JOIN LATERAL`. Se l'account non è attivo/non esiste, `mieiVoti=[]`, `blocco` neutro e nessun accesso al cooldown; la classifica pubblica resta disponibile. Se l'account è attivo ma non ha voti, la riga `LEFT JOIN` conserva il comportamento del cooldown. Metadati delle colonne voti continuano a essere cachati, senza dati utente.
- **Test creati, da convalidare con CI sul HEAD:** `api/tests/graziaVoteReadEfficiency.synthetic.test.js` commit `99adb599565aafd6e0e798269f0d10338669a2f8` verifica account sospeso con assenza di dati personali e assenza di una query SQL supplementare; `api/tests/graziaPostgresConcurrency.integration.test.js` commit `585331fb2ced29325594249df2968fdc2a0d2070` cambia lo stato dell'account B **solo nel PostgreSQL 17 temporaneo** e controlla che, pur avendo voti fittizi, non li riceva finché sospeso; ripristina lo stato del fixture prima di proseguire. Il test PG17 rifiuta URL diversi dal suo container locale.
- **Limite di sicurezza:** la verifica dello stato al momento della query non prova da sola la revoca di tutte le sessioni, l'assenza di dati in altre cache/backup o una procedura DSAR completa. Senza esiti GitHub sullo SHA esatto, il fix è preparato ma non validato. Nessun trattamento di dati reali, nuove credenziali, staging, email, merge o deploy.
- **Release gate:** DSAR-02..06, trattamento dei dati di terzi (artt. 5/6/9/10/14 secondo applicabilità), DPIA/retention/informative, collaudo DEMOS10, Android fisico e autorizzazione al rilascio restano NO-GO. Baseline prudente 98% tecnico / 82% preparazione al rilascio.


## 07/11/2026 — Dual opt-in Grazia: prova HTTP del blocco di pubblicazione

- **Audit del codice PR #502:** il blocco delle nuove nomine Grazia era già applicato in due punti distinti: richiesta utente (`POST /api/grazia`) e accettazione Admin (`POST /api/grazia/richiesta/:id/accetta` e alias `approve`). Richiede simultaneamente le due stringhe esatte `DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED='true'` e `DEMOS_GRAZIA_NOMINATIONS_ENABLED='true'`; altrimenti risponde HTTP 503 senza scrivere sul database. Rifiuto/ritiro restano consentiti. **Nessun flag di alcun ambiente è stato attivato.**
- **Lacuna di verifica colmata:** commit `706b753b09f301134bdf39f5ceddd7a786f3bb7e` modifica solo `api/tests/graziaModerationHttp.synthetic.test.js`, già incluso nel workflow di regressione privacy. Il test usa il router Express reale e un pool fittizio; con funzione disabilitata prova (1) nessuna persistenza di nuova proposta, (2) nessuna approvazione Admin in entrambi gli alias, (3) status 503 con `private, no-store`, (4) assenza di collegamento SQL se il pool è offline e (5) rifiuto Admin ancora possibile per una proposta sintetica creata quando il flag era abilitato. Inoltre verifica direttamente che il gate di produzione richieda le due stringhe esatte, senza inferire autorizzazione da uno solo dei flag.
- **Interpretazione:** è una regressione *sintetica* del fail-closed prima dell'attivazione. Non autorizza nuove nomine reali; l'eventuale liceità ex artt. 5, 6, 9, 10 e 14 GDPR e il possibile obbligo di DPIA restano da documentare specificamente. **CI sul nuovo HEAD da verificare**; non usare i 15/15 PASS del precedente `4a74840c` per questo commit. Non eseguiti test sullo staging DEMOS10, email, DB reale o Android; nessun merge/deploy.


## 07/11/2026 — Voto Grazia sospesi: blocco transazionale della scrittura personale

- **Rischio identificato dal sorgente:** `GET /api/grazia` bloccava la lettura di `mieiVoti` per account inattivi, ma il percorso `POST /api/grazia/vota` verificava solo l'esistenza dell'account tramite `SELECT id FROM users WHERE id::text=$1 FOR KEY SHARE`. `FOR KEY SHARE` non impedisce un cambio del campo `status` e non filtra utenti sospesi. Un JWT ancora firmato e stato auth eventualmente in cache potevano così non essere sufficienti a impedire un voto/cooldown dopo la sospensione. **Non è dimostrato alcun evento o uso con dati reali**.
- **Correzione circoscritta a PR #502 Draft**: commit `40be085d3d5311c4b2f88c90d906660094384874` sostituisce la verifica iniziale di scrittura con `SELECT id FROM users WHERE id::text=$1 AND status='a' FOR SHARE` nella **stessa** transazione e nello **stesso** round trip SQL. L'uso di `FOR SHARE` serializza la lettura con gli aggiornamenti del campo status e con la cancellazione account; se la sospensione vince la corsa il POST ritorna 401 senza leggere i voti, senza scriverli e senza creare cooldown. Nessuna modifica ai token, schema, account o API pubblicate.
- **Regressioni isolate**: commit `7201828c60f7b0032710b712fa5eeb084ee753ec` amplia `graziaVoteSchemaCache.synthetic.test.js` col rifiuto di un utente presente ma inattivo, con assenza di query private, scritture e cooldown; mantiene il controllo dell'ordine dei lock. Commit `16eee9ce0b34431ab70c6a70e7f738381f5376ed` amplia `graziaPostgresConcurrency.integration.test.js`: il database Postgres 17 del workflow è usa-e-getta; durante la sospensione fittizia di B, un POST di voto deve tornare 401 senza modificare il voto preesistente o creare cooldown; il test di cancellazione concorrente cerca il lock `FOR SHARE`.
- **Da verificare**: risultato CI esatto del nuovo HEAD (soprattutto `Civic privacy and moderation contracts` `security-contracts` e `postgres-concurrency`). I 15/15 PASS del precedente `792bdc32` non convalidano questa modifica. Non sono stati effettuati test con credenziali, app Android o account reali.
- **Gate**: DSAR-02..06, art. 5/6/9/10/14 in base ai trattamenti concreti, retention, informative, screening/DPIA, staging DEMOS10, Android fisico e rilascio NO-GO. Stime 98% tecnico / 82% rilascio invariate. Nessuna operazione su SQL reale, staging, flag, email, merge o deploy.


### Estensione: invio proposta Grazia da account sospeso

- **Lacuna aggiuntiva (stesso scenario di token auth in cache):** `POST /api/grazia` per la nomina privata otteneva il lock dell'account con `SELECT id FROM users WHERE id = $1 FOR UPDATE`, senza verificare `status='a'` in tale transazione. Anche se il flag di pubblicazione rimane NO-GO, un account sospeso con credenziali cached poteva tentare una nuova proposta. Nessun caso reale dimostrato.
- **Fix sul ramo Draft e nessuna nuova query:** commit `d7439ad7e3bfb3a9d86e8b1eda9d4291dc2f1375` aggiunge il predicato `AND status='a'` allo stesso `SELECT ... FOR UPDATE`. Il rifiuto 401 avviene prima della lettura dei nomi pregressi, del controllo di unicità e dell'inserimento; nessuna notifica amministrativa viene generata da questa richiesta.
- **Evidenze verificabili:** `d61c4a09fe3f391f203813de6fd7161c29c89769` allinea i contratti statici del lock/ordine; `2b7919ecd094275a93a055fe451a20d7bf6129f0` verifica tramite router HTTP sintetico che la richiesta sospesa non crea proposte o notifiche; `36b51b055213ba187dbd70ce52e3727b99c66b9a` verifica lo stesso caso nel PostgreSQL 17 effimero, durante la sospensione B già usata per testare il rifiuto dei voti. **CI sul nuovo SHA ancora da verificare**: nessun PASS inventato.
- **Limiti:** non revoca la sessione in cache per le altre API DEMOS; copre questi due percorsi di scrittura Grazia solo se la PR Draft verrà eventualmente rilasciata dopo gate DPO, DSAR, staging DEMOS10 e Android. Non sono state effettuate azioni su account, voti o pubblicazioni reali.


## 07/11/2026 — GET stato proposta generica: account sospeso con sessione in cache

- **Rischio dal codice, non da utenti reali:** `GET /api/subject-proposals/mine?category=...` dipendeva da `verifyToken`, il cui soggetto autenticato può essere servito da cache. Una sessione ancora valida, ma riferita a un account sospeso successivamente, poteva leggere `id`, `status`, `created_at` e `reviewed_at` della proposta privata. Non è stata osservata alcuna divulgazione reale.
- **Correzione circoscritta:** commit `b04b87b303eaad4bb421cc11e76732a6bae15399` nel ramo Draft #502. La SELECT di `/mine` include un `JOIN users` con `status='a'`; il controllo avviene **nella stessa query**, senza roundtrip SQL aggiuntivo. Un account non attivo restituisce `{success:true,pending:null,latest:null}` e mantiene `Cache-Control: private, no-store`, senza confermare l'esistenza della proposta; un account attivo conserva il formato. L'ordinamento aggiunge `id DESC` per determinismo a timestamp identici. Restano invariati autenticazione, query parametriche, altre route, DB e flag.
- **Test PostgreSQL17 soltanto sintetico:** commit `990f124705451b88501f3ac502a60e911e20b8e7` nel file `api/tests/subjectProposalLifecycle.pg.integration.test.js`, già eseguito dalla job `postgres-concurrency` del workflow `Civic privacy and moderation contracts`. Usa l'account fittizio B con proposta esistente, porta `users.status` a `x` lasciando valido il JWT fittizio e verifica risposta neutra, no-store e nessuna divulgazione. Dopo ripristino `status='a'`, verifica che B possa leggere il proprio stato `rejected`. Nessun profilo reale, staging DEMOS10, produzione o email sono coinvolti.
- **Esito:** codice e test committati; **verificare il risultato CI sull'HEAD esatto dopo questo aggiornamento**. Non attribuire a questi commit i workflow verdi della baseline precedente `0ac38290`. Il test non prova la revoca universale di cache/sessioni e non copre automaticamente la separata route `GET /api/grazia/mia-proposta`, da valutare in una successiva correzione specifica.
- **Gate invariati:** DSAR-02..06 operativi, valutazione concreta delle basi giuridiche e informative per i dati di terzi (artt. 5/6/9/10/14 secondo applicabilità), retention/DPIA, collaudo staging DEMOS10, Android fisico e autorizzazione distinta al rilascio. Consenso DPO generale ricevuto in chat, non prova di adempimento. Nessun merge, deploy, migrazione, feature flag o dato reale toccato.


## 07/11/2026 — CI attestata sulla correzione GET /mine

- **GitHub verificato sui commit esatti:** `489aedfee3ae4e72ae7a247bd6a9ae6ada29045c` (codice + test + runbook) ha **15/15 workflow pull_request COMPLETED SUCCESS**, zero fail/pending. Nel workflow Civic privacy and moderation run `42351496178` sono SUCCESS i job `security-contracts`, `postgres-concurrency` (test PostgreSQL 17 sintetico delle proposte) e `frontend-build`.
- Anche la successiva HEAD concorrente `fdf5667c92237c749cddad28606897609017bcf8`, con modifiche autonome ai file Grazia senza sovrapposizione al GET generico, ha **15/15 workflow PR SUCCESS**. Civic run `42351507892`, stessi tre job SUCCESS. La verifica va ripetuta se un nuovo commit modifica il ramo.
- Questo PASS non certifica gestione DSAR effettiva, procedure legali o diritto di pubblicare nominativi di terzi, staging DEMOS10 o Android fisico. La PR resta Draft e tutti i gate di rilascio pertinenti rimangono NO-GO. Nessun merge, deploy, email, query reali o flag.


## 07/11/2026 — Grazia: stato proposta privata dopo sospensione dell'account

- **Lacuna verificata nel codice (non incidente reale):** `GET /api/grazia/mia-proposta` era autenticata e `personalNoStore`, ma `verifyToken` può temporaneamente basarsi su una cache di account precedentemente attivo. La SELECT su `richieste_grazia` filtrava soltanto `utente_id`; con JWT ancora valido per un account sospeso poteva quindi rivelare ID/stato/data della precedente proposta.
- **Correzione nel solo ramo Draft:** commit `b2cc7b770050e90a3b065077e4ef8c2cde2c26e3` modifica una SELECT in `api/routes/grazia.js`: `AND EXISTS (SELECT 1 FROM users WHERE id::text = $1::text AND status = 'a')`. Il controllo avviene **nello stesso statement SQL**, senza query aggiuntiva, restituendo la stessa risposta privata neutra `{success:true,richiesta:null}` per account sospeso. Un account attivo conserva la proiezione limitata `id,status,data_creazione` e `Cache-Control: private, no-store`; a pari timestamp l'ordinamento usa `id DESC`. La query resta parametrizzata.
- **Regressione HTTP sintetica:** commit `6eb1db756c2c06d875db7010768b7a3c20e774c5` in `api/tests/graziaModerationHttp.synthetic.test.js` usa router Express reale, utente A fittizio, JWT stub ancora valido e pool simulato. Prima della sospensione verifica la propria proposta; durante `status='x'` verifica risposta neutra e no-store con **una sola SELECT**; dopo la riattivazione verifica la forma precedente. Lo stub richiede esplicitamente il predicato SQL di account attivo, così la regressione fallisce se viene rimosso.
- **Contratto di minimizzazione:** commit `9791a3e81d897a7a6771f5517260fca2fbce3196` in `api/tests/graziaVoteSchemaCache.synthetic.test.js` estende la verifica di proiezione limitata per impedire la rimozione silenziosa del controllo di stato. Entrambi i test sono già previsti dal workflow `Civic privacy and moderation contracts`; non è necessaria modifica della CI.
- **Stato prove al commit del test:** 15 workflow pull_request avviati sullo SHA `9791a3e81d897a7a6771f5517260fca2fbce3196`, inizialmente ancora in attesa; **non attribuire a questo SHA** il verde della baseline `84d01eef`. Nessun test locale, account reale, database Supabase, email o staging DEMOS10 utilizzato. Verificare sullo SHA finale l'effettivo completamento dei test e aggiornare l'evidenza.
- **Gate:** DPO ha approvato il proseguimento delle misure; ciò non dimostra DSAR-02..06 operativi né liceità e informativa dei dati di terzi, retention/DPIA (se dovuta), test su Android fisico, staging unificato o autorizzazione release. **NO-GO** e PR Draft invariati; nessun merge, deploy, migrazione o feature flag.


## 07/11/2026 — Revoca dei permessi Admin con modello account in cache

- **Difetto concreto nel codice, non violazione accertata:** `api/middleware/auth.js` accettava il modello account completo da Redis con `status='a'` e `capabilities.isAdmin=true`. Se nel frattempo il ruolo Admin veniva revocato, l'utente sospeso o l'account eliminato, `verifyToken` poteva continuare a impostare `req.user.isAdmin=true` fino alla scadenza della cache. Il successivo `requireAdmin` controllava solo questo valore e non interrogava lo stato corrente. Il perimetro include le route di moderazione DEMOS12 che usano `requireAdmin`.
- **Correzione minima sul ramo Draft:** codice `e83642cb89ef1212701874a4aada13a9531cca62`. `verifyToken` distingue un modello account caricato dalla cache (`req.authSubjectFromCache=true`) da uno appena letto nel DB. Quando `requireAdmin` vede un utente Admin con attributi **da cache**, chiama `getAccountSubject(pool,req.user.id)` bypassando la cache e richiede **sia** `status='a'` **sia** `capabilities.isAdmin===true`. Sospesi, eliminati, declassati non sono autorizzati e ricevono 403 generico. Errori DB non aprono accesso (500 generico); nessuna eccezione/ID in log o risposte. La verifica su cache miss non aggiunge una seconda query; i soli accessi Admin tramite cache richiedono una query fresca, costosa ma necessaria per l'autorizzazione.
- **Test sintetico:** commit `f848fe19907e6887c7f59a7d4a0b85b1a9f8f9db` nel contratto esistente `api/tests/d12AuthMiddlewarePrivacy.synthetic.test.js` già eseguito dalla CI Civic privacy/moderation. VM con JWT e Redis fittizi: cached Admin declassato, sospeso, eliminato, lookup fallito, cached Admin ancora valido e Admin senza cache; controlla l'assenza di PII/log, negazione fail-closed e una sola query fresca totale per ogni accesso Admin. **Non prova la revoca reale Redis/DB o un test Android**.
- **Stato CI:** all'inserimento, 15 workflow PR avviati sullo SHA del test `f848fe19`, nessun esito verde ancora verificato. Controllare il nuovo SHA dopo il commit documentale; **non riutilizzare i 15/15 verdi della baseline** `fed14fed`.
- **Gate e limiti:** il DPO ha autorizzato le misure ma non sono conclusi DSAR-02..06 operativi, valutazioni giuridiche su basi informative e dati di terzi, retention/DPIA, collaudi su staging unificato DEMOS10 e Android fisico, né autorizzazione separata al merge/deploy. Non sono stati toccati account reali, database reale, produzione, staging, feature flag, migrazioni o email.
