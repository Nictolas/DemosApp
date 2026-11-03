# DEMOS — crosswalk istituzionale per politici (POL-014 / POL-015)

Data: 29 ottobre 2026. Stato: **preflight OFFLINE e prototipo SQL di importazione esclusivamente per database di prova disposable**.
Issue: https://github.com/Nictolas/DemosApp/issues/396

## Perché

La PR #397 ha disattivato cinque importatori Camera/Senato che potevano generare una riga users per ogni grado. La PR #398 ha eliminato il backfill automatico che attribuiva mandati ACTIVE senza prova istituzionale. La PR #399 esclude tali mandati dalle query Admin che attestano incarichi correnti. Le PR fuse non bonificano i dati già esistenti.

Ricognizione precedente (28/10/2026), da non confondere con il controllo live successivo:
- 58 gruppi sospetti (NON 58 duplicati certi).
- 1.529 mandati LEGACY_BACKFILL ancora ACTIVE, 1.528 con data di importazione 13/10/2026.
- 7 coppie Camera/Senato già valutate e NON fuse, descritte nel file parliament-duplicate-review-20261028.md.
- Claudio Borghi richiede procedura separata perché un profilo contiene autenticazione, opinioni e selezioni.

## Verifica in sola lettura della produzione (29 ottobre 2026)

Usando esclusivamente SELECT sul database Supabase DEMOS attivo (PostgreSQL 17), senza esportare UUID, nomi o dati di autenticazione, ho ricontrollato le definizioni dei trigger e i soli conteggi aggregati:

- **1.524** mandati `LEGACY_BACKFILL` con stato `ACTIVE` (in precedenza 1.529, quindi il conteggio del 28/10 è superato); 39 `CANCELLED`, 6 `ENDED`.
- **1.674** utenti con `users.ruolo` in `P` o `CP`; di questi **1.524** hanno un mandato ACTIVE che deriva solo da `LEGACY_BACKFILL` e nessun ACTIVE di origine diversa. **150** utenti hanno almeno un mandato ACTIVE non legacy.
- La funzione **attualmente installata** `public.refresh_users_legacy_role` esamina `political_mandates` con `status='ACTIVE'` **senza escludere** `source='LEGACY_BACKFILL'`. Il file del repository `api/database/create-account-capabilities-model.sql` è stato modificato nella PR #398 per escludere il backfill, ma quella migrazione manuale **non è stata applicata alla funzione live**.
- Il trigger reale `political_mandates_refresh_legacy_role` richiama la funzione dopo INSERT/UPDATE/DELETE di mandati. L'importatore non esegue UPDATE `users` direttamente, **ma il trigger può modificare indirettamente `users.ruolo` e `users.updated_at`**. Il collaudo ora riproduce la logica live su dati fittizi.
- Aggiornare direttamente la funzione di proiezione, prima del ripristino di mandati attestati per tutte le persone, può modificare la visibilità e le statistiche politiche di oltre un migliaio di utenti. Si richiede piano di transizione, controllo degli endpoint, confronto pre/post e rollback.

Query aggregata ripetibile (sola SELECT, senza identificativi personali):
`api/scripts/audit-political-legacy-role-impact-20261029.sql`.

## Rafforzamento del collaudo

Il test PostgreSQL 17 in GitHub Actions ora usa una fixture sintetica che ricostruisce i trigger effettivamente rilevati sulla produzione il 29/10 (pur senza copiare righe reali). Copre anche:
- sovrapposizione di mandati ufficiali della **stessa** Camera;
- date di fine futuro non attestate: respinte; non si ipotizza la fine delle legislature;
- verifica che `account_type`, i flag admin/attivista e i ruoli istituzionali fittizi non cambino inattesi;
- la query statistica aggregata e la serializzazione concorrente.

