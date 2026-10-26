# DEMOS — Token push: leggere account, consenso e dispositivi dallo schema public

**26 ottobre 2026. PR DRAFT basata su #336, che copre separatamente gli INSERT delle notifiche. Catena #336 → #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302.**

## Rischio

Il lookup di sostenitori in `politicalSelectionService` è vincolato a `public` (#335), ma `currentSupporterPushService.loadCurrentSupporterTokens` reinterrogava `users`, `user_consents` e `user_devices` senza schema, tanto nel recupero principale dei token quanto nel fallback per tabella dispositivi/colonna non presente. Con connessioni PostgreSQL riutilizzate e `search_path=pg_temp,public`, tabelle temporanee omonime potevano introdurre token estranei o far apparire consenzienti utenti effettivamente revocati. È un rischio distinto dagli INSERT delle notifiche trattati nella PR #336.

## Correzione minima

Le SELECT del servizio token utilizzano `public.users` e `public.user_consents` in entrambi i percorsi, e `public.user_devices` nel percorso principale. Rimangono invariati:
- deduplica dei token via `UNION` e `Set`;
- esclusione di dispositivi inattivi e token vuoti;
- filtro `status='a'` e consenso booleano `COALESCE(...,false) IS TRUE`;
- fallback SQLSTATE `42P01` / `42703`, API e scelta dell'ID sostenitore;
- assenza di invio effettivo nel drill CI: `loadCurrentSupporterTokens` non chiama Firebase.

## Prova isolata PostgreSQL 17

La suite `api/scripts/verify-supporter-notification-consent-ci.js` è guardata da `GITHUB_ACTIONS=true`, `POLITICAL_CONSENT_RACE_CI=synthetic`, host localhost, database dedicato `political_consent_race_ci`, credenziali fittizie e rifiuto delle variabili di produzione. Usa una sola transazione con rollback.

La prova ora:
1. Inserisce soltanto utenti, consensi, dispositivi e token inventati in `public`; crea omonimi `pg_temp.users`, `pg_temp.user_consents` e `pg_temp.user_devices` con token e consensi **contrari**.
2. Imposta `SET LOCAL search_path=pg_temp,public` e verifica che il servizio restituisca token canonici, senza token `shadow-*` o account revocati.
3. Simula `42P01` sulla query dispositivi `public.user_devices` e verifica che il fallback recuperi esclusivamente `public.users.fcm_tokens` rispettando nuovamente il consenso canonico.
4. Simula la revoca nel DB pubblico **dopo** la selezione degli ID ma **prima** della SELECT dei token e verifica la rimozione del destinatario dal risultato.
5. Continua a eseguire i test della PR #336 su INSERT delle notifiche e revoca prima della consegna, senza alterare la logica di quel servizio.

I DDL e i dati di test sono esclusivamente nel PostgreSQL 17 temporaneo di CI e annullati; non si modificano schema o configurazioni reali.

## Stato e limiti

Questo test copre il comportamento delle SELECT e del fallback, non dimostra consegna push reale né eventuali revoche intervenute **dopo** il recupero dei token ma **prima** di un invio Firebase asincrono. Lo scenario distribuito richiede analisi separata; il servizio push non dispone qui di una transazione o blocco esteso fino al provider. Restano inoltre non verificate completezza/freschezza/durabilità esterna dell'intero registro eventi GDPR prima di perdita DB, quarantena Render/Supabase/Data API/worker, prove reali Backblaze B2 Object Lock COMPLIANCE/VersionId e decisioni documentate DPIA/titolare/DPO, retention/costi.

**DRAFT: nessun merge, deploy, migrazione, modifica produzione, dati reali, segreti, spese o servizi attivati.**
