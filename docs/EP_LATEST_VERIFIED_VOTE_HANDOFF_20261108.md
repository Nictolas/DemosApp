# DEMOS — Parlamento europeo: ultimo voto verificato (handoff Draft)

Data controllo: 2026-11-08. Proprietario: fonte PE, attribuzione, API reader/UI europea.
**Non è una dichiarazione GO per la prossima AAB. Nessun deploy o SQL applicato.**


## Verifica successiva 08/11/2026 — copertura PE COMPLETATA, rilascio ancora NO-GO

**Questo aggiornamento prevale su tutti i riferimenti precedenti ai «30 MEP
mancanti» e alla copertura incompleta delle fonti.**

- GitHub Actions [run 42511232120](https://github.com/Nictolas/DemosApp/actions/runs/42511232120)
  `EP_RECENT_COVERAGE_READ_ONLY`: **76/76** ID di eurodeputati italiani
  attualmente in carica, ognuno con un ultimo voto nominale sul testo finale
  verificato, scandagliando le sedute ufficiali in ordine decrescente.
  Fonte PE API v2, cronologia delle **8 sedute recenti esaminate verificata
  senza errori**, zero dati personali o ID nei log, zero scritture.
- Recupero incrementale osservato: 22/10 **46**, 21/10 **+22**,
  20/10 **+2**, 19/10 **+0**, 08/10 **+5**, 07/10 **+1** =
  **76/76**. Anche 06/10 e 05/10 hanno risposto correttamente.
  I 30 senza voto il 22/10 *non erano necessariamente assenti*: il loro
  ultimo voto definitivo esplicito proviene da sedute precedenti.
  I valori sono **candidati ufficiali solo in memoria**, NON importati
  nel database e NON collegati agli account DEMOS.
- L'algoritmo `collectRecentVerifiedItalianVotes` già raccoglie un solo
  voto più recente per MepId e si ferma quando la copertura è completa,
  con fail-closed in caso di errore API. Aggiunta regressione multi-seduta
  per garantire che un voto più vecchio non sostituisca uno più nuovo.
- Il lettore della scheda `europeanRepresentativeCurrentVoteReader.js`
  ora esegue una `JOIN` esatta con il bridge verificato
  `institutional_nominal_identity_links`, richiedendo
  `institution='PE'`, UUID corrispondente, MepId corrispondente,
  prova documentale ufficiale, e il record current-only
  `representative_key='demos:<UUID>'`. Una riga forzata senza bridge
  non viene esposta; una migration non pronta produce `null`.
- Il controllo completo della fonte ufficiale per tutti i MEP è stato
  promosso a gate MANUALE `workflow_dispatch` pre-release
  (`api/scripts/verifyEuropeanParliamentLatestSitting.js`).
  Non vengono ripetute 8 sedute a ogni commit Draft. Il run
  42511232120 attesta il controllo live; il gate completo aggiornato
  richiede una nuova esecuzione manuale prima della release.
- **Gate rimasti (3 gruppi):**
  (1) PR #633: bridge PE MepId↔UUID verificato + writer current-only unico
  senza `pe:<id>` duplicato;
  (2) esecuzione import/verifica reali in staging unificato e read-side
  autenticato, con compatibilità PR #576;
  (3) QA Chrome/Android 320×568 e 390×844, verifica DPO,
  release/AAB e approvazione espressa. **Non dichiarare HO FINITO.**

## Stato tecnico aggiornato e verificato 08/11/2026 (prevale sui checkpoint storici sotto)
- **Sorgente ufficiale completata in sola lettura:** `api/services/europeanParliamentOfficialDiscovery.js`
  interroga `GET /api/v2/meetings?year=2026` e scarta le sedute future; l'ultima
  seduta trascorsa rilevata è **22 ottobre 2026**, su **44** sedute trascorse
  trovate. Il roster `GET /meps/show-current` viene paginato a 500, filtrato
  ESCLUSIVAMENTE per `api:country-of-representation=IT`: **76 ID ufficiali
  italiani** reali; nessun nome o gruppo in cache.
- **Evidenza HTTP reale:** nel run GitHub Actions
  `42504999590` lo step `EP_LATEST_OFFICIAL_REAL_PASS` conferma
  **76** decisioni nominali per la seduta del 22/10/2026, **1** voto sul
  testo complessivo, **46** eurodeputati italiani con voto nominale
  esplicito, **30** senza voto individuale verificato in quella seduta
  (NON classificarli assenti). Chiamate di sola lettura, zero scritture.
  L'intero workflow di quella HEAD è poi fallito per timeout HTTP
  durante un SECONDO probe ridondante su 2026-10-22, non nello step
  precedente; rimossi i probe duplicati dal workflow ordinario.
- **Lettore scheda Rappresentanti completato nel Draft:** 
  `api/services/europeanRepresentativeCurrentVoteReader.js` e
  `api/routes/rappresentanti.js` leggono un solo record PE dalla
  tabella corrente condivisa della PR #633 usando la chiave
  `demos:<users.id UUID>` già selezionata dall'utente autenticato;
  riconfermano `source_person_id`, `ballot_id`, `ballot_order`,
  `vote_date` e posizione individuale contro l'API v2, e ricavano
  l'esito dalla decisione `ADOPTED/REJECTED`. Nessuna query
  storica, nessuna interpolazione dei nomi, una SELECT parametrica
  più due chiamate API *condivise via cache 6h per seduta* solo se
  esiste già un record. Tabella assente = `null` senza voto inventato.
- **Reader delle sedute precedenti:** `collectRecentVerifiedItalianVotes`
  esplora in ordine decrescente fino a 20 sedute, conservando
  esclusivamente una mappa transitoria del voto nominale più recente
  riconosciuto per ID. Fallisce chiuso se una fonte è indisponibile,
  senza assegnare automaticamente `Assente` ai 30 non presenti
  nel roll-call più recente. Il recupero completo e una
  sincronizzazione reale sul writer canonico **non sono ancora attestati**.
- **Coordinamento PR #633:** commento GitHub #6724671783 consegnato
  al proprietario dello schema/writer. **Problema d'integrazione:** il
  writer PE proposto da #633 usa `pe:<MEPID>`, mentre la scheda DEMOS
  richiede `demos:<UUID>`. La creazione del crosswalk ufficiale
  MepId↔UUID e il passaggio alla singola chiave canonica competono
  alla PR #633: non sono stati modificati né la sua tabella né il writer.
  La fonte del record deve essere il percorso esatto delle decisioni
  `https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-YYYY-MM-DD/decisions`.
- **CI:** `European Parliament official latest-vote source validation`
  run `42505421300` SUCCESS: unit test, sintassi Node,
  build React/Vite. Il controllo reale esterno è mantenuto per
  `workflow_dispatch` come gate manuale pre-release: il provider
  può avere timeout non deterministici durante le numerose CI di Draft.
  Ultima evidenza live eseguita: step citato sopra. Il workflow
  provinciale parallelo ha una prova di overlay fallita per branch
  differente, ma le prove funzionali provinciali sono PASS.
- **Non ancora pronto AAB:** crosswalk ufficiale,
  writer PE→current-only #633, 30 MEP da riconciliare
  con votazioni precedenti e prova di copertura, E2E staging
  autenticato, Chrome reale su 320×568 / 390×844 (tunnel DeskMCP
  offline), DPO e gate AAB. Nessun merge, deploy, SQL di modifica,
  push FCM o nuova risorsa a pagamento.

## Stato reale e criticità confermate
- Supabase Demos produzione: `parlamento_europeo` **84** righe, data massima **2015-01-13**;
  `parlamento_europeo_voti_nominali` **0** righe ma chiave `(uri_votazione,mep_id)`
  progettata per storicizzare. Demos-Staging: le due tabelle assenti. Non è copertura 2026.
- Il GET legacy `/dettagli/:uri` poteva creare tabelle e salvare voti nominali;
  la funzione legacy assegnava falsamente `Assente` a ogni ID non elencato,
  usava un confronto permissivo `includes()` sugli ID e fallback non ufficiali.
- `political_mandates` produzione ha **76** record con `office_code='E'`,
  ma nessuna colonna di crosswalk ufficiale MepId; i rappresentanti selezionati
  sono identificati tramite UUID DEMOS. Nome/cognome non è una chiave valida.
- Le API di lettura europee nel ramo sono bloccate dal salvataggio storico:
  `GET /ultime` non forza più una sync, `GET /dettagli` non chiama il writer
  nominale legacy, `POST /sincronizza` e `POST /aggiorna-titoli` rispondono 409.
  **Queste modifiche restano Draft e disabilitano il comportamento storico;
  la sostituzione col writer canonico è responsabilità dell'altra chat.**

## Implementazione su questo ramo
1. `api/services/europeanParliamentVerifiedRollCallReader.js`:
   lettore XML istituzionale `PV-10-YYYY-MM-DD-RCV_EN.xml` per seduta,
   timeout 12s, dimensione massima 6 MiB, cache in memoria 6h, richieste
   simultanee deduplicate, zero query/write DB, zero AI e zero servizi a pagamento.
2. Attribuzione usando soltanto `PoliticalGroup.Member.Name MepId` (ID numerico
   esatto); se è assente dal file RCV, il voto **non è attribuibile** e non
   diventa `Assente`. Duplicati e ambiguità sono respinti.
3. La selezione dell'ultimo voto è rigorosa e non promuove una votazione a
   definitiva sulla sola base della descrizione o dei conteggi. Richiede
   riconciliazione con decisione **ufficiale VOT** per ID/date/oggetto/esito
   confermati, tramite `verifiedDecisions`; nessuna fonte VOT automatica
   completata in questo ramo.
4. `client/src/pages/Rappresentanti/index.tsx` alimenta il dialogo già
   esistente `ViewOpinioniDialog` con il solo
   `rappresentanti.europeo[0].ultimo_voto_nominale`, quando esiste.
   La UI mostra oggetto/data/voto/esito/fonte ufficiale, altrimenti «non
   verificabile». Non effettua query storiche aggiuntive e non visualizza gruppi.
   Rimosse 4 occorrenze del gruppo dal dettaglio legacy PE. Podio
   di Trasparenza nascosto in questo dialogo per la categoria europea.
5. Test unitari: identità, falsi positivi, collisioni, voti mancanti, fonte
   ufficiale, risultato finale, regressione temporale, cache/deduplica.
   Workflow CI include sonda HTTP su XML ufficiale reale e build frontend.

## Contratto di integrazione con «DEMOS — Ultimo voto per rappresentante»
**Questa chat NON possiede schema o writer** e non ha modificato tabelle,
constraint, migrazioni, job di persistenza né PR #576.

Richieste al proprietario della persistenza:
- Costruire un crosswalk istituzionale verificato `users.id UUID` ↔
  `MEP MepId numerico` per ciascun mandato europeo attivo. Nessuna
  attribuzione automatica per nome o iniziali. Ambiguità = nessun voto.
- Conservare **un solo** record corrente per rappresentante con
  `vote_order` comparabile e aggiornamento atomico monotono
  (non sostituire dati recenti con vecchi), con fonte e stato di verifica.
- Esporre nel payload autenticato già esistente
  `GET /api/rappresentanti`, sotto
  `data.rappresentanti.europeo[0].ultimo_voto_nominale`, solo:
  `{verified:true,mepId,voteId,subject,date,vote,outcome,sourceUrl}`.
  Niente gruppo/partito; `null` se non accertato. Il backend deve
  garantire coincidenza tra MepId e UUID del profilo selezionato.
- Collegare un importatore **a frequenza limitata** alla coppia RCV
  + VOT ufficiali, alimentando il writer comune. Se il documento è
  indisponibile, incompleto o non attestato come voto finale, non scrivere.
- Coordinare il ritiro delle tabelle `parlamento_europeo_voti_nominali`
  e `parlamento_europeo` solo dopo audit, approvazione, bonifica/rollback
  e prove sugli endpoint; **nessun DROP/DELETE in questo ramo**.

## Gate aperti prima di AAB
- Verifica VOT XML reale e riconciliazione deterministica RCV ↔ VOT.
- Copertura reale dell'ultima seduta 2026 e verifica delle identità
  dei 76 MEP italiani (il numero dei mandati DB non è prova di 76 crosswalk).
- Schema/writer e read-side current-only dalla chat proprietaria.
- Integrazione API autenticata e prova E2E su staging condiviso esistente.
- QA su Chrome mobile reale a 320×568 / 390×844: browser remoto non
  raggiungibile durante questa sessione; una build CI non equivale al QA Chrome.
- Verifica delle politiche di retention, approvazione rilascio, AAB
  firmato e test Android da canale Play. **Produzione/Play invariati.**


## Evidenza LIVE su API istituzionale v2 (2026-11-08)
La prova HTTP effettiva in GitHub Actions (sola lettura e senza dati utente) ha ottenuto
200 OK su `https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-2026-10-22/decisions`
(**205** record) e `/vote-results` (**43**), nonché 2026-07-09 (**105**
decisioni e **36** risultati di voto). Fra i record:
- `decision_method = def/ep-decision-methods/VOTE_ELECTRONIC_ROLLCALL`;
- `had_voter_favor/against/abstention` contengono `person/<ID numerico>`;
- `decision_outcome` identifica ufficialmente `ADOPTED`/`REJECTED`;
- `activity_order` è stringa numerica come `22.0`, non integer;
- `vote-results[].consists_of` elenca gli ID esatti delle decisioni associate
  al titolo complessivo in italiano, una possibile fonte per il campo «oggetto».

Il modulo aggiuntivo `europeanParliamentOfficialDecisionReader.js` verifica
ID stabili, posizione nominale, outcome istituzionale e non inventa assenze;
conserva dati **solo in memoria fino a 6 ore**. Il file XML `doceo` è
stato respinto (HTTP 403/400 lato GitHub Actions), quindi è solo diagnostico,
non una fonte E2E confermata.

**ATTENZIONE: finalità non verificata.** I primi test su **67** roll-call
con votanti il 9/7 e **76** il 22/10 non hanno trovato espliciti
`final vote/votazione finale` nei campi disponibili. I record di emendamento
possono essere `ADOPTED` e contenere votanti: l'esito non prova che
il testo complessivo sia stato votato in via definitiva. Nessun voto dovrà
essere pubblicato finché il classificatore finale per API (ad es. voto sul
testo nel suo insieme, con riferimento esatto ufficiale) non è provato e
testato realmente. Il gate live *deve* rimanere rosso in assenza di prove,
non va bypassato per rendere verde la CI.

I campi `headingLabel` possono contenere sigle di gruppi politici: per
rispettare PROD-041, il reader **non li conserva** come oggetto. La UI
accetta esclusivamente link ufficiali `www.europarl.europa.eu/doceo/`
o `data.europarl.europa.eu/api/v2/meetings/.../decisions`.

Il modulo continua **senza collegamento alla persistenza**, al writer
canonico, né a Google Play. Il proprietario dello schema gestisce il
crosswalk DEMOS UUID ↔ EP MepId e l'UPSERT monotono per persona.


## Aggiornamento RCV definitivo 2026 (solo fonti ufficiali)
L'audit dei **67** RCV del 09/07 e **76** del 22/10 ha confermato
la formulazione ufficiale, assente nel primo filtro:
- 09/07/2026 `...DEC-195749`, `...DEC-195769`: «Motion for a
  resolution (as a whole)» / «Proposta di risoluzione (insieme del testo)»;
- 22/10/2026 `...DEC-199517`: stessa formulazione ufficiale.

Il parser adesso classifica questi come voti sul testo complessivo,
separandoli dagli emendamenti e leggendo `activity_order` (in forma
stringa, es. `35.0`) come ordinamento solo se strettamente numerico.
Ha test di regressione con etichette realmente osservate. L'oggetto si
arricchisce via join **esatto** fra `vote-results[].consists_of` e
`decisions[].activity_id`, privilegiando la descrizione italiana;
nessun match per sottostringhe o per nome.

Il test finale deve confermare i nuovi risultati sul commit più recente:
non usare il successo di un commit precedente come prova di questa HEAD.
La prova è su date campione 2026 e **non certifica l'individuazione
automatica dell'ultima seduta effettiva** del Parlamento europeo.

## Crosswalk PE — incompatibilità rilevata nella PR #633 (HEAD 0ea56e43)
Dopo la verifica della migration proposta
`api/database/20261108_institutional_nominal_identity_links.sql` della PR #633
è stato rilevato un **blocco concreto**: la colonna `institution` accetta
solo Camera/Senato; la `source_person_id` richiede 12–250 caratteri,
mentre l'ID `person/<MepId>` proveniente dall'API ufficiale PE si
normalizza in un numero tipicamente di 5–6 cifre. Non si può quindi
usare questo bridge senza ulteriori modifiche del proprietario
della persistenza.

Commento di coordinamento https://github.com/Nictolas/DemosApp/pull/633#issuecomment-6724777687 :
è richiesto al proprietario di #633 un crosswalk PE ↔
`users.id UUID` verificato da fonte istituzionale, prova URL
ufficiale, vincoli di unicità e `representative_key='demos:<UUID>'`.
La tabella current-only non deve produrre anche `pe:<MepId>`
per la stessa persona. Tutte le modifiche di schema e writer restano
di sua esclusiva competenza; **questo ramo non applica migration**.

Questo checkpoint si riferisce alla HEAD sopra citata e deve essere
riverificato se la PR #633 progredisce.
