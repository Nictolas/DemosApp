# DEMOS — migrazione users / user_profile: fase expand (28/10/2026)

**Stato: Draft; non distribuita e senza migrazioni SQL.** Riferimento operativo unico: Google Sheet «DEMOS – Roadmap – Tabella di Marcia», CHECKLIST MASTER, schede DB PROF - CAMPI / CODICE / GATE.

## Obiettivo e confini

Mantenere `users` per account, autenticazione e autorizzazioni; `user_profile` per dati personali. Mandati, candidature e appartenenze territoriali ufficiali/certificate hanno registri canonici separati. Residenza autodichiarata e collegio di voto **non sono intercambiabili**.

Il ramo introduce la **lettura** centralizzata dei quattro campi di residenza in due servizi e nel lookup dei consiglieri comunali: prevale `user_profile`, con fallback a `users` quando il valore manca. Per uno schema privo di `user_profile`, l'adapter usa la query legacy. Introduce inoltre un helper **di scrittura transazionale**, riutilizzato da modifiche al profilo, avatar e amministrazione, per mantenere allineate entrambe le tabelle finché il dual-write è necessario. Il codice rimane Draft: non è stato distribuito né ha riscritto dati di produzione.

## Baseline aggregata verificata (Supabase produzione, 28/10/2026)

- 1.857 record `users`, 1.717 `user_profile`, 140 account senza profilo; tutti PERSON.
- 26 colonne condivise escluse le colonne temporali.
- Avatar: 86 differenze di testo equivalenti come JSON; 4 avatar solo in users con profilo esistente e 8 avatar in account senza profilo.
- Elezioni: 37 `grado_elezione` solo nel profilo e 7 contrasti non null; due `grado_candidatura` solo nel profilo.
- Date di nascita: 2 contrasti, di cui uno con anno differente.
- Il precedente aggiornamento massivo di cittadinanza `it` ha alterato `users.updated_at` sugli utenti toccati: **non usarlo** per stabilire quale fonte sia corretta.
- Le cittadinanze dei futuri iscritti non vanno impostate a `it` per deduzione o default.

Il trigger SQL `users_sync_political_territories` si attiva dopo INSERT/UPDATE della residenza in `users`, riscrivendo i territori legacy in `user_political_territories`. **È vietato smettere di scrivere `users.residenza` o eliminarne le colonne prima di migrare e testare tale trigger**.

## Modifiche tecniche nella PR

- `api/services/userProfileReadService.js`: reader centralizzato, query parametrizzata, campo per campo COALESCE(user_profile, users), fallback di compatibilità solo per errori di schema.
- `api/services/politicalTerritoryMembershipService.js`: fallback della residenza per territori self-declared; gli ambiti VERIFIED/OFFICIAL continuano ad avere priorità.
- `api/services/eventFeedService.js`: lettura residenza per eventi mediante lo stesso adapter, mantenendo le selezioni di attivisti/organizzazioni in users.
- `api/services/userProfileWriteService.js`: upsert profilato con allowlist e parametri vincolati, eseguito nelle transazioni già presenti per utente/avatar e nella nuova transazione delle modifiche amministrative.
- `api/routes/users/search.js`: legge il comune del richiedente con il reader centralizzato e aggiorna `users`/`user_profile` atomici per la modifica amministrativa.
- Test unitari e PostgreSQL 17 sintetici per scritture/rollback/avatar JSONB; suite smoke di eleggibilità politica allineata al nuovo SQL.

## Gate prima di qualunque pulizia schema

1. Completare inventario **globale** delle letture/scritture SQL, query dinamiche, trigger, funzioni e job; i 41 riferimenti precedenti non sono esaustivi.
2. Progettare ed esercitare su staging un backfill transazionale idempotente dei 140 profili e 12 avatar, senza introdurre falsi dati di sesso/cittadinanza.
3. Riconciliare 7 contrasti di grado_elezione e 2 date, con fonte autorevole, senza dati personali nel Google Sheet.
4. Testare le risposte per E, P, organizzazioni, account senza profilo e CIE; testare GDPR export, revoca, cancellazione e autorizzazioni.
5. Migrare tutti i restanti lettori/scrittori, il trigger, e la sincronizzazione dei territori in una **migrazione versionata e revisionata**.
6. Testare in staging, controllare i piani di esecuzione, approvare il rollback, poi effettuare il rollout. Eliminare vecchie colonne solo in un rilascio separato e dopo zero consumer legacy.

## Divieti in questo ramo

Nessun DDL o aggiornamento dei dati di produzione, nessuna replica di dati personali sul Sheet, nessun cambiamento di sesso/genere, nessuna fusione o deploy automatico. Lo staging Supabase corrente non contiene ancora `user_profile` e `user_political_territories`: non equivale alla produzione e blocca le verifiche E2E della migrazione. Questa PR rimane Draft fino ai gate.

## Test isolati nello staging Supabase — 28/10/2026

È stato creato **solo su Demos-Staging** lo schema privato `qa_user_profile_20261028`: 8 account inventati, 7 profili, un caso senza profilo, una divergenza di residenza, un fallback `NULL`, un avatar legacy, un profilo organizzazione e un conflitto nel grado elettorale. La struttura replica le **colonne di profilo pertinenti** e i vincoli `user_id` PK/FK con `ON DELETE CASCADE`, ma **non è un clone dello schema completo produzione**. Le tabelle `public.users` e `public.user_consents` dello staging non sono state modificate e `public.user_profile` continua a mancare.

- Fixture versionato: `api/database/qa-user-profile-staging-isolated.sql`.
- Test non persistenti: `api/database/qa-user-profile-staging-backfill-rollback-test.sql`.
- Risultati SQL: 8 utenti sintetici, 7 profili; accesso allo schema negato ad `anon`, `authenticated` e `service_role`, RLS abilitata. Letture con precedenza profilo, fallback e tipi account superate.
- Backfill sintetico con protezione `ON CONFLICT`: prima esecuzione 1 nuovo profilo, seconda 0; modifica amministrativa di coppia di tabelle verificata; avatar JSONB invalido causa rollback del sottoblocco; **tutte le scritture di test sono annullate**.
- Verifica dopo test: 8/7 profili sintetici invariati, comune originario mantenuto; 2 utenti preesistenti in `public.users` staging invariati.
- La suite `api/tests/userProfileStagingFixture.integration.test.js` verifica fixture, rollback e isolamento su PostgreSQL 17 in GitHub Actions, senza utilizzare credenziali di Supabase.

**NO-GO invariato:** per rilasciare la migrazione resta da predisporre una replica *completa* dello schema produzione in ambiente isolato, senza dati reali, con il trigger politico, GDPR, elezioni, frontend/backend e flussi E2E; verificare rollback effettivo in quello staging e solo dopo considerare un cutover. Non promuovere lo schema QA sintetico a produzione e non cancellarlo mentre test in corso.
