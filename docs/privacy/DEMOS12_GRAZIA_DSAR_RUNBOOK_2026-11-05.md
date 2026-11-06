# DEMOS 12 — Gestione delle richieste sui soggetti pubblicati (Grazia e directory)

**Stato al 5 novembre 2026: BOZZA OPERATIVA / NON VALIDATA / NO-GO.** Documento per definire e testare un processo, non una certificazione di conformità. Non abilita nuove raccolte, non modifica database, log, flag o canali email. Applicabile alle proposte di Grazia, Attivisti e Organizzazioni; valutare separatamente Capo di Stato e Amnistia.

## Canale e responsabilità

- Canale proposto e già mostrato nell'interfaccia DRAFT: `privacy@demos.community`. **Non è stata verificata in questo intervento la ricezione di messaggi, la loro consegna al responsabile, l'accesso autorizzato alla casella né un'eventuale risposta automatica.**
- La persona che presenta la richiesta non deve includere inizialmente documenti d'identità, condanne, referti, preferenze di voto o altri dati sensibili. Il `mailto:` non precompila titolo, URL, ID utente, nome né contenuto del reclamo.
- Il titolare del trattamento deve designare l'operatore responsabile del primo riscontro e della gestione dei casi, con escalation verso DPO/legale. Non è assegnato automaticamente nessun ruolo.
- Fino alla validazione operativa, mantenere disabilitati `DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED` e `DEMOS_GRAZIA_NOMINATIONS_ENABLED` nei servizi con dati reali.

## Processo da approvare e collaudare

1. **Ricezione.** Effettuare un test autorizzato con messaggio sintetico e non personale indirizzato a `privacy@demos.community`; dimostrare ricezione nella casella corretta, accesso del responsabile e risposta di prova. Verificare anche spam/inoltri e assenza di diffusione ad altri utenti. **Gate aperto fino a prova reale.**
2. **Registrazione minima.** Creare, in sistema ad accesso ristretto da approvare dal DPO, un identificativo interno di pratica, data di ricezione, tipo richiesta, stato, assegnatario, scadenze e azioni. Non mettere nomi, fonte giudiziaria, URL nominativi o documenti di identità nei titoli delle attività, log tecnici, notifiche o Google Sheet di progetto. Luogo di archiviazione, accessi e retention del registro sono **da decidere**.
3. **Identificazione proporzionata.** Distinguere l'account proponente dalla persona terza nominata: l'accesso DEMOS del primo **non prova** l'identità o la rappresentanza della seconda. Usare eventuali mezzi di autenticazione già esistenti quando appropriati; chiedere informazioni aggiuntive solo in presenza di ragionevoli dubbi, in modo proporzionato e tramite canale sicuro. Non richiedere automaticamente copia di documento via email ordinaria. Eventuali richieste di accesso a dati di terzi restano bloccate finché non sia verificata la legittimazione.
4. **Triage urgente.** Se la segnalazione prospetta danno immediato, trattamento di dati giudiziari/particolari, errore di persona o pubblicazione non autorizzata, segnalare subito a chi è autorizzato a valutare una sospensione cautelativa. L'Admin dispone già di percorsi di ritiro DRAFT: verificarne l'esito reale prima di rispondere all'interessato. La rimozione dal catalogo non garantisce cancellazione di copie esterne, motori di ricerca o cache di terzi.
5. **Decisione motivata.** Il DPO/legale definisce caso per caso rettifica, ritiro, limitazione, opposizione o risposta negativa, insieme alla base giuridica e al perimetro dei dati coinvolti. Non dichiarare una cancellazione totale se permangono audit, voti storici o backup; distinguere disattivazione pubblica, correzione di contenuti e cancellazione dati.
6. **Risposta.** Informare l'interessato senza ingiustificato ritardo e, di norma, entro **un mese dalla ricezione**. L'eventuale proroga di altri due mesi nei casi previsti va comunicata entro il primo mese, con motivazione. Se non si dà seguito, comunicare motivi e rimedi pertinenti. Non allegare automaticamente dati di altri utenti o informazioni giudiziarie.
7. **Chiusura ed evidenza.** Verificare con dati sintetici che il soggetto ritirato non ricompaia in Grazia o nelle directory e che un aggiornamento della pagina non ripubblichi contenuti obsoleti. Registrare solo esito, data e riferimenti tecnici non identificativi nel tracker DEMOS. La prova di gestione operativa deve restare presso il responsabile autorizzato con accesso ristretto e tempi di conservazione da approvare.

