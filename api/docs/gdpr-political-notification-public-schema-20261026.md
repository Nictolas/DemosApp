# DEMOS — notifiche opinioni politiche e schema canonico

**26 ottobre 2026 — intervento DRAFT derivato da PR #335, dipendenza #296.** Nessun merge, deploy, migrazione, dato reale, configurazione B2/Supabase/Render, segreto o servizio attivato.

## Rischio e mitigazione limitata

Il servizio `api/services/politicalOpinionNotificationService.js` usa le selezioni dei sostenitori lette dallo schema `public` (PR #335), ma recuperava testi e notifiche tramite `opinioni_domande`, `political_opinion_notifications`, `users`, `user_consents` senza schema. Se una connessione è riutilizzata con `search_path=pg_temp,public`, le tabelle temporanee possono cambiare soggetti, consensi, contenuti o destinazione dell'INSERT. Si qualificano ora esplicitamente `public.opinioni_domande`, `public.political_opinion_notifications`, `public.users` e `public.user_consents`.

Il filtro di consenso e stato attivo rimane nell'INSERT (secondo controllo dopo lookup dei sostenitori). Non cambia il contratto di API, la transazione che avvolge il salvataggio, né la gestione dei valori f/c/i.

## Prove

- I test unitari delle notifiche richiedono i nomi `public` e preservano l'assenza di query per cambiamenti non validi.
- Il test `verify-supporter-notification-consent-ci.js` su PostgreSQL 17 **solo fittizio, localhost, in CI** crea omonimi `pg_temp` intenzionalmente discordanti; imposta la tabella pubblica delle domande e delle notifiche nel perimetro di una transazione che termina sempre con `ROLLBACK`. Deve osservare un'INSERT esclusivamente su `public.political_opinion_notifications` e il testo dalla domanda pubblica; simula poi revoca in `public.user_consents` prima della successiva INSERT e richiede zero nuove notifiche.
- Prima di considerare la PR pronta, controllare su HEAD tutti i workflow Actions relativi alla PR, non quelli dei commit o tentativi precedenti.

## Limiti e dipendenze

La correzione non prova che *tutti* i servizi a valle (push, feed e altre route) siano protetti da omonimie `pg_temp`; serve audit separato. La verifica INSERT non dimostra ancora la sicurezza di tutte le interleaving concorrenti tra revoca e notifiche, né un consenso completo su tutti i percorsi.

L'issue #296 rimane **bloccata**: disponibilità di registro eventi esterno indipendente, completo e fresco fino al freeze, verifica della sua durabilità prima della perdita del DB, isolamento effettivo di Render/Supabase/Data API/worker, readback B2 Object Lock/VersionId/retention su staging reale, approvazioni DPIA/titolare/DPO e decisioni su conservazione e costi. Questo ramo non autorizza la riapertura della produzione.
