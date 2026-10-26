# DEMOS — Precedenza canonica FCM in tutti i canali di notifica

**26 ottobre 2026 — PR DRAFT basata sulla #346.** Nessun rilascio né accesso a utenti, database o Firebase reali.

## Rischio confermato dal codice

Le PR #342 e #343 hanno stabilito un principio di sicurezza: una riga in `public.user_devices` rende **non autorevole** la copia dello stesso token in `public.users.fcm_tokens` legacy, anche quando la riga è inattiva (`is_active=false`) oppure intestata a un altro account. La PR #346 estende ai tre writer Firebase l'invalidazione transazionale, che conserva deliberatamente la riga inattiva come tombstone.

Tuttavia le **letture** dei destinatari restavano incoerenti:
- `api/routes/comunicazioni.js`: la funzione `getResolvedFcmTokensForUser` selezionava i dispositivi attivi e, solo in loro assenza, riutilizzava **tutto** l'array legacy senza controllo di presenza di righe canoniche inattive/trasferite. Altre **sei** query aggregate di notifiche Demos usavano `UNION` diretto fra dispositivi attivi e legacy.
- `api/routes/avvistamenti.js`: la ricerca di vicini usava lo stesso `UNION` non filtrato, potendo selezionare copie di token già disattivati.
- Tra la SELECT iniziale e i molteplici invii Firebase, un utente può revocare il token o trasferire il dispositivo. Una lista iniziale corretta potrebbe diventare obsoleta prima dell'ultimo invio.
- Le query originarie erano anche sensibili allo `search_path` (relazioni `users` e `user_devices` non qualificate). I log di alcune comunicazioni includevano prefissi token FCM; il broadcast accumulava token invalidi in una lista condivisa fra destinatari.

## Soluzione concreta

Il nuovo `api/services/fcmRecipientTokenService.js` esporta:
- `RECIPIENT_FCM_TOKENS_LATERAL_SQL`: **un solo** frammento parametrizzabile rispetto alla relazione `public.users u`, che restituisce token normalizzati e deduplicati. Unisce i dispositivi `public.user_devices` attivi di quell'account ai soli token legacy **senza nessun record canonico** dello stesso token, di qualsiasi proprietario/stato. Il controllo del legacy usa prima l'uguaglianza esatta, potenzialmente indicizzabile tramite `UNIQUE(fcm_token)`, e in caso di assenza di match effettua il controllo con `btrim` per riconoscere vecchie righe con whitespace. Non cancella alcun record.
- `loadRecipientFcmTokensForUser(pool,userId)`: una SELECT su `public.users u` con il medesimo frammento per le notifiche dirette.
- `isRecipientFcmTokenCurrentlyActive(pool,{userId,token})`: una SELECT di autorizzazione read-only **immediatamente prima di ogni invio**, con account UUID e token parametrizzati. Se l'account non possiede più il token o la query fallisce, il caller **non chiama Firebase**. Non registra i token nei log.

**Tutti i sette blocchi `LEFT JOIN LATERAL` di `comunicazioni.js` (sei) e `avvistamenti.js` (uno)** sono sostituiti da questo frammento, non da implementazioni copiate. Il resolver di comunicazioni dirette usa lo stesso servizio. Le query `FROM users u` di comunicazioni e avvistamenti sono qualificate `FROM public.users u`, e la lookup del comune è su `public.users`.

Per le notifiche dirette e i broadcast Demos il check pre-invio è *fail-closed*: su revoca, trasferimento o errore SQL non si spedisce la push. **Un errore della SELECT non è trattato come errore di Firebase** e non invalida erroneamente il token. In avvistamenti il ricontrollo precede `admin.messaging().send` e un errore ne impedisce l'invio. I token invalidi nei broadcast sono ora raccolti **per destinatario**, evitando riutilizzi della lista di un altro utente. Sono rimossi due log che stampavano prefissi effettivi dei token FCM.

Il contratto del database prevede ancora `public.user_devices` e `public.users.fcm_tokens`: questa PR non amplia i fallback di schema in assenza della tabella canonica.

## Regressioni verificabili senza accesso a provider

- `api/tests/fcmRecipientTokenPrivacy.test.js` controlla SQL schema-pinned, priorità dei record canonici, sei+uno blocchi LATERAL, unicità del resolver, ricontrolli prima dell'invio, token UUID parametrizzati e comportamento negativo per account/token non verificabili.
- `api/scripts/verify-fcm-token-atomic-ci.js` (già guardato con variabili CI sintetiche, postgres su localhost, PostgreSQL 17, account artificiali) prova **lo stesso frammento eseguito su PG17** con un account che ha legacy contenente token canonici inattivi, trasferiti e con spazi; soltanto un token genuinamente legacy-only deve comparire. Verifica inoltre che il token trasferito sia valido per il proprietario attuale, che una invalidazione successiva alla selezione impedisca la push e che relazioni `pg_temp.users`/`pg_temp.user_devices` ostili non cambino la risposta. Marcatori attesi: `FCM_RECIPIENT_CANONICAL_PRECEDENCE_PG17_PASS`, `FCM_RECIPIENT_PRESEND_REVOKE_PG17_PASS`, `FCM_RECIPIENT_SHADOW_SCHEMA_PG17_PASS`.
- Le prove esistenti sul rollback transazionale FCM, sull'invalidazione condivisa e sul consenso politico rimangono nella stessa suite GitHub Actions. Nessun test contatta Firebase reale o legge dati autentici.

## Limiti e dipendenze

- **La finestra SQL→Firebase non è atomica**: una revoca dopo la verifica ma prima dell'accettazione/consegna dal provider può ancora comportare un messaggio. La soluzione aggiunge circa **una SELECT per token** inviable, oltre alle query di selezione; i costi reali e i piani SQL non sono stati misurati su staging.
- Le preferenze `notifiche_preferenze` e lo stato dell'utente vengono controllati principalmente nella query iniziale di broadcast, non riesaminati dal nuovo helper per token. Un cambiamento di preferenza dopo la selezione iniziale necessita un audit distinto.
- La normalizzazione dei token legacy può richiedere scansioni non indicizzate quando manca il match esatto. Non è stata creata alcuna nuova migrazione o indice.
- Il comportamento di altri percorsi Firebase, job esterni e script manuali rimane da verificare prima di affermare una copertura universale. In particolare una migrazione e l'eventuale bonifica dei valori storici necessitano autorizzazioni separate.
- **Issue #296 ancora aperta:** journal GDPR indipendente completo/fresco/durevole fino al freeze, quarantena verificabile di Render/Supabase/Data API/worker, test reali B2 Object Lock COMPLIANCE/VersionId/retention sul provider staging e decisioni titolare/DPO su DPIA, conservazione e costi.

**Nessun merge, deploy, migrazione di produzione, accesso a dati reali, configurazione di credenziali, costi o servizi attivati.**