## Test di accettazione (non ancora eseguiti)

| Test | Criterio di superamento | Stato |
| --- | --- | --- |
| DSAR-01 Ricezione | Email sintetica consegnata a casella e responsabile corretti, con evidenza autorizzata | NON VERIFICATO |
| DSAR-02 Riscontro | Primo riscontro ottenuto sul canale autorizzato senza trasmettere dati di terzi | NON VERIFICATO |
| DSAR-03 Identità | Simulazione di richiesta da proponente, persona segnalata e soggetto non autorizzato, senza divulgazione | NON VERIFICATO |
| DSAR-04 Ritiro | Ritiro amministrativo sintetico persistente e catalogo aggiornato, senza dipendere dalla notifica | SOLO TEST DI CODICE / STAGING DA VERIFICARE |
| DSAR-05 Tempi | Registro pratica con scadenza e gestione delle proroghe verificato senza dati personali nei tracker | NON VERIFICATO |
| DSAR-06 Conservazione | DPO approva policy di audit, email, allegati, eventuale correzione e backup | DECISIONE APERTA |

## Separazione dalle protezioni già implementate

- Il nuovo contatto nella **classifica Grazia** e quelli presenti nelle directory **Attivisti/Organizzazioni** sono una protezione di accessibilità: **non** provano ricezione, autenticazione, rettifica effettiva o conformità.
- Nessuna nuova tabella, endpoint di raccolta DSAR, lettura SQL nella navigazione o registrazione automatica di dati di terzi è introdotta da questo runbook.
- Gate legali GDPR 5/6/9/10/14, informative, DPIA se dovuta, retention, test staging DEMOS 10, Android fisico, merge, deploy e attivazione restano **NO-GO**.

## Fonti normative

- Commissione europea, *Dealing with requests from individuals*: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en
- EDPB, *Guidelines 01/2022 on data subject rights – Right of access*, versione 2.0: https://www.edpb.europa.eu/system/files/2023-04/edpb_guidelines_202201_data_subject_rights_access_v2_en.pdf
- Regolamento (UE) 2016/679, artt. 12, 15–22: https://eur-lex.europa.eu/eli/reg/2016/679/oj

## Verifiche tecniche successive — 05/11/2026

- La pagina Grazia e gli avvisi del salvataggio voto non mostrano più `error.message` né un errore API arbitrario: gli errori di trasporto e le risposte `success:false` vengono ricondotti a testi neutri. Questo evita che un messaggio server contenente nominativi, query SQL o preferenze politiche sia riprodotto sullo schermo; non costituisce un audit completo degli altri endpoint.
- Il contatto per rettifica è riutilizzato anche nel fallback della pagina quando il `GET /api/grazia` non riesce. In modalità normale resta disponibile tanto con classifica popolata quanto vuota; nessuna query SQL aggiuntiva.
- Test sintetici: `api/tests/d12GraziaPersonalCacheIsolation.synthetic.test.js` include errori fittizi con dati privati e verifica che React Query e toast non li riflettano. `api/tests/d12GraziaPrivacyContact.contract.test.js` blocca la reintroduzione di stringhe backend e garantisce il contatto anche nell'errore. `scripts/test-grazia-privacy-browser.cjs` usa **Chrome** con API sintetiche locali, 320×568/390×844, scenari classifica vuota, popolata, errore 503; blocca richieste esterne. CI nel workflow Unified. Il superamento delle verifiche deve essere attestato sull'ultimo SHA prima di segnare i test PASS.
- **Nessun accesso alla casella di destinazione**: le credenziali Gmail collegate non costituiscono prova di controllo del recapito `privacy@demos.community`. Nessuna email di prova è stata inviata e nessuna evidenza di consegna o riscontro è stata acquisita. **DSAR-01 e DSAR-02 rimangono NON VERIFICATI.**
- Nessun merge, deploy, modifica a produzione/staging o abilitazione delle nomine viene autorizzata da questa sezione.

