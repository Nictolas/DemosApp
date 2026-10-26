# DEMOS — Letture delle selezioni politiche sempre dallo schema canonico

**26 ottobre 2026 — PR DRAFT stacked su #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302.**

## Problema

Le PR #333 e #334 hanno allineato **concessione/revoca** del consenso e **scritture delle preferenze** alle tabelle `public`. Il servizio `api/services/politicalSelectionService.js` aveva però ancora query di lettura non qualificate:
- `loadPoliticalSelections`: scansione `political_selections` usata per le scelte personali e le classifiche;
- `loadLegacySelections`: proiezioni personali dei campi legacy di `users`;
- `loadSupporterUserIds`: join tra `political_selections`, `users`, `user_consents` e fallback legacy.

Una connessione PostgreSQL riutilizzata con `search_path=pg_temp,public` e copie temporanee omonime poteva far apparire una scelta inesistente, nascondere una scelta reale, identificare un sostenitore sbagliato o mostrare un sostenitore dopo la revoca di consenso nel database canonico. Il rischio riguarda letture personali, notifiche/push e targeting dei sostenitori.

## Modifica minima

Senza cambiare parametri, API, ordinamento, logica del consenso o criterio `status='a'`, il servizio usa nomi di tabelle **esplicitamente qualificati**:
- `public.political_selections` in scansioni e join canonici;
- `public.users` in letture legacy, join e fallback;
- `public.user_consents` nei join di consenso.

È compatibile con connessioni che operano con `pg_temp` o un `search_path` differente. Non altera il `search_path` della sessione e non richiede DDL nell'applicazione.

## Prove isolate

- Mock e test unitari relativi a selezioni, notifiche, push e fallback ora esigono `public.political_selections` dove necessario.
- Nel drill già esistente `api/scripts/verify-political-selection-write-revoke-race-ci.js`, protetto da controlli di ambiente che rifiutano produzione e provider, una sessione PostgreSQL 17 fittizia crea shadow `pg_temp.users`, `pg_temp.user_consents`, `pg_temp.political_selections`, inserisce selezioni e consensi contrastanti e usa `search_path=pg_temp,public`.
- `loadPoliticalSelections` deve ignorare la scelta falsa temporanea. `loadSupporterUserIds` deve individuare solamente chi sostiene il soggetto in `public` e rispettare **il consenso nello schema pubblico**, anche quando la shadow è favorevole. Un adattatore di test provoca un errore `42P01` sintetico sulla query canonica e verifica il **fallback legacy** `public.users`/`public.user_consents`; non elimina né rinomina alcuna tabella.
- Nel database disposable vengono aggiunte solo colonne di fixture `status` e `rappresentante_camera` a `public.users` sintetico, mai in produzione. I marcatori di test attestano solo il test isolato, non l'ambiente B2 reale.

## Limiti e attività separate

Alcuni componenti fuori dal servizio (es. letture dei token push e query SQL di inserimento notifiche) potrebbero avere altri riferimenti SQL non qualificati. **Non** considerarli coperti da questa PR: richiedono un audit separato, con test mirati. La validazione PG17 non dimostra che tutte le fonti GDPR siano complete e aggiornate fino al freeze, che l'infrastruttura Render/Supabase sia isolata, né che B2 Object Lock e VersionId siano stati verificati su un provider staging reale. Richiedono inoltre decisioni documentate del titolare e DPO su DPIA, retention e costi.

**Nessun merge, deploy, migrazione, modifica produzione, dato reale, credenziale o servizio attivato.**
