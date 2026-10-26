# DEMOS — transazioni di consenso GDPR sullo schema canonico

**26 ottobre 2026. Modifica proposta in PR DRAFT, stacked su #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302.**

## Difetto e rischio

Il ledger delle cancellazioni/revoche registra ora gli eventi in `public.privacy_erasure_ledger` e la pulizia delle opinioni politiche usa `public`. Ma il router `api/routes/user/political-opinions-consent.js` leggeva `users`/`user_consents` e faceva grant/revoke con `UPDATE users`, `INSERT INTO user_consents` non qualificati.

In PostgreSQL i nomi non qualificati possono risolvere tabelle omonime `pg_temp` oppure relazioni di uno schema presente in `search_path` su connessioni riutilizzate. Una revoca potrebbe allora risultare riuscita (UPDATE su tabella temporanea + evento scritto nel ledger pubblico), mentre il consenso canonico resterebbe attivo. Un grant potrebbe registrare un evento senza aver aggiornato il consenso reale. La lettura GET potrebbe esporre uno stato non canonico.

## Correzione minima

- GET del consenso: `FROM public.users u LEFT JOIN public.user_consents uc`.
- POST grant: `UPDATE public.users` e `INSERT INTO public.user_consents ... ON CONFLICT ...` nella stessa transazione e prima dell'evento ledger.
- PUT revoke: le medesime tabelle `public`, seguite dal cleanup canonico e dall'evento ledger nella stessa transazione.
- Mantiene identificatori, API, status HTTP, rollback, blocco della riga `users` del normale `UPDATE`, audit e semantica della revoca. Nessun nuovo DDL o flag nella logica applicativa.
- I test unitari ora richiedono esplicitamente SQL `public`; la prova di concorrenza aggiorna il proprio intercettatore SQL senza disattivare i controlli sui lock.

## Regressione PostgreSQL 17 disposable

Estensione del drill HTTP `api/scripts/verify-political-consent-save-race-ci.js`, già protetto dai vincoli **`GITHUB_ACTIONS=true`**, `POLITICAL_CONSENT_RACE_CI=synthetic`, `PGHOST=127.0.0.1`, DB `political_consent_race_ci`, utente `postgres`, password puramente fittizia e rifiuto delle variabili di produzione.

Su tutte le connessioni del pool synthetic crea `pg_temp.users` e `pg_temp.user_consents` omonime, seleziona intenzionalmente `search_path=pg_temp,public`, imposta valori opposti in tabelle canoniche e temporanee, ed esegue **le vere GET/POST/PUT HTTP**. Esige che:
1. GET legga lo stato reale `public` anche quando la copia shadow indica il contrario;
2. POST modifichi entrambe le tabelle `public`, lasciando inalterate le shadow;
3. PUT revochi realmente il consenso `public` senza cambiare le shadow;
4. le connessioni vengano pulite (reset search_path e DROP delle tabelle temporanee) prima dell'uscita.

Nel drill HTTP il ledger è mockato come nel precedente test di concorrenza: la prova della **scrittura reale del ledger/outbox** resta nelle suite PostgreSQL 17 outbox e recovery delle PR #331–#332. Questo test non sostiene di verificare una pipeline completa verso B2.

## Dipendenze ancora aperte

Nessun codice/test può attestare da solo la completezza e freschezza indipendente del registro o che un evento sia stato archiviato fuori dal database **prima** del guasto. Restano verifiche separate di freeze Render/Supabase/Data API, worker e altre tabelle, prove Backblaze B2 COMPLIANCE/VersionId/retention reali su staging e decisioni documentate del titolare/DPO su DPIA, retention e costi.

**Nessun merge, deploy, migrazione, modifica produzione, segreto, accesso a dati reali o servizio attivato. Nessuna autorizzazione a riaprire il traffico.**
