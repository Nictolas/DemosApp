# DEMOS — migrazione users / user_profile: fase expand (28/10/2026)

**Stato: Draft; non distribuita e senza migrazioni SQL.** Riferimento operativo unico: Google Sheet «DEMOS – Roadmap – Tabella di Marcia», CHECKLIST MASTER, schede DB PROF - CAMPI / CODICE / GATE.

## Obiettivo e confini

Mantenere `users` per account, autenticazione e autorizzazioni; `user_profile` per dati personali. Mandati, candidature e appartenenze territoriali ufficiali/certificate hanno registri canonici separati. Residenza autodichiarata e collegio di voto **non sono intercambiabili**.

Il ramo introduce la **lettura** centralizzata dei quattro campi di residenza in due servizi e nel lookup dei consiglieri comunali: prevale `user_profile`, con fallback a `users` quando il valore manca. Per uno schema privo di `user_profile`, l'adapter usa la query legacy. Introduce inoltre un helper **di scrittura transazionale**, riutilizzato da modifiche al profilo, avatar e amministrazione, per mantenere allineate entrambe le tabelle finché il dual-write è necessario. Il codice rimane Draft: non è stato distribuito né ha riscritto dati di produzione.

## Baseline aggregata verificata (Supabase produzione, 28/10/2026)

- 1.857 record `users`, 1.717 `user_profile`, 140 account senza profilo; tutti PERSON.
- 26 colonne condivise escluse le colonne temporali.
- Avatar: 86 avatar presenti in entrambe le tabelle e uguali semanticamente come JSON; **1.476 avatar validi solo in users con profilo già esistente**, più **138 avatar validi in account senza profilo**. Totale **1.614 da preservare**. Nessun avatar divergente quando valorizzato in entrambe, nessun JSON non valido. La vecchia stima 4+8=12 era errata.
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
2. Progettare ed esercitare su staging un backfill transazionale idempotente dei 140 profili e 1.614 avatar, senza introdurre falsi dati di sesso/cittadinanza.
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

## QA territoriale e semantica dei NULL espliciti — 28/10/2026

Il trigger reale `public.users_sync_political_territories` è stato ricostruito tramite `pg_get_triggerdef`/`pg_get_functiondef` in sola lettura: cancella e reinserisce soltanto le righe `source='legacy_profile'` dopo aggiornamenti di residenza in `users`. Non reagisce ad aggiornamenti in `user_profile`.

Nel SOLO schema privato `qa_user_profile_20261028` di Demos-Staging:

- `api/database/qa-user-profile-territory-trigger-fixture.sql` replica vincoli, indici e un trigger territoriale legacy; include una funzione candidata per futura sincronizzazione da `user_profile`, ma non la attiva.
- `api/database/qa-user-profile-territory-cutover-rollback-test.sql` riproduce la mancata sincronizzazione da profile, sostituisce il trigger soltanto in una sotto-transazione, verifica il nuovo aggiornamento, preserva le righe VERIFIED/OFFICIAL e annulla tutte le scritture e il DDL di prova.
- Il backfill avatar sintetico recupera i valori soltanto se il JSONB canonico è NULL, senza sovrascrivere quello già valorizzato; test di idempotenza 1 aggiornamento alla prima esecuzione, 0 alla seconda.
- La lettura attuale `COALESCE(p.comune_residenza,u.comune_residenza)` ripristina erroneamente da `users` un valore cancellato esplicitamente dal profilo. La PR aggiunge l'opzione `strictProfileOwner` (SPENTA di default): per profili esistenti usa il valore profile anche se NULL, per profili assenti usa il legacy e, se manca lo schema canonical, fallisce senza fallback silenzioso.

La modalità strict si attiverà solo DOPO la riconciliazione completa dei profili, il trasferimento di ownership del trigger e test end-to-end. Non attivare due trigger territoriali concorrenti in produzione e non equiparare residenza dichiarata e collegio elettorale verificato.

Staging QA e PostgreSQL17 sintetico non sono un ambiente E2E dell'app: nello staging operativo continuano a mancare `public.user_profile` e `public.user_political_territories`. Nessuna modifica di dati o struttura su Supabase produzione.

## Prestazioni dei filtri territoriali — verifica EXPLAIN di sola lettura

Su Supabase produzione (1.857 utenti, 1.717 profili), la query di ricerca per comune che usa `COALESCE(p.comune_residenza,u.comune_residenza)` presenta nel piano stimato `Hash Left Join` e `Seq Scan` su entrambe le tabelle; non è stato eseguito EXPLAIN ANALYZE. `user_profile` ha soltanto l'indice PK `user_id`; non c'è un indice su `comune_residenza` (né su altri campi di residenza) in questa tabella.

Il piano non misura latenza reale e non può essere estrapolato a un milione di account. Prima di migrare le query a molti destinatari (notifiche, sondaggi, avvistamenti), occorre costruire dataset sintetici realistici, misurare EXPLAIN ANALYZE fuori da produzione, valutare indici e query alternative (es. filtri distinti sui profili presenti e sui legacy assenti), e mantenere la semantica di fallback o strict owner per il corretto stato della migrazione.

Non creare indici in produzione in questa PR Draft, non riscrivere ancora le query di broadcast e non affermare benefici prestazionali non misurati.

## Verifica HTTP, minimizzazione log e benchmark sintetico (28/10/2026)

