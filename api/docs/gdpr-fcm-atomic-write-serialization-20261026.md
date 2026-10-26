# DEMOS — Scritture FCM atomiche e serializzate per account (PR DRAFT)

**26 ottobre 2026.** Continuazione delle PR #344 → #343 → #342 → #341 → #340 → #339 → #338 → #336 → #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302.

## Rischio confermato

Il router `api/routes/fcm-tokens.js` normalizza ormai nuovi token e usa solo `public.users` / `public.user_devices` (#344), ma prima di questa correzione faceva `getLegacyTokens`, `updateLegacyTokens`, upsert e disattivazione tramite `pool.query` indipendenti. Un errore al secondo o terzo passo lasciava il precedente già confermato, e richieste concorrenti sullo stesso utente potevano intercalarsi fino a riattivare o eliminare token obsoleti.

## Protocollo della PR

- `withLockedFcmUser(userId, operation)` acquisisce **un client PostgreSQL** dal pool ed esegue `BEGIN`, quindi `SELECT id FROM public.users WHERE id=$1 FOR UPDATE`. Se l'utente non esiste, `ROLLBACK` e HTTP 404 senza scritture. In caso contrario tutte le letture/modifiche del router avvengono **sullo stesso client e nella stessa transazione**: `COMMIT` soltanto dopo l'ultimo successo; `ROLLBACK` in caso di errore; `release` garantito nel `finally`.
- Il lock della riga `public.users` serializza POST, POST cleanup e DELETE **per lo stesso account**: la seconda richiesta non legge lo stato del token finché la prima non ha confermato/annullato il proprio aggiornamento. `public` è sempre qualificato.
- L'assenza della vecchia colonna `users.fcm_tokens` (SQLSTATE `42703`) è gestita in `withOptionalLegacyColumn` mediante **`SAVEPOINT` / `ROLLBACK TO SAVEPOINT`**. Senza questo accorgimento PostgreSQL lascerebbe la transazione in stato di errore `25P02`, impedendo il salvataggio canonico. Non vengono ignorati altri errori: causano rollback totale.
- Un `INSERT INTO public.user_devices ... ON CONFLICT(fcm_token) DO UPDATE` trasferisce ancora l'eventuale token canonico a un nuovo proprietario in modo coerente col comportamento precedente. Un DELETE successivo dell'account precedente non può disattivarlo, perché `WHERE user_id=$1` restringe la disattivazione al proprietario attuale.
- I campi di successo delle API, la validazione mobile-only, la normalizzazione della #344 e la precedenza dei token canonici delle #342–#343 rimangono invariati. La risposta HTTP 500 non espone `error.message` del DB neppure durante cleanup.

## Prove isolate

- `api/tests/fcmTokenNormalizedHttp.smoke.test.js` include un pool/client in-memory che modella BEGIN/COMMIT/ROLLBACK, savepoint SQL e blocco dello stesso utente. Le richieste reali su un server Express localhost verificano: interruzione dopo la prima scrittura per POST/cleanup/DELETE con restituzione dell'intero stato precedente; HTTP 404 di utente inesistente; `42703` e fallback transazionalmente riparato; registrazione concorrente bloccata mentre una successiva revoca attende e alla fine prevale. Questi mock **non sostituiscono** PostgreSQL reale.
- `api/scripts/verify-fcm-token-atomic-ci.js`: guardie esplicite per GitHub Actions, DB `political_consent_race_ci` locale, PostgreSQL **17**, utente/password sintetici e assenza di variabili provider. Avvia router Express vero, connessioni `pg` e fixture UUID inventate. Forza errori durante le tre operazioni e verifica lo stato reale post-rollback, pausa un POST **dopo** il blocco sulla riga per dimostrare che il DELETE concorrente aspetta e prevale, e controlla che il precedente proprietario non disattivi il token trasferito ad altro account. Per verificare il vero `42703`, elimina la colonna legacy **solo nel database CI disposable**, poi ne controlla il recupero tramite savepoint e ricrea la colonna prima di terminare. Nessuna operazione su provider reali.
- I test di integrità FCM vengono aggiornati per confermare presenza di `public.users FOR UPDATE`, transazioni e release del client. L'intero stack di prove di consenso/race PostgreSQL viene mantenuto.

## Limiti e decisioni esterne ancora necessarie

Questa atomicità vale **solo per i writer che usano il router aggiornato** e che rispettano lo stesso protocollo. Altri processi/scritture dirette su `users.fcm_tokens` o `user_devices` che non bloccano `public.users` potrebbero ancora interferire; serve un audit separato degli altri writer. In caso di trasferimenti incrociati fra account, la unique constraint del token può produrre un deadlock e PostgreSQL abortirà l'operazione, che non deve essere riportata come successo. Le richieste di rete Firebase rimangono fuori dalla transazione; nessun protocollo distribuito può garantire revoca atomica dopo l'ultima SELECT pre-invio della PR #339.

Il router mantiene per compatibilità gli account senza la colonna legacy ma **non** inventa tabelle canoniche mancanti. L'eventuale presenza di dati reali inconsistententi, la migrazione dei token storici e la verifica delle prestazioni devono essere valutate su un ambiente di staging autorizzato, senza assumere i contenuti di produzione.

L'issue **#296 rimane aperta**, con dipendenze indipendenti: journal GDPR esterno completo/fresco/durevole fino al freeze, quarantena effettiva Render/Supabase/Data API/worker, prove reali Backblaze B2 Object Lock COMPLIANCE/VersionId, approvazioni DPIA/titolare/DPO, retention e costi.

**Nessun merge, deploy, migrazione produzione, accesso a dati reali o credenziali, spesa o servizio attivato.**
