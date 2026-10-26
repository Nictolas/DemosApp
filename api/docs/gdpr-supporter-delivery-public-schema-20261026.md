# DEMOS — Destinatari push e notifiche politiche: lettura e scrittura sullo schema public

**26 ottobre 2026 — PR DRAFT stacked su #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302.**

## Rischio rilevato

Le PR #333–#335 hanno reso canoniche concessione/revoca del consenso, salvataggio delle preferenze e individuazione dei sostenitori. Ma due servizi downstream utilizzavano tabelle **non qualificate** dopo aver ricevuto gli ID dei sostenitori corretti:

- `currentSupporterPushService.loadCurrentSupporterTokens`: `users`, `user_consents` e `user_devices`, sia nel percorso primario (dispositivi + token legacy deduplicati) sia nel fallback su `fcm_tokens`.
- `politicalOpinionNotificationService.createSupporterOpinionNotifications`: `users`, `user_consents` nella SELECT che ricontrolla il consenso immediatamente prima dell'INSERT; `opinioni_domande` per il testo; `political_opinion_notifications` per l'inserimento.

PostgreSQL privilegia `pg_temp` per le relazioni non qualificate. Con un `search_path` alterato, un componente poteva recuperare token non canonici, trattare come consenziente un account con consenso revocato, usare un testo di opinione fittizio o scrivere la notifica in una tabella ombra. Il problema è distinto dalla selezione iniziale degli ID.

## Correzione

- Entrambi i percorsi di recupero token usano `public.users`, `public.user_consents`; il percorso primario legge `public.user_devices`.
- La query di inserimento notifica usa `INSERT INTO public.political_opinion_notifications` con destinatari `public.users` e controllo aggiuntivo in `public.user_consents`; i testi sono letti da `public.opinioni_domande`.
- Restano invariati i parametri, le API, l'ordinamento, la deduplicazione dei token, `status='a'`, `COALESCE` del consenso, la scrittura nella stessa transazione della modifica di opinione e i fallback su SQLSTATE `42P01`/`42703`.
- Nessun DDL o nuova variabile d'ambiente applicativa; non viene modificata la configurazione `search_path` delle connessioni.

## Test su PostgreSQL 17 disposable

La suite `api/scripts/verify-supporter-notification-consent-ci.js` mantiene i guardrail **`GITHUB_ACTIONS=true`**, **`POLITICAL_CONSENT_RACE_CI=synthetic`**, host `127.0.0.1`, database `political_consent_race_ci`, user `postgres`, password fittizia e rifiuto delle variabili di produzione. Ogni modifica alle fixture è in una transazione destinata a `ROLLBACK`.

1. Prepara utenti, consensi, selezioni, dispositivi, domande e notifiche nello schema canonico `public` e le stesse tabelle fittizie in `pg_temp`, con token, testi e consensi **deliberatamente discordanti**; imposta `SET LOCAL search_path=pg_temp,public`.
2. `loadCurrentSupporterTokens` deve restituire soltanto token canonici, escludendo un sostenitore revocato; una simulazione di `42P01` su `public.user_devices` verifica che il fallback non recuperi dati `pg_temp`.
3. Simula la revoca avvenuta dopo l'individuazione degli ID ma prima della SELECT dei token: i token dell'utente revocato devono essere esclusi.
4. Simula la revoca dopo l'individuazione degli ID ma prima dell'INSERT: nessuna notifica per l'utente revocato. Dopo il grant, una sola notifica canonica con testo da `public.opinioni_domande` deve essere salvata in `public.political_opinion_notifications`, lasciando vuota la tabella ombra omonima.
5. Preserva la prova di fallback legacy delle selezioni con un `42P01` simulato, non con modifiche DDL distruttive.

I test unitari dei servizi verificano ora esplicitamente lo schema degli oggetti SQL usati. Il drill non invia push reali e non contatta Firebase, B2 o infrastrutture reali. Non costituisce una verifica di Object Lock, delivery push o consent race distribuita su più infrastrutture.

## Limiti e prossime dipendenze

La scelta di una sorgente canonica non dimostra da sola che tutte le route e tutti i writer del progetto siano sicuri contro shadow relations. Rimane da verificare la **completezza/durabilità/freschezza indipendente degli eventi GDPR prima della perdita del database**, il freeze reale di Render/Supabase/Data API/worker, le prove B2 Object Lock COMPLIANCE/VersionId su staging, e i documenti/decisioni del titolare e DPO su DPIA, retention e costi. Nessuna autorizzazione alla riapertura del traffico deriva da questa PR.

**Nessun merge, deploy, migrazione, modifica produzione, dato reale, credenziale, spesa o servizio attivato.**