- In PR #382, le route di modifica profilo e avatar eseguono `upsertUserProfileFields` **solo se** `UPDATE users` ha effettivamente modificato un account. Se manca l'account, restituiscono HTTP 404 senza tentare un inserimento orfano. La modifica amministrativa aveva già lo stesso controllo.
- L'endpoint admin evita di registrare il payload con dati sensibili, il genere, l'e-mail di risposta e i valori delle modifiche; gli errori interni non vengono riportati al client. La revisione più ampia di tutti gli altri log dell'app resta fuori da questa PR.
- I test HTTP `api/tests/userProfileMissingAccount.smoke.test.js` coprono PUT profilo, POST avatar, PUT admin su account inesistente e payload admin di tipo non valido. Non equivalgono a E2E con sessioni reali e consenso GDPR.
- Sincronizzate nella PR le modifiche recenti di `main`: il sesso certificato CIE (`sesso`) resta campo di sola lettura e non viene sostituito dal vecchio `genere` nei form/admin PUT. GitHub indica la PR nuovamente integrabile, ma è ancora Draft e non distribuita.
- Test sintetico `api/tests/userProfileTerritoryPerformance.integration.test.js` su PostgreSQL 17: **100.000 utenti inventati**, 90.000 `user_profile`, indici sintetici sui comuni. Query legacy con `COALESCE` e query alternativa con rami disgiunti `UNION ALL` restituiscono esattamente **6.123** utenti per il comune scelto, 0 differenze in entrambe le direzioni.
- **Una sola esecuzione CI**: query COALESCE 43,273 ms, UNION ALL 35,200 ms. Sono misurazioni diagnostiche su hardware CI condiviso, non un benchmark affidabile, non SLA, non prova di scalabilità a un milione di utenti; prima di scegliere un piano occorrono ripetizioni e test distribuzioni reali/sintetiche diverse.
- Quattro workflow CI dopo il riallineamento: [profili](https://github.com/Nictolas/DemosApp/actions/runs/40733994487) 38 unit/smoke + 12 PG17; [identità civica](https://github.com/Nictolas/DemosApp/actions/runs/40733994453) 21; [CIE](https://github.com/Nictolas/DemosApp/actions/runs/40733994388) 2; [tabella sesso CIE](https://github.com/Nictolas/DemosApp/actions/runs/40733994342) 4. **77/77 test superati, 0 falliti.**

NO-GO invariato: nessun merge, rilascio, DROP o migrazione di dati produttivi. Lo staging Supabase `public` non replica ancora lo schema e i 140 profili/12 avatar reali restano intatti.

## Ricognizione integrale dei 26 campi e nuovo test di backfill (28/10/2026)

Il nuovo controllo aggregato, eseguito con le sole SELECT autorizzate su produzione, ha corretto una sottostima degli avatar: `user_profile.avatar_config` è ancora NULL in **1.476 profili esistenti** mentre `users.avatar_config` contiene JSON valido; **138 utenti senza profilo** possiedono un avatar valido nel record users. Sono quindi **1.614 avatar recuperabili**, non 12. Ci sono 86 coppie con avatar JSON semanticamente uguali, 0 conflitti JSON semantici, 0 legacy JSON invalidi.

La verifica aggregata degli altri 25 campi duplicati mostra: 0 discrepanze di cittadinanza/residenza; `grado_elezione` ha 37 valori solo nel profilo e 7 conflitti quando non nulli; `grado_candidatura` ha 2 valori solo nel profilo; `data_nascita` ha 2 conflitti non nulli. Non modificare automaticamente dati politici o anagrafici discordanti.

Il file `api/database/qa-user-profile-full-backfill-rehearsal.sql`, versionato nella PR, simula in una sotto-transazione **tutti i 26 campi** soltanto per profili mancanti; poi recupera avatar JSON validi per i profili esistenti **solo se il loro avatar è NULL**, in modo ripetibile. Controlla un grado elettorale conflittuale, la residenza canonica, l'avatar già presente, il profilo nuovo, la salvaguardia dei territori non legacy e l'assenza di effetti al termine (rollback). Test passato in QA privata di staging e in CI PostgreSQL 17; nessuna tabella `public` modificata.

Il preflight read-only `api/database/user-profile-preflight-readonly.sql` espone ora conteggi aggregati distinti dei profili senza avatar e dei profili assenti con avatar, più il totale recuperabile. Questa è la fonte ripetibile per un nuovo controllo appena prima di qualsiasi migrazione reale: **non hardcodare 1.614 o 140 in una migrazione di produzione**. La PR non è una migrazione produttiva, e lo staging operativo `public` non replica ancora l'intero schema.

## Cancellazione sintetica: ambito strettamente limitato

Il file `api/database/qa-user-profile-deletion-rollback-test.sql` prova soltanto la cancellazione in cascata via FK fra le tre tabelle sintetiche `qa_user_profile_20261028.users`, `user_profile` e `user_political_territories`. Inserisce due membership inventate con livelli SELF_DECLARED e VERIFIED, elimina un account finto, verifica l'eliminazione delle due membership e del suo profilo, mantiene intatto il profilo di un altro utente e poi annulla tutte le modifiche.

Test eseguito con esito positivo nello schema privato dello staging, versionato anche nella suite PostgreSQL 17 della PR. **Non è un test GDPR completo**: consenso/revoca, opinioni, voti, selezioni, token, archivi, backup e eventuali copie in altri sistemi non sono inclusi; la produzione e gli utenti reali non sono stati toccati.