GitHub Actions del commit `d043f374`: [run 40795067814](https://github.com/Nictolas/DemosApp/actions/runs/40795067814) SUCCESS per i job di audit offline e prova PostgreSQL 17. Non è una prova su un clone completo della produzione.

## Contratto d'ingresso

Un file JSON privato contiene un **array di casi di revisione**, assemblati solo dopo consultazione autorizzata dei dati e delle fonti ufficiali. NON commettere snapshot reali nel repository. Ogni caso include:

- case_id: codice sintetico del caso; non nome della persona
- user_ids: elenco di UUID di candidati profili DEMOS, almeno due
- accounts: una voce per ciascun UUID con has_auth booleano ottenuto da preflight autorizzato
- institutional_records: record per user_id con chamber (CAMERA o SENATO), official_id specifico dell'istituzione, source_url HTTPS di fonte ufficiale, legislature intera, starts_at e ends_at in data ISO; ends_at può essere null
- cross_chamber_evidence_url: fonte istituzionale che collega la persona a entrambe le Camere quando serve

I dati della Camera e del Senato **non hanno per forza lo stesso identificativo istituzionale**: l'identificativo è qualificato con l'istituzione. La presenza di due account con lo stesso nome o DOB, o di due fonti senza prova esplicita del loro collegamento, non basta.

## Esecuzione

Da una postazione autorizzata con Node.js:

    node api/scripts/audit-political-crosswalk.js --cases=/percorso/privato/casi.json

Per salvare localmente solo il report di controllo, su file nuovo e con permessi restrittivi:

    node api/scripts/audit-political-crosswalk.js --cases=/percorso/privato/casi.json --out=/percorso/privato/report.json

Lo stdout contiene **solo conteggi aggregati**. L'exit code è 0 quando tutti i casi sono pronti *per revisione manuale*, 2 se vi sono blocchi, 1 se l'input non è leggibile. **0 non significa autorizzazione al merge**. Nessun accesso al database, alla rete o a credenziali: nessun DML.

## Regole di blocco

- identificativi istituzionali riutilizzati da casi/profili differenti; profilo DEMOS presente in più casi
- account autenticato o preflight autenticazione incompleto
- mandato privo di identificativo, URL istituzionale, legislatura o date valide
- date Camera/Senato che risultano sovrapposte nello stesso caso
- manca un record istituzionale per uno dei profili
- manca il collegamento istituzionale Camera↔Senato per il caso

**MANUAL_REVIEW_REQUIRED** non equivale a IDENTITÀ_CERTIFICATA e non autorizza UPDATE o DELETE: resta obbligatorio controllare opinioni, consensi, GDPR, relazioni FK e non-FK, mandato storico/attuale, fonti, date, autorizzazioni e rollback.

## Estensione 29 ottobre: importer SQL con schema privato (non rilasciato)

Il file api/database/political-institutional-crosswalk-v1.sql è una migrazione MANUALE NON ESEGUITA su produzione o staging. Prepara lo schema interno demos_internal, revoca i diritti PUBLIC e abilita RLS senza politiche per gli utenti dell'API.

- official_political_identities: chiave univoca per (istituzione, identificativo ufficiale), collegata a un user_id canonico già esistente. Non crea account DEMOS.
- official_political_mandate_links: collega l'ID ufficiale, la legislatura, le date reali e una riga del mandato con provenienza; impedisce doppio collegamento allo stesso mandato.
- import_official_political_mandate: funzione SQL SECURITY INVOKER in schema privato, senza privilegi PUBLIC. Rifiuta ID in conflitto, account non PERSON, URL estranei, date incoerenti e sovrapposizioni di Camera/Senato verificate. Un doppio inserimento identico restituisce unchanged.
- Identità Camera e Senato rimangono distinte; non si consolidano profili sulla sola uguaglianza dei nomi o date di nascita.

Il parametro review_reference serve a documentare una verifica manuale esterna; **non certifica che tale verifica sia stata fatta**. Per usare questo importatore fuori dall'ambiente di test serve una procedura indipendente di attribuzione istituzionale e autorizzazione, con fonte e crosswalk firmati o validati. Il prototipo è volutamente privo di un endpoint pubblico o job automatico.

Le date ufficiali sono trattate come giorni di calendario: starts_at è 00:00 UTC del primo giorno; ends_on è inclusivo e diventa ends_at esclusivo alle 00:00 UTC del giorno successivo. I mandati con termine nel passato diventano ENDED. Gli attuali LEGACY_BACKFILL non sono riscritti.

Collaudo preparato su PostgreSQL 17 effimero: fixture SQL esclusivamente sintetiche, test idempotenza, collisioni, ACL, overlap, transazione ROLLBACK e due sessioni concorrenti. Riproduce il trigger di proiezione rilevato il 29/10, ma non dimostra ancora la compatibilità con l'intero database di produzione, le registrazioni, le opinioni o la validità delle fonti.

**Non eseguire questo file SQL su produzione o staging condiviso.** La PR resta Draft. Per un uso reale occorrono revisione manuale degli identificativi, test schema compatibile e rollback, permessi minimi controllati e autorizzazione specifica al rilascio.

## Passi successivi per diventare un vero importatore identity-first

1. Stabilire uno schema di mapping istituzionale durevole e regole di unicità per (istituzione, official_id), progettando la relazione tra identificativi Camera/Senato della stessa persona.
2. Importare roster ufficiali per legislatura con timestamp verificati e provenance; **non derivare ACTIVE da users.ruolo o users.grado_elezione**.
3. Testare in PostgreSQL temporaneo le transazioni idempotenti di inserimento/aggiornamento dei mandati legati a uno user_id canonico, incluso rollback e conflitti di identità.
4. Solo dopo autorizzazione per ogni caso valutare la bonifica dei 58 gruppi sospetti, evitando fusioni automatiche di elettori, account autenticati o i sette casi già bloccati.
5. Confrontare liste rappresentanti, Sondaggi, Opinioni, statistiche e richieste GDPR prima e dopo; non nascondere tutti i politici legacy senza un roster attuale sostitutivo.

La PR prepara sia il preflight sia un prototipo SQL NON distribuito; **nessuna modifica a Supabase, Render, al frontend o ai mandati reali**.

## Verifica fonti istituzionali e ID canonici (29 ottobre 2026)

Ricognizione pubblica di sette schede ufficiali documentata in
`api/docs/political-institutional-source-evidence-seven-20261029.md` con dati
strutturati e privi di UUID DEMOS in
`api/docs/political-public-source-evidence-seven-20261029.json`.
Tutte mostrano una carriera pubblica tra Camera e Senato; nessun account
DEMOS è stato mappato, nessun `starts_at`/`ends_at` è stato ricostruito e
nessuna approvazione di importazione è stata creata.

Correzione di una incongruenza del preflight: le schede del Senato reali
usano un URL `https://www.senato.it/composizione/senatori/elenco-alfabetico/scheda-attivita?did=00018055`
o, per l'export, `/export/senator/full/19/18055`.
L'auditor precedente rifiutava TUTTE le query string, quindi respingeva
le schede reali. Ora consente esclusivamente il `did` numerico su percorsi
di scheda riconosciuti (oppure il percorso export) e confronta
l'identificativo canonico **senza zeri iniziali** con l'URL. I percorsi
RDF `dati.camera.it/ocd/deputato.rdf/<id>` sono confrontati con il proprio
ID dichiarato. Il solo host istituzionale senza corrispondenza di ID non
basta.

L'importatore SQL PostgreSQL nel ramo Draft applica lo stesso controllo
per Camera RDF e Senato scheda/export, prima ancora di consultare il
registro privato delle approvazioni. I test isolati coprono URL manipolati,
ID discordanti, zeri iniziali, collisioni, date sovrapposte, rollback e
concorrenza. Restano obbligatorie fonti per **ogni** legislatura e
l'attribuzione verificata di un profilo DEMOS reale: il registro pubblico
non è l'approvazione privata e non deve essere importato automaticamente.

## Gate di approvazione separata (29/10/2026)

Il prototipo SQL è stato reso **fail closed**: prima di eseguire una funzione di importazione occorre un record esatto in `demos_internal.approved_political_mandate_imports`. Inserire soltanto `review_reference` e `reviewed_by` nei parametri della funzione **non è più sufficiente**.

La tabella approvazioni è in uno schema privato, con RLS abilitata e privilegi `PUBLIC` revocati, senza endpoint né policy per i ruoli dell'app. Il record deve corrispondere a **istituzione, ID ufficiale, legislatura, inizio, fine, UUID canonico, URL della fonte, riferimento di revisione e revisore**. La corrispondenza è controllata `FOR SHARE` nella transazione. L'approvazione deve essere registrata separatamente da un amministratore autorizzato **dopo verifica sostanziale** della fonte e della relazione tra identità parlamentare e persona: la tabella non prova, da sola, che tale controllo sia avvenuto.

Per i soli test PostgreSQL 17, i dati fittizi delle approvazioni sono in `api/tests/fixtures/politicalInstitutionalCrosswalk.approvals.pg17.sql` e vengono caricati in un passaggio separato. Il test SQL include i rifiuti per import senza approvazione, revisore non corrispondente, collisione dello stesso ID attribuito a due utenti e variazioni di mandato non approvate.

Limiti: lo script continua ad accettare informazioni pre-verificate e non scarica né certifica automaticamente i roster della Camera o del Senato; non verifica una firma indipendente del revisore. In un ambiente futuro separare il ruolo che approva dai privilegi che eseguono l'importazione, mantenere audit append-only e una procedura di revoca. Nessun accesso applicativo alla tabella approvazioni.

**Nessuna approvazione di una persona reale è stata creata e nessun mandato di produzione è stato importato.**