## 06/11/2026 — Errori amministrativi Grazia e proposte

**Perimetro tecnico della PR Draft.** In `client/src/pages/GestisciGrazia.tsx` i tre caricamenti Admin (richieste pendenti, pubblicate, avvisi di ritiro), le mutazioni di approvazione/rifiuto e il ritiro ora restituiscono **messaggi di errore fissi**: non mostrano `error.message`, `err.message`, `data.error`, dettagli SQL, nomi di persone o risposte grezze dal server. La pagina delle richieste non stampa più la proprietà `error.message` durante il caricamento fallito. Anche il vecchio handler di proposta in `useGraziaVoting.ts`, pur non usato dal form principale attuale, non riporta più eccezioni API nei toast. Successi, categorie, autorizzazione Admin, paginazione, effetto dei ritiri e loro audit rimangono invariati.

**Test di regressione sintetico.** `api/tests/d12GraziaAdminErrorRedaction.synthetic.test.js` carica i due moduli frontend reali in una VM con React Query e API simulati, senza rete/DB: verifica che errori con nomi e preferenze fittizie siano neutralizzati sui tre GET, su due POST Admin, nei toast Admin e nel percorso proposta legacy. È eseguito dai job `client-build` e `mobile-browser` del workflow Unified. L'esito va attribuito soltanto allo SHA controllato. La presenza del test **non prova** che `privacy@demos.community` riceva davvero i messaggi di rettifica.

**Gate ancora aperti.** Le verifiche DSAR-01..06, la base giuridica e la procedura per dati giudiziari e di terzi (GDPR artt. 5/6/9/10/14), le informative, la conservazione, l'eventuale DPIA, lo staging DEMOS10 autorizzato e il collaudo Android fisico restano NO-GO. Nessun merge, deploy, nuova tabella, invio email o modifica ai dati reali viene effettuato da questo intervento.

## 06/11/2026 — Directory pubbliche: oggetti JSON annidati

**Verifica dello stato reale.** I listati pubblici registrati `/api/attivisti`, `/api/attivisti/tipologia/:tipo` e `/api/organizzazioni` usano **già** una selezione SQL circoscritta e `projectPublicDirectoryMembers` per i campi di primo livello. Le pagine attive applicano inoltre una whitelist client. Non risulta, dai percorsi verificati nella PR Draft, l'invio diretto delle colonne account `email`, `data_nascita`, `genere` o `comune_residenza` in tali risposte. Non confondere questa constatazione sul codice della PR con un controllo del deployment pubblico.

**Rischio residuo e mitigazione.** La colonna JSONB `tipologie_attivismo` veniva copiata per intero nella proiezione; dati aggiuntivi eventualmente presenti in un elemento (contatti, note di moderazione, identificatori non previsti) sarebbero quindi stati inoltrati. Il codice ora consente, per ogni elemento JSON, soltanto `tipo`, `emoji`, `nome`, `descrizione` e `colore` se stringhe; scarta proprietà non riconosciute e strutture invalide. Mantiene il contratto pubblicato per i client esistenti, senza query aggiuntive. **Il rischio era potenziale: nessuna esposizione effettiva di record reali è stata verificata.**

**Verifica sintetica.** `api/tests/d12PublicDirectoryNestedPrivacy.synthetic.test.js` controlla la proiezione top-level e annidata e il suo impiego sulle tre rotte, con proprietà fittizie sensibili. `api/tests/registeredDirectoryPagination.pg.integration.test.js` usa soltanto PostgreSQL 17 temporaneo e profili sintetici: verifica le risposte HTTP legacy, paginazione iniziale e successive pagine, per Attivisti, Organizzazioni e tipologia Attivisti. I risultati CI si riferiscono allo SHA esplicitamente verificato, non al deployment live.

**Gate invariati.** Restano da validare consenso/base giuridica, finalità delle directory, esattezza delle informazioni pubblicate, gestione delle rettifiche DSAR-01..06, disponibilità reale della casella privacy, revisione legale, staging DEMOS10 autorizzato e Android fisico. La compatibilità con vecchie versioni Android impedisce, per ora, di rendere obbligatoria la paginazione del primo elenco a livello API: i client nuovi richiedono `members_paged=1`, i vecchi possono ancora richiedere il listato completo. Quest'ultimo rischio di volumetria/raccolta massiva richiede una decisione separata sui client minimi supportati. Nessun merge, deploy o accesso a dati reali è stato eseguito.

