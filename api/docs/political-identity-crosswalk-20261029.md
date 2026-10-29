# DEMOS — crosswalk istituzionale per politici (POL-014 / POL-015)

Data: 29 ottobre 2026. Stato: **preflight OFFLINE e prototipo SQL di importazione esclusivamente per database di prova disposable**.
Issue: https://github.com/Nictolas/DemosApp/issues/396

## Perché

La PR #397 ha disattivato cinque importatori Camera/Senato che potevano generare una riga users per ogni grado. La PR #398 ha eliminato il backfill automatico che attribuiva mandati ACTIVE senza prova istituzionale. La PR #399 esclude tali mandati dalle query Admin che attestano incarichi correnti. Le PR fuse non bonificano i dati già esistenti.

Ultima ricognizione documentata, **non ricalcolata da questo strumento**:
- 58 gruppi sospetti (NON 58 duplicati certi).
- 1.529 mandati LEGACY_BACKFILL ancora ACTIVE, 1.528 con data di importazione 13/10/2026.
- 7 coppie Camera/Senato già valutate e NON fuse, descritte nel file parliament-duplicate-review-20261028.md.
- Claudio Borghi richiede procedura separata perché un profilo contiene autenticazione, opinioni e selezioni.

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

Collaudo preparato su PostgreSQL 17 effimero: fixture SQL esclusivamente sintetiche, test idempotenza, collisioni, ACL, overlap, transazione ROLLBACK e due sessioni concorrenti. Non dimostra ancora la compatibilità dei trigger di proiezione del ruolo su database reale, il comportamento completo di registrazioni e opinioni, o la validità delle fonti.

**Non eseguire questo file SQL su produzione o staging condiviso.** La PR resta Draft. Per un uso reale occorrono revisione manuale degli identificativi, test schema compatibile e rollback, permessi minimi controllati e autorizzazione specifica al rilascio.

## Passi successivi per diventare un vero importatore identity-first

1. Stabilire uno schema di mapping istituzionale durevole e regole di unicità per (istituzione, official_id), progettando la relazione tra identificativi Camera/Senato della stessa persona.
2. Importare roster ufficiali per legislatura con timestamp verificati e provenance; **non derivare ACTIVE da users.ruolo o users.grado_elezione**.
3. Testare in PostgreSQL temporaneo le transazioni idempotenti di inserimento/aggiornamento dei mandati legati a uno user_id canonico, incluso rollback e conflitti di identità.
4. Solo dopo autorizzazione per ogni caso valutare la bonifica dei 58 gruppi sospetti, evitando fusioni automatiche di elettori, account autenticati o i sette casi già bloccati.
5. Confrontare liste rappresentanti, Sondaggi, Opinioni, statistiche e richieste GDPR prima e dopo; non nascondere tutti i politici legacy senza un roster attuale sostitutivo.

La PR prepara sia il preflight sia un prototipo SQL NON distribuito; **nessuna modifica a Supabase, Render, al frontend o ai mandati reali**.
