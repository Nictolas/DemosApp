## Checkpoint integrazione PE↔writer reale #633 su PostgreSQL 16 — 8 novembre 2026

**Test cross-PR reale superato su DB sintetico e isolato:**
[GitHub Actions 42524446629](https://github.com/Nictolas/DemosApp/actions/runs/42524446629).
Tutti e **3/3 job SUCCESS**, comprese build/reader, Chrome reale con
dati sintetici e PostgreSQL 16. Nel job PG16 sono state
scaricate tramite `refs/pull/633/head` (senza merge)
le versioni **reali** della migration `institutional_current_nominal_votes`
e del writer `institutionalCurrentNominalVotesService.js` dal ramo
Draft #633. Integrazione verificata da
`api/tests/epSelectedWriterRealPgSmoke.js`, codice e fixture
interamente sintetici:
- un follower attivo seleziona l'UUID canonico
  `political_selections.eu.parliament.it`;
- esiste un mandato europeo attivo e un'identità PE approvata
  con revisore e URL istituzionale esatto;
- il `prepareSelectedEuropeanCurrentOnlyPreview` di #635
  fornisce **un solo candidato** con chiave `demos:<UUID>`;
- il writer **vero** di #633 lo accetta e inserisce una sola riga;
  replay identico, voto precedente e voto con ordine precedente
  nella stessa seduta non la sostituiscono;
- un voto più recente per ordine la sostituisce, senza archiviare
  lo storico; revocare `review_state='VERIFIED'` blocca le
  nuove acquisizioni (0 candidati, 0 HTTP);
- l'intero test di scrittura termina in **ROLLBACK**, verificando
  **0 righe di voto residue** nel database temporaneo.
  Nessuna connessione o SQL DML sullo staging unificato o produzione.

Un controllo cross-PR indipendente, [Actions 42523983225](https://github.com/Nictolas/DemosApp/actions/runs/42523983225),
ha eseguito 4/4 test sul vero modulo del writer; il log mostra
`EP_SHARED_WRITER_BLOCKER_UNLINKED_PE_KEY_STILL_ACCEPTED`.
**Blocco rimasto:** #633 deve rifiutare le chiavi PE
`pe:<MepId>` e utilizzare esclusivamente `demos:<UUID>`
nell'adapter; inoltre deve confermare il link `PE + UUID + MepId`
con `review_state='VERIFIED'` *nella medesima transazione*
dell'UPSERT, per prevenire bypass del preview o cambi di identità
nel frattempo. Handoff [commento #633](https://github.com/Nictolas/DemosApp/pull/633#issuecomment-6727266170).

**Questo completa la prova di interoperabilità tecnica in ambiente
sintetico.** NON prova i tre link PE in produzione/staging, NON
autorizza la correzione dei dati anagrafici discordanti, e NON
sostituisce l'E2E autenticato su staging unificato e il QA dell'AAB.
Il progetto è ancora **NO-GO** per merge/deploy/release.

---

## Proposta schema verificata su PostgreSQL 16 — 08/11/2026

**Nuovo avanzamento, ancora NON applicato a DEMOS.** Preparato il file
`docs/operations/PROD041_EP_BRIDGE_MIGRATION_PROPOSAL.sql`
come proposta per il proprietario della PR #633, non come migration
applicabile automaticamente. La proposta modifica soltanto i due
vincoli `institution` e `source_person_id` della tabella
`institutional_nominal_identity_links`:
`PE` + MepId **numerico esatto da 1 a 9 cifre**; Camera e Senato
conservano ID di lunghezza 12–250. Il preflight fallisce se
`review_state` manca, se i vincoli originali differiscono da
quelli osservati nello staging, o se i dati già presenti violano
la regola; non approva identità, non modifica i permessi RLS,
PK/UNIQUE o le regole `PENDING`/`VERIFIED`.

[GitHub Actions 42523025429](https://github.com/Nictolas/DemosApp/actions/runs/42523025429):
**tutti e tre i job SUCCESS**: test PG16 isolato
(`EP_BRIDGE_PROPOSAL_PG16_SYNTHETIC_PASS`) con utenti e link
sintetici, test del lettore e della coda di revisione e prova
Chrome reale su dati sintetici. La prova PostgreSQL richiede
`EP_SCHEMA_FIXTURE_ONLY=true`, database locale
`ep_bridge_ci_fixture` e verifica Camera/Senato precedenti
conservati, RLS, `PE` numerico accettato e rifiuto di ID PE
malformati e di promozione `VERIFIED` senza revisore.
**Zero connessioni allo staging o produzione in quel job.**

Handoff consegnato al proprietario:
[commento PR #633](https://github.com/Nictolas/DemosApp/pull/633#issuecomment-6727077799).
La proposta **non autorizza** merge/deploy/DDL, non risolve il
writer #633 che attualmente usa `pe:<MepId>` anziché la chiave
univoca `demos:<UUID>`, né sostituisce il controllo umano sulle
tre identità selezionate (inclusa una discrepanza nell'anno di nascita).

**Ancora NO-GO:** schema e writer PR #633, revisione umana, import
reale e E2E autenticato su staging unificato, QA Android/DPO/GO.
Nessun AAB da caricare ora.

---

## Stato di integrazione più recente — selezioni PE CANONICHE (08/11/2026)

**Correzione rispetto ai checkpoint precedenti:** la tabella
`political_selections` in produzione CONTIENE già **3 selezioni
europee**: codice esatto `eu.parliament.it` e `selection_kind='representative'`.
Il precedente controllo con filtro `ILIKE '%euro%'` aveva restituito
falsamente zero, perché non riconosceva quel codice. I 3 UUID
canonici coincidono esattamente con i 3 target esistenti nella
proiezione legacy che hanno mandato `office_code='E'` attivo.

**Nuova regola tecnica implementata sulla PR #635:**
`api/services/europeanParliamentSelectedCurrentOnlyReader.js` richiede
una vera selezione canonica in `political_selections`, follower
`users.status='a'`, mandato E/ACTIVE in finestra temporale valida
e link d'identità PE con `review_state='VERIFIED'`, reviewer, data
e fonte ufficiale. Nessuna selezione legacy basta a far importare
un voto. Se zero link verificati, zero HTTP alle API PE. Niente
storico, nomi nella query del writer, partiti, gruppi o DML.

**Nuovo report per revisore, SQL esclusivamente SELECT:**
`api/database/20261108_ep_selected_identity_review_readonly.sql`.
Il report è destinato solo al revisore autorizzato; fa una FULL OUTER
JOIN tra selezioni canoniche e la colonna legacy, evita doppioni,
non restituisce follower ID, voti o DOB, non assegna MepId e non
attribuisce mai lo stato VERIFIED. Audit aggregato effettivamente
eseguito su Supabase produzione:
- `CANONICAL_SELECTED_ACTIVE_EU_MANDATE`: **3** riferimenti unici,
  **3** selezioni canoniche, **3** proiezioni legacy corrispondenti.
- `LEGACY_NON_UUID`: **3** riferimenti distinti, **6** selezioni
  legacy, **0** idonei a corrente.
- `UUID_NO_ACTIVE_EU_MANDATE`: **1** riferimento distinto,
  **1** selezione legacy, **0** idonei.
- **0** assegnazioni automatiche di MepId e **0** approvazioni
  false. Nessun dato personale dei follower estratto.

**Evidenza istituzionale preparata, non approvata:** le
pagine ufficiali del Parlamento europeo permettono di individuare
tre profili con MepId per la revisione degli eletti canonici.
Il controllo anagrafico minimizzato ha trovato **1 discordanza**
fra data di nascita DEMOS e data della pagina istituzionale,
e **2 date non registrate** in DEMOS. L'identità discordante
richiede verifica umana prima di poter associare un voto; nessuna
data è stata modificata, nessun link è stato scritto e nessun
nome/UUID è stato aggiunto alla documentazione pubblica.

**Staging unificato:** ha le tabelle `political_selections`,
`political_mandates` e bridge, ma zero selezioni europee
canoniche e zero link PE VERIFIED. Il `EXPLAIN` con la query
CANONICA ha superato il controllo PostgreSQL, usando indici;
la colonna legacy `user_representatives.rappresentante_europeo`
assente su staging **non blocca più il reader canonico**. Per
un vero E2E occorreranno fixture autorizzate e compatibilità
PR #633 per MepId PE numerici brevi, poi prova autenticata.
Nessun DDL/DML, merge o deploy.

**Handoff a PR #633**:
https://github.com/Nictolas/DemosApp/pull/633#issuecomment-6726851417.

I blocchi di rilascio restano 3:
(1) bridge e writer canonico PE con revisione umana e DOB discordante;
(2) E2E import su staging unico con selezione reale di prova e
autenticazione; (3) Android AAB, DPO/retention e via libera
esplicito. Non dichiarare HO FINITO.

---

## CHECKPOINT CORRENTE — SOLO SELEZIONATI, compatibilità staging (08/11/2026)

**Codice nuovo, verificato in CI:** `api/services/europeanParliamentSelectedCurrentOnlyReader.js`
è un lettore **solo SELECT** per PR #633. Legge dal bridge ufficiale solamente
`institution='PE'`, `review_state='VERIFIED'`, revisore e data presenti, con
mandato `office_code='E'/status='ACTIVE'` e almeno una selezione fatta
da un follower attivo (`users.status='a'`). La selezione viene abbinata
**esclusivamente all'UUID DEMOS** nel bridge, non a nome/cognome.
`prepareSelectedEuropeanCurrentOnlyPreview` ricava i MepId ufficiali
di quei link, interroga l'API PE una sola volta per seduta condivisa,
e produce candidati **unico voto corrente** sotto
`representativeKey='demos:<UUID>'`. Nessun DML, nessuna nuova tabella,
nessuno storico, nessuna API per singolo eurodeputato.

**Zero follower/zero link verificati:** il lettore genera lista MepId
vuota e fa **zero chiamate HTTP** al PE e zero scritture. Un link
`PENDING`, senza revisore, ambiguo o prova istituzionale esatta
viene respinto prima dell'interrogazione dell'API. Rimane possibile
usare separatamente il controllo completo 76/76 delle fonti per QA,
non il refresh di produzione.

**Audit aggregato produzione, esclusivamente SELECT:** 10 selezioni
europee attive, 7 valori distinti. 4 selezioni hanno il formato UUID
(4 UUID distinti); solo **3** corrispondono ad account con mandato
PE `ACTIVE`. Altre 6 selezioni sono valori legacy non-UUID
(3 distinti) e richiedono riconciliazione controllata; nessuno
è stato convertito per nome. Quindi il numero reale di identità da
**verificare per prime** è inferiore a 76, ma attualmente ci sono
**0 crosswalk approvati** nel database.

**Schema staging divergente da produzione:** nello staging unificato
`public.user_representatives` **non ha**
`rappresentante_europeo` (ha soltanto `user_id`,
`rappresentante_camera`, `candidato_comune`).
Produzione possiede il campo `rappresentante_europeo text`.
Il primo SELECT sullo staging falliva per colonna inesistente.
Corretto in modo conservativo tramite
`lower(trim(to_jsonb(r)->>'rappresentante_europeo'))`:
quando il campo manca ritorna `NULL`, non inventa una selezione.
PostgreSQL `EXPLAIN` reale su staging PASS, usando indici su
identity link e mandati. Resta **impossibile** dimostrare
l'importazione E2E degli europei finché PR #633 non porta il
campo corretto nello staging unico. Nessun `ALTER` eseguito
da questa PR. La migration della PR #633 deve anche ammettere
`PE` e identificativi numerici EP corti.

**Verifica automatizzata:** GitHub Actions
[42519488733](https://github.com/Nictolas/DemosApp/actions/runs/42519488733)
**SUCCESS**: unit test del lettore selettivo, identità certificate,
zero API su lista vuota, rifiuto duplicati, build Vite e Chrome
reale sintetico alle due risoluzioni. Il test di protezione del workflow
verifica che questi file siano effettivamente eseguiti in CI.
La verifica precedente delle fonti EP live dopo fail-closed,
[42516420377](https://github.com/Nictolas/DemosApp/actions/runs/42516420377),
ha confermato **76/76** voti nominali ultimi verificati, senza scritture;
non implica 76 identità DEMOS abbinate.

**Handoff al proprietario PR #633:** commento
https://github.com/Nictolas/DemosApp/pull/633#issuecomment-6726610595.
Restano tre gate NO-GO: (1) crosswalk verificato e writer canonico;
(2) riallineamento staging + importazione e lettura autenticata reali;
(3) QA AAB Android + DPO + autorizzazione separata al rilascio.
**Nessun intervento tecnico richiesto all'Admin adesso**: dopo
la predisposizione della coda di verifica, occorrerà una revisione
umana istituzionale delle sole identità effettivamente seguite,
poi il GO al rilascio. Non caricare ora AAB.

---

## Checkpoint più recente — 8 novembre 2026, fonte PE ricontrollata dopo fail-closed

**Audit ufficiale ripetuto e superato**: [GitHub Actions 42516420377](https://github.com/Nictolas/DemosApp/actions/runs/42516420377)
step `EP_LAST_VERIFIED_COVERAGE_REAL_PASS`:
`latestSitting=2026-10-22`, **76/76** MepId italiani correnti con
ultimo voto nominale definitivo verificato, **6** sedute PE consultate,
**0** ignoti, **0** scritture DB, **0** ID personali nei log. Questo audit
si è svolto **dopo** i controlli più rigorosi su cronologia e elenchi
ufficiali definitivi. Il precedente [run 42511232120](https://github.com/Nictolas/DemosApp/actions/runs/42511232120)
aveva controllato 8 sedute.

**CI integrata corretta**: le prove
`api/tests/europeanParliamentCurrentOnlyCandidateBridge.test.js`
erano inizialmente presenti ma non eseguite a causa di una riga
`paths` malformata e di un comando di test incompleto nel workflow.
Il problema è stato corretto prima del run 42516420377; il job
`ep-reader` con i test del crosswalk e il job `ep-chrome-320-390`
sono entrambi **SUCCESS**. Anche build React/Vite e parsing Node superati.
Dopo la ricognizione live, l'audit esterno è tornato
**manuale `workflow_dispatch`** come gate pre-release, evitando
richieste API ripetute su ogni push Draft.

**Persistenza reale non completata**: PR #633 è ancora proprietaria della
migration PE, del mapping certificato MepId↔UUID e del writer attuale.
Staging unificato: **0/76** associazioni revisionate, **0** voti
nominali PE correnti; nessuna scrittura eseguita in questo ramo.
Non confondere la copertura 76/76 di voti ufficiali con il numero di
persone già collegate ai profili DEMOS. In assenza del crosswalk
la scheda espone `null`, non un voto attribuito per nome.

**Azioni utente**: non serve oggi caricare un'AAB, configurare Render
o attivare nuove risorse. Una volta disponibile la procedura di revisione,
un reviewer umano autorizzato (eventualmente l'Admin/DPO) deve
confermare le prove d'identità istituzionale prima di marcare
`review_state=VERIFIED`. Il GO a merge/deploy/Android richiede
un'approvazione espressa **dopo** il test E2E con dati reali su
staging e la revisione privacy.

---

## Ulteriore controllo fonte e costi — 08/11/2026 (ultimo aggiornamento)

**Nuovi test e guardrail nel Draft #635:**
- Il reader `collectRecentVerifiedItalianVotes` scarta l'intera raccolta
  se una seduta più recente mostra un voto definitivo esplicito di un
  eurodeputato, ma l'ordine della votazione è assente, incoerente o
  conflittuale. Non retrocede all'ultima seduta valida precedente
  presentandola falsamente come ultimo voto.
- Il parser del feed EP rifiuta un roll-call **definitivo** se l'elenco
  dei votanti contiene duplicati, ID malformati, categorie non valide
  o nessun votante. Gli emendamenti non definitivi restano esclusi.
  Test negativi aggiunti, senza inferire l'assenza.
- Le decisioni ufficiali sono in una cache temporanea per
  **massimo 12 sedute** (6 ore) per evitare di ripetere due
  richieste per seduta quando utenti diversi selezionano MEP con
  ultimo voto in giornate differenti. Cache in RAM, **non storico DB**;
  client di test isolati dalla cache reale, test di capienza/eviction.
- Il nuovo controllo non modifica il dato già ottenuto dall'audit
  live originale 76/76: prima del rilascio va ripetuto il gate
  **completo** `verifyEuropeanParliamentLatestSitting.js` sulle
  fonti aggiornate (e la CI deve restare verde).
- Invariati i tre gruppi di gate release: **(1)** PR #633 identity
  bridge `PE + MepId + UUID` con approvazione manuale e writer
  unico; **(2)** importazione e autenticazione reali su staging
  unificato; **(3)** Android AAB, DPO e approvazione del rilascio.
  La fonte 76/76 non è identità DEMOS 76/76.
- **Interventi utente:** non servono adesso credenziali, nuovo
  staging o un caricamento AAB. Prima di popolare le identità
  dovrà intervenire un revisore autorizzato (Admin/DPO o
  designato) per convalidare l'evidenza ufficiale dei link;
  l'approvazione finale di merge/deploy/release sarà
  richiesta separatamente. Non chiedere all'utente di
  approvare 76 mappature non ancora preparate/visibili.

# DEMOS — Parlamento europeo: ultimo voto verificato (handoff Draft)

Data controllo: 2026-11-08. Proprietario: fonte PE, attribuzione, API reader/UI europea.
**Non è una dichiarazione GO per la prossima AAB. Nessun deploy o SQL applicato.**



## Audit conclusivo del lettore PE — verifica aggiuntiva 8/11/2026

### Copertura delle fonti vs identità delle persone
- La ricerca di fonte PE è **completa su 76/76 MEP italiani correnti**, usando
  8 sedute reali e decisioni sul testo complessivo confermate:
  [run 42511232120](https://github.com/Nictolas/DemosApp/actions/runs/42511232120).
  Questo NON significa che 76 identità DEMOS siano già riconciliate.
- Audit Supabase produzione **solo SELECT e conteggi**, nessun nominativo
  esportato: `political_mandates.office_code='E'` = 76 mandati e 76 account
  UUID distinti; solo **14/76** profili hanno `data_nascita` e **0/76**
  hanno `luogo_nascita`. Fonti mandati: 68 `EP_CURRENT_ROSTER`,
  8 `LEGACY_BACKFILL`. Il JSON `legacy_context` contiene solo
  `roster_date` / `source_url` (68) e `legacy_role` (8):
  **nessun identificativo EP MepId autorevole collegato all'UUID**.
  Il solo nome o il dato di nascita di un candidato non autorizza
  automaticamente alcun collegamento.
- Supabase **staging unificato**: 0 righe in
  `institutional_nominal_identity_links`, 0 in
  `institutional_current_nominal_votes`. La migration review gate
  del proprietario PR #633 aggiunge `review_state='PENDING'` di default,
  `reviewed_by` e `reviewed_at` obbligatori per `VERIFIED`.
  Le CHECK attuali del link non ammettono ancora `PE` e rifiutano
  source ID numerici corti come MepId a causa di `length>=12`.
- Query `GET /api/rappresentanti` della PR #635 verificata tramite
  **PostgreSQL EXPLAIN sullo staging esistente** con UUID
  interamente sintetico: piano con index scan su
  `institutional_current_nominal_votes_pkey` e
  `institutional_nominal_identity_links_pkey`. Nessuna mutazione.
  Entrambe le tabelle hanno RLS attiva e
  **nessuna autorizzazione SELECT** per `anon` o `authenticated`.
- È stato consegnato il blocco al proprietario dello schema:
  [commento PR #633](https://github.com/Nictolas/DemosApp/pull/633#issuecomment-6725916164).

### Contratto read-only pronto per il writer comune
- `api/services/europeanParliamentCurrentOnlyCandidateBridge.js` prepara
  in memoria la coppia MepId istituzionale → singolo voto corrente
  `representativeKey='demos:<UUID>'` **solo dopo** una prova documentale
  proveniente dall'URL esatto del profilo MEP e dopo
  `review_state='VERIFIED'`, `reviewed_by` e `reviewed_at` validi,
  con `verified_at` e controllo dell'unicità biunivoca.
- Senza link approvati ritorna **0 candidati**, anche se le fonti
  ufficiali hanno individuato 76 voti. Niente associazione per nome,
  niente storico nominativo e niente `INSERT`/`UPDATE`/`DELETE`
  in questo servizio. Il writer e lo schema non appartengono a questa PR.
- La lettura delle schede richiede anche nel SQL JOIN
  `x.review_state='VERIFIED' AND x.reviewed_by IS NOT NULL
  AND x.reviewed_at IS NOT NULL`. La prova `evidence_url`
  deve incorporare esattamente l'ID della persona, non essere
  la home del sito ufficiale o un ID simile. La decisione,
  il suo ordine e la posizione nominale vengono ricontrollati
  contro l'API EP per mostrare un solo voto.
- `api/tests/europeanParliamentCurrentOnlyCandidateBridge.test.js`
  copre link assenti, PENDING, senza revisore, con ID discordanti,
  duplicati, esito non verificato e assenza totale di DML.
- Il recupero delle sedute ha ora un **fallback cronologico al
  31 dicembre dell'anno precedente**, soltanto se il nuovo anno ha
  troppe poche sedute. Il sistema non deve perdere l'ultimo voto
  dicembre 2026 durante gennaio 2027 e non deve oltrepassare la
  legislatura iniziata nel 2024. Test per 2027 prima della prima seduta,
  prime sedute 2027 con voti 2026 ancora correnti, e API storica
  indisponibile (fail-closed). Cache di client simulati non contaminate
  dalla cache HTTP reale; in produzione resta cache in memoria 6h.

### Gate residui inderogabili
1. **PR #633** deve rendere compatibile il bridge PE e certificare
   istituzionalmente l'associazione MepId↔UUID con revisore umano;
   l'adattatore deve scrivere un solo voto `demos:<UUID>`.
2. Eseguire import reale corrente nello staging unico e E2E autenticato
   con identità già verificate, testando anche il passaggio Camera/Senato/PE.
   Le prove Chrome 320×568/390×844 sintetiche sono PASS, ma non
   equivalgono a questa E2E.
3. QA Android su AAB completa, verifica GDPR/DPO, revisione
   cancellazione storico legacy e autorizzazioni di rilascio separate.

**Finché questi gate non sono superati: NO-GO, nessun merge,
deploy, SQL di modifica o pubblicazione AAB; nessuna dichiarazione
«HO FINITO».**

## QA Chrome reale sintetico, sicurezza log — 08/11/2026

- [Workflow GitHub Actions 42512341439](https://github.com/Nictolas/DemosApp/actions/runs/42512341439)
  **COMPLETED/SUCCESS** con due job, `ep-reader` e `ep-chrome-320-390`,
  dopo l'aggiunta della prova automatica sull'effettivo componente
  React `ViewOpinioniDialog` richiamato da `Rappresentanti`.
- **Chrome preinstallato reale** lanciato con Playwright su Vite locale,
  **quattro casi, zero fallimenti, zero skipped**: schermi
  **320×568** e **390×844**, record ufficiale simulato `verified=true`
  con data/voto/esito/URL della fonte, e `ultimo_voto_nominale=null`
  con fallback «non verificabile». Verificate presenza e assenza
  del link ufficiale, contenimento verticale della scheda lunga
  a `max-height:35dvh`, mancata esposizione dei gruppi.
  Dati e token di test esclusivamente sintetici. Nessun accesso a
  staging, produzione, account reali o database.
  Evidenza log `EP_CHROME_320_390_SYNTHETIC_PASS`.
- Privacy frontend: eliminati i debug `console.log` contenenti risposte
  personali e opinioni dal componente del dialogo e dalle schede di
  selezione, oltre ai log di UUID e voti già eliminati lato server.
  Il cambiamento è incluso nei test e nella build React validata.
- **Non sostituisce** il test E2E reale autenticato con
  `institutional_nominal_identity_links` popolata e writer della #633,
  né una prova Android AAB firmata e Play Store. Staging e produzione
  non sono stati modificati; il rilascio resta **NO-GO**.

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


## Importatore corrente collegato al cron esistente — solo Draft (08/11/2026)

La PR #635 contiene ora `api/services/europeanParliamentSelectedCurrentVoteRefresh.js`, chiamabile dal cron Openpolis **già esistente** attraverso il collegamento conservato nella PR #633. Nessun nuovo cron, tabella, servizio esterno o archivio di votazioni.

Il percorso è: `political_selections` + identità PE `VERIFIED` → fetch ufficiale **solo per MepId selezionati** → candidati `demos:<UUID>` → writer condiviso PR #633 → UPSERT monotono sotto controllo SQL dell'identità e follower. Transazione unica per il batch con `ROLLBACK` sugli errori; in caso di identità revocata al momento dell'UPSERT nessun voto è scritto. Senza link verificati non vengono effettuati HTTP PE né operazioni di scrittura. I conteggi nei log non includono UUID, follower o nomi.

**Variabile operativa** `PARLIAMENT_EP_CURRENT_REFRESH_ENABLED`: deve rimanere **assente/OFF** in tutti gli ambienti finché non sia concluso e approvato il test autenticato sullo staging unico; la presenza del codice nella PR non la attiva. I due rami Draft devono essere composti insieme prima di abilitare il writer: da sola, la PR #635 non include il servizio di scrittura PR #633; da sola, la PR #633 non include il lettore/refresh PR #635.

Test: `europeanParliamentSelectedCurrentVoteRefresh.test.js` prova OFF no-query/no-network, 0 link no HTTP e no DML, transazione unica, ROLLBACK se il writer fallisce, copertura ufficiale incompleta e ritorno non valido del writer. `epSelectedWriterRealPgSmoke.js` esercita l'intero flusso contro il **writer reale** ottenuto dalla HEAD PR #633 e PostgreSQL16 effimero, sempre all'interno di `ROLLBACK` con SAVEPOINT. Test Chrome sintetici preesistenti invariati.

**NO-GO:** non sono stati approvati collegamenti PE reali, non è stata applicata la migrazione PE su staging o produzione e non è disponibile una prova end-to-end autenticata sulla release Android. La revisione delle tre identità, incluso il DOB discordante, precede ogni import reale. Solo l'Admin/DPO autorizza eventuali migrazioni, abilitazioni e release.