## 06/11/2026 — Verifica CI della canonicalizzazione cursori

- Commit verificato `b24c4b8c8ba0fe7628bf524ad1d9ed02b856bd4f` (PR #502 Draft): **15/15 workflow GitHub associati al pull request completati con `success`**. Include i workflow `Civic privacy and moderation contracts` e `Unified subject proposal page` se eseguito; la lista controllata include `Civic privacy and moderation contracts`, non una prova di esecuzione manuale su Android fisico. Non attribuire a questo controllo workflow push non interrogati.
- Il test sintetico `api/tests/d12RegisteredDirectoryCursorCanonical.synthetic.test.js` contiene due casi: rifiuto di codifiche Base64URL non canoniche e accettazione dei cursori generati da `pageRegistered`. Il codice del test è stato letto al commit verificato; la conferma di esecuzione specifica del test nel job richiede esame dei passi/log del workflow, non è dedotta dal solo verde complessivo.
- La modifica non dimostra ricezione di email, identità dell'interessato, rettifica reale, revisione DPO, staging condiviso o prova Android fisica. DSAR-01..06 e i gate legali/di rilascio rimangono **NO-GO**. Nessun merge, deploy, invio email, accesso a dati reali o migrazione.


## 06/11/2026 — Decisioni DPO e test invio privacy

- Il DPO ha confermato esplicitamente che gestirà personalmente richieste di accesso, rettifica e cancellazione (06/11/2026). Conferma di responsabilità operativa **non** equivale ad approvazione delle basi giuridiche, procedure o tempi di retention.
- Test sintetico del canale: email inviata da Gmail collegato a `privacy@demos.community` con oggetto `DEMOS12 — test tecnico recapito privacy — 2026-11-06 08:06 CET`, Gmail ha restituito stato `SENT`. Al primo controllo, nessun avviso di mancata consegna o risposta sul mittente. **Ricezione, accesso della casella destinataria, riscontro e funzionamento dei processi NON verificati**. DSAR-01/02 NON SUPERATI: serve prova di arrivo nella casella destinataria e risposta controllata senza dati di terzi. Non inserire identità o casi reali nei tracker.
- Per la domanda sull'informativa alle persone segnalate, il DPO chiede l'opzione più semplice legalmente praticabile. **Criterio cautelativo proposto, ancora soggetto a validazione giuridica:** mantenere le proposte non pubbliche prima della moderazione, verificare e documentare base giuridica e necessità dell'informativa art. 14 per ciascun trattamento di dati di terzi; non presumere esenzioni o che la pubblicità della fonte elimini l'obbligo. Quando i dati vengono comunicati a terzi, rispettare il termine applicabile al più tardi alla prima comunicazione; niente invii automatici indiscriminati a contatti reperiti online. Valutare art. 9 per opinioni politiche/attivismo. Per Grazia, informazioni su condanne/reati sono soggette all'art. 10 GDPR e art. 2-octies Codice Privacy: **nuove pubblicazioni di dati giudiziari NO-GO** finché non sia verificata una specifica autorizzazione normativa e garanzie appropriate. Il solo consenso non costituisce automaticamente un'autorizzazione sufficiente.
- Fonti: https://eur-lex.europa.eu/eli/reg/2016/679/oj ; https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en ; https://www.normattiva.it/atto/caricaDettaglioAtto?atto.articolo.numero=2&atto.articolo.sottoArticolo=1&atto.articolo.tipoArticolo=0&atto.codiceRedazionale=18G00129&atto.dataPubblicazioneGazzetta=2018-09-04 .
- Solo aggiornamento documentale in PR Draft. Non cambia API, codice eseguibile, feature flag, dati, hosting, produzione o staging; non esegue verifiche DSAR-03..06 e non certifica conformità.


## 06/11/2026 — Rettifica fattuale: perimetro effettivo Grazia (audit del codice, non dei dati reali)

**Correzione di una valutazione precedente troppo ampia.** Nel ramo Draft verificato, la classifica pubblica `GET /api/grazia` seleziona **soltanto** `c.nome` e `COUNT(v.id) AS richieste` dal catalogo approvato `grazia_carcerati`. La UI `CarceratoItem.tsx` rende nome e numero di richieste; non mostra reati, capi di imputazione, sentenze, descrizioni giudiziarie, fotografie o dettagli dei procedimenti. Il form `ProponiSoggetto.tsx` non presenta il campo libero `details` per la categoria Grazia e invia solo `nome` e `urlProva`; `POST /api/grazia` salva in coda privata `nome`, `url_prova`, `utente_id`, stato e data. `GET /api/grazia/richieste` è riservato all'Admin. L'approvazione inserisce nel catalogo pubblico soltanto `nome` e `attivo`. La URL della fonte non compare nella classifica pubblica. Le preferenze di voto dell'utente autenticato sono separate dai conteggi aggregati pubblici.

**Precisazione sul rischio:** l'espressione "nuove pubblicazioni di dati giudiziari NO-GO" della sezione precedente era formulata come se DEMOS pubblicasse dettagli giudiziari; **non è ciò che il codice verificato fa**. La denominazione pubblica "Classifica carcerati" e il contesto delle richieste di grazia possono comunque veicolare un'informazione o un'inferenza relativa alla situazione penale di una persona identificata, anche senza descrivere il reato. La qualificazione giuridica ai sensi dell'art. 10 richiede una valutazione circoscritta dei contenuti effettivi e delle fonti, non la presunzione che siano pubblicati fascicoli o sentenze. Il fatto che i nominativi siano già riportati dai giornali non elimina automaticamente tutti gli obblighi GDPR. Non è stato esaminato alcun record reale né verificata la notorietà di ogni soggetto.

**Azione:** evitare nuovi campi su reati, sentenze o dati sensibili non richiesti dal prodotto. Concentrare la revisione DPO/legale sul catalogo `nome + conteggio`, sull'etichetta "carcerati", sulla fonte HTTPS conservata solo per la moderazione e sull'informativa per terzi. Nessuna modifica a feature flag, pubblicazioni o dati. La documentazione legale resta NO-GO fino a revisione proporzionata sul trattamento effettivo, non su scenari inventati.

## 06/11/2026 — Cursori amministrativi canonici (Grazia e moderazione generica)

**Difetto verificato nel codice Draft:** le funzioni `parseGraziaAdminCursor` e `parseAdminPageCursor` controllavano tipo, lunghezza, alfabeto Base64URL, tuple, timestamp e ID, ma usavano `Buffer.from(raw, 'base64url')` senza controllare che l'input fosse la rappresentazione canonica. Il decoder Node tollera alias con bit finali inutilizzati: codifiche diverse potevano rappresentare la stessa pagina. Le directory registrate già rifiutavano questi alias. Non è stata osservata alcuna fuga di dati o accesso illecito: le rotte sono Admin-only e i valori SQL già parametrizzati.

**Correzione minima:** prima del `JSON.parse`, ciascuna funzione ora ricodifica i byte decodificati con `toString('base64url')` e restituisce `false` (HTTP 400 negli endpoint Grazia e nelle rotte Admin generiche) se non coincidono esattamente con l'input. I cursori generati dal server rimangono accettati, conservano microsecondi e formati di ID distinti (Grazia ID legacy ASCII; proposte generiche UUID), e non richiedono modifiche a DB, client, timestamp o credenziali.

**Prova sintetica:** il contratto `api/tests/graziaModerationContract.test.js`, già eseguito dalla CI Civic, carica e valuta le funzioni reali delle due rotte in VM isolata, genera due cursori validi e le rispettive codifiche alias Base64URL, verifica rifiuto degli alias, padding, caratteri invalidi, tuple sovradimensionate e oggetti. Senza profili, SQL, rete, token o dati reali. La CI va verificata sullo SHA finale: non attribuire PASS al solo commit.

**Limiti:** questo chiude esclusivamente la canonicalizzazione dei cursori amministrativi in PR Draft. Non è un rilascio, né una prova di consegna DSAR, informativa Art. 14, qualificazione giuridica di Grazia, conservazione, dispositivi Android o staging DEMOS10. Nessun merge, deploy, DDL, feature flag o accesso ad account reali.
