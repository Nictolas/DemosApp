# DEMOS — migrazione users / user_profile: fase expand (28/10/2026)

**Stato: Draft; non distribuita e senza migrazioni SQL.** Riferimento operativo unico: Google Sheet «DEMOS – Roadmap – Tabella di Marcia», CHECKLIST MASTER, schede DB PROF - CAMPI / CODICE / GATE.

## Obiettivo e confini

Mantenere `users` per account, autenticazione e autorizzazioni; `user_profile` per dati personali. Mandati, candidature e appartenenze territoriali ufficiali/certificate hanno registri canonici separati. Residenza autodichiarata e collegio di voto **non sono intercambiabili**.

Questo ramo modifica solo la **lettura** dei quattro campi di residenza in due servizi. Prevale `user_profile`, con fallback a `users` quando il valore manca. In caso di vecchio schema privo di `user_profile`, l'adapter utilizza la query legacy. Nessun dato è riscritto e il contratto del payload resta invariato.

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
- Test nuovi e adattamenti dei mock precedenti.

## Gate prima di qualunque pulizia schema

1. Completare inventario **globale** delle letture/scritture SQL, query dinamiche, trigger, funzioni e job; i 41 riferimenti precedenti non sono esaustivi.
2. Progettare ed esercitare su staging un backfill transazionale idempotente dei 140 profili e 12 avatar, senza introdurre falsi dati di sesso/cittadinanza.
3. Riconciliare 7 contrasti di grado_elezione e 2 date, con fonte autorevole, senza dati personali nel Google Sheet.
4. Testare le risposte per E, P, organizzazioni, account senza profilo e CIE; testare GDPR export, revoca, cancellazione e autorizzazioni.
5. Migrare tutti i restanti lettori/scrittori, il trigger, e la sincronizzazione dei territori in una **migrazione versionata e revisionata**.
6. Testare in staging, controllare i piani di esecuzione, approvare il rollback, poi effettuare il rollout. Eliminare vecchie colonne solo in un rilascio separato e dopo zero consumer legacy.

## Divieti in questo ramo

Nessun DDL o aggiornamento di produzione, nessuna replica di dati personali sul Sheet, nessun cambiamento di sesso/genere, nessuna fusione o deploy automatico. Questa PR rimane Draft fino ai gate.
