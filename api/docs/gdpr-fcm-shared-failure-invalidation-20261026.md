# DEMOS — Invalidazione FCM coordinata fra tutti i writer Firebase

**26 ottobre 2026 — PR DRAFT stacked su #345 → #344 → #343 → #342 → #341 → #340 → #339 → #338 → #336 → #335 → #334 → #333 → #332 → #331 → #330 → #329 → #328 → #327 → #326 → #302. Issue #296 ancora aperta.**

## Problema confermato nel repository

La PR #345 mette in transazione il router di registrazione/cleanup/DELETE `api/routes/fcm-tokens.js`, prendendo `SELECT id FROM public.users WHERE id=$1 FOR UPDATE` prima di modificare `public.user_devices` e `public.users.fcm_tokens`.

Un audit delle chiamate FCM individuava **tre ulteriori percorsi applicativi** di invalidazione automatica di token respinti da Firebase:

- `api/routes/comunicazioni.js`: `invalidateUserFcmTokens` eseguiva separatamente un `UPDATE user_devices` con `pool.query` e una SELECT/UPDATE legacy; un errore nel registro veniva ignorato, mentre la colonna legacy poteva essere riscritta dopo una registrazione concorrente.
- `api/routes/avvistamenti.js`: dopo `messaging/registration-token-not-registered` o `messaging/invalid-registration-token` eseguiva due `pool.query` separati su registro e legacy senza blocco comune.
- `api/services/operationalAlertService.js`: `invalidateToken` eseguiva `DELETE FROM user_devices WHERE fcm_token = $1` senza limitazione sul proprietario. Eliminare la riga **non è equivalente a disattivarla**: in #342 era stata stabilita la precedenza di un record canonico (anche `is_active=false`) sulle copie legacy. La cancellazione riapriva la possibilità di riabilitare un token obsoleto tramite `users.fcm_tokens`.

Questi writer potevano aggirare la serializzazione del router e, nell'ultimo caso, perdere la riga/tombstone canonica necessaria a impedire resurrezioni legacy.

## Implementazione

Il nuovo `api/services/fcmTokenInvalidationService.js` espone:

```js
invalidateFailedFcmTokens(pool, { userId, tokens })
```

Riceve solo token stringa, li normalizza con `trim()` e li deduplica; input vuoti non effettuano query. Per una richiesta valida:

1. Acquisisce **un client PostgreSQL** dal pool: `BEGIN` → `SELECT id FROM public.users WHERE id=$1 FOR UPDATE`. È **lo stesso ordine del router #345**, così i writer di uno stesso account non possono leggere e aggiornare il suo stato nello stesso momento.
2. `UPDATE public.user_devices SET is_active=FALSE` limitato a `user_id=$1`, `is_active=TRUE`, `btrim(fcm_token) = ANY($2::text[])`. **Non esegue mai DELETE**, neppure per token non validi: la presenza del record canonico continua a escludere copie legacy.
3. Mediante `SAVEPOINT fcm_invalid_legacy`, legge `public.users.fcm_tokens` e rimuove solo i valori la cui forma normalizzata corrisponde ai token invalidi; aggiorna la colonna nello stesso client. `42703` su una colonna legacy assente è recuperato con `ROLLBACK TO SAVEPOINT`; ogni altro errore annulla **l'intera transazione**.
4. `COMMIT` solo se tutti i passaggi necessari riescono, `ROLLBACK` e `release` garantiti in caso di errore. Gli errori grezzi e i token non vengono stampati dai nuovi helper.

I tre punti di invalidazione ora delegano al servizio condiviso. `operationalAlertService` passa anche `device.user_id`: un errore ritardato relativo al precedente proprietario **non deve disattivare** il token trasferito a un altro account. Per gli avvisi operativi, un errore del servizio di invalidazione è segnalato soltanto mediante SQLSTATE generico, non con `error.message`.

Questa modifica riguarda soltanto l'invalidazione dopo un errore Firebase; nessuna modifica ai contenuti delle notifiche, nessuna migrazione o nuova tabella, nessun provider contattato nei test.

## Prove con dati inventati

- `api/tests/fcmTokenInvalidation.test.js`: unit test di normalizzazione/deduplica, lock e transazione, rollback completo se la modifica legacy fallisce dopo la disattivazione canonica, recupero `42703` tramite savepoint, utente mancante o token vuoto.
- `api/tests/fcmTokenWriterAudit.test.js`: verifica che i tre writer non contengano più DELETE dei token canonici o UPDATE separati su `user_devices`/legacy, e che chiamino il servizio comune col proprietario previsto. È una protezione statica contro regressioni nel codice, non un sostituto di un audit dell'ambiente.
- `api/scripts/verify-fcm-token-atomic-ci.js`: già usava un database PostgreSQL 17 disposable con un server HTTP localhost, credenziali sintetiche e sentinelle anti-produzione; la prova è estesa per validare **sul database reale isolato** la conservazione del record inattivo, rollback delle due fonti in caso di fault injection, savepoint con colonna legacy assente e impossibilità per il precedente proprietario di disattivare il record trasferito. Marcatori: `FCM_SHARED_INVALIDATION_MISSING_LEGACY_PG17_PASS`, `FCM_SHARED_INVALIDATION_ROLLBACK_PG17_PASS`, `FCM_SHARED_INVALIDATION_CANONICAL_PG17_PASS`, `FCM_SHARED_INVALIDATION_TRANSFER_PG17_PASS` (validi solo dopo workflow CI riuscito).
- La suite privacy esistente continua a eseguire i test per selezione dei destinatari e revoca in corso, grazie al workflow aggiornato. **Nessuna chiamata Firebase reale**, nessun dato personale e nessun accesso a Supabase di produzione.

## Dipendenze e limiti

- La serializzazione **non riguarda** writer esterni al repository, tool SQL manuali o migrazioni eseguite senza lo stesso protocollo. L'audit ha individuato nel repository anche `api/fix_fcm_tokens.sql` e `pulisci-token-fcm-invalidi.sql`: sono **script di manutenzione manuale**, non stati eseguiti e non vanno considerati compatibili con l'esclusione concorrente senza riesame.
- `comunicazioni.js` e `avvistamenti.js` hanno ancora query di selezione dei destinatari che potrebbero ripescare `users.fcm_tokens` legacy quando un record canonico è inattivo. Il presente intervento ripara i **writer**, non attesta sicurezza di tutte le **letture/invii** dei canali diversi da quello dei sostenitori; occorre un audit separato.
- La validazione Firebase di un token può diventare obsoleta rispetto a una registrazione successiva; l'invalidazione rispetta l'ordine di acquisizione del lock, ma non include una versione/epoch di validità esterna. Una prova di atomicità multi-provider non sarebbe veritiera.
- Le query `btrim` hanno costi non misurati su staging reale e possono non utilizzare l'indice btree puro sul token; nessuna promessa di risparmio economico.
- L'issue **#296** resta bloccata da ledger GDPR esterno indipendente completo/fresco/durevole, quarantena Render/Supabase/Data API/worker, verifiche B2 Object Lock COMPLIANCE/VersionId/retention in staging e decisioni DPIA/titolare/DPO/retention/costi.

**Nessun merge, deploy, migrazione, accesso a dati reali o produzione, configurazione credenziali, spesa o attivazione servizi.**

## Addendum 26 ottobre 2026 — selezione dei destinatari

Le query in `comunicazioni.js` e `avvistamenti.js` condividono `fcmTokenReadResolver.js`. Un token legacy è scartato se esiste un record canonico corrispondente, anche inattivo o trasferito. I token storici con spazi sono normalizzati. Un controllo immediatamente prima di ogni invio Firebase evita l'uso di token revocati dopo la selezione; un errore di lettura blocca l'invio senza invalidare il token. Non vi è atomicità con la consegna remota Firebase. I test PostgreSQL 17 disposable coprono questi scenari senza provider esterni né dati reali. L'issue #296 rimane aperta.

## Addendum — riduzione log FCM e invalidazioni multiutente

I percorsi di notifica individuale e collettiva non espongono più nei log i prefissi dei token, i payload delle push, gli errori Firebase completi o gli stack associati all'invio. I diagnostici passano attraverso codici sintatticamente delimitati (o `FCM_UNCLASSIFIED`). La pulizia delle notifiche Demos collettive mantiene ora `invalidTokens` dentro il ciclo del singolo destinatario: nessun token accumulato per un utente precedente può essere passato all'invalidatore di un successivo account. Le eccezioni generiche durante l'invio individuale non vengono più equiparate a token scaduti. Gli avvisi operativi verificano nuovamente il token prima dell'invio; i log degli altri sender noti sono minimizzati.

I test sono sintetici; queste modifiche non garantiscono revoca atomica con Firebase e non autorizzano merge, deploy o recovery dell'issue #296.

## Addendum — diagnostica FCM senza invio e senza anteprima segreti

La route GET Admin `/api/comunicazioni/debug-firebase-admin` controlla la presenza e l'inizializzazione locale di Firebase, **senza più chiamare `messaging.send()`**. Aprire la schermata diagnostica non scatena notifiche reali. Il test invio è indicato come non eseguito. Errori e risposte diagnostiche sono minimizzati a messaggi costanti e codici FCM validati.

La GET Admin `/api/comunicazioni/debug-notifiche-demos` mantiene il solo conteggio dei dispositivi idonei, senza restituire i prefissi dei token FCM. La pagina usa il conteggio, quindi non necessita delle anteprime. Nessuna chiamata di invio reale è stata effettuata in questa modifica.

## Addendum — audit degli strumenti di manutenzione manuale FCM (26 ottobre 2026)

I file storici `api/fix_fcm_tokens.sql` e `pulisci-token-fcm-invalidi.sql` avevano query con token e identificativi, e il primo conteneva correzioni mutative dell'array `users.fcm_tokens` non serializzate con il registro canonico. Ora contengono **solo query aggregate racchiuse in una transazione READ ONLY**. Non selezionano identificativi account, indirizzi email né token. Non tentano di scegliere l'ultimo elemento legacy come token più recente.

Tre vecchie diagnostiche root (`verifica-fcm-tokens.cjs`, `verifica-push-notifiche.cjs`, `verifica-utenti-demos-fcm.cjs`) accedevano tramite `DATABASE_URL`, mostravano identità o prefissi/token interi e una poteva perfino creare la colonna legacy. Sono state ritirate con uscita esplicita, **senza importare database/Firebase né aprire connessioni**. Le verifiche funzionali continuano nella CI PostgreSQL 17 con dati sintetici.

`server/notifica.service.js` mantiene un sender Firebase/Firestore storico non conforme alle nuove regole. L'audit statico mostra che i punti d'ingresso dichiarati in `render.yaml` sono sotto `api`, senza import diretto da `api/index.js` o `api/server.js`: **non costituisce prova che nessun processo esterno o deploy legacy lo esegua**. Questo sender NON è stato modificato né attivato e resta da censire negli ambienti/runtime prima di qualunque rilascio. Nessuna prova di accesso a Supabase, dati reali, o provider Firebase.

## Addendum — audit runtime Render/Supabase e quarantena sender storico (26 ottobre 2026)

### Evidenza provider, sola lettura

- Render: 11 servizi DEMOS censiti nel workspace. `demos-backend` live con `rootDir=api`, `startCommand=node index.js`, branch `main`, deploy automatico abilitato. **Deploy live sul commit `77cfd86277e8a7c5c5540d42464fe5af46923d01` del 24 ottobre 2026**, quindi le correzioni su PR #346 sono **solo nel branch Draft**, non sul backend live.
- Staging Render censiti (staging HTTP, security, rollback, B2 e Audit Outbox) con deploy automatico disattivato e comandi di avvio sotto `api`, diversi da `server/notifica.service.js`. `demos-functional-staging` usa `cd api && node index.js`; nessun servizio Render censito dichiara un entrypoint `server/notifica.service.js`.
- Supabase: progetti `Demos` e `Demos-Staging` **senza Edge Functions** e con `pg_cron` / `pg_net` non installate secondo la lista estensioni del provider. Non sono stati eseguiti SQL su dati utente o query di log.
- La verifica dei metadati non prova l'assenza di servizi su altri provider, deploy manuali o processi con credenziali proprie. L'assenza di Edge Functions non esclude trigger SQL o client esterni.

### Blocco esplicito del sender storico

`server/notifica.service.js`, importato solo dal vecchio `server/comunicazione.service.js` nell'indice di codice esaminato, conteneva due metodi FCM che leggevano `utenti.fcmToken` Firestore e inviavano anche a topic sostenitori senza ricontrollare consenso o revoca correnti. I due metodi ora **restituiscono sempre** `{success:false,error:'LEGACY_FIREBASE_PUSH_DISABLED'}` senza contattare Firebase. Rimossi dal modulo anche la creazione inutilizzata di un pool PostgreSQL e i chiamanti Firebase per l'invio push; gli altri metodi storici non-FCM restano invariati. Test statico/dinamico verifica il fail-closed persino in caso di import accidentale, con un ambiente VM che non dispone di accesso alla rete o al database.

Questa quarantena entra in vigore **solo dopo un futuro merge/rilascio autorizzato**. Non è stato modificato alcun servizio remoto o ambiente runtime. Restano invariati i limiti di atomicità del provider, l'audit di possibili sistemi esterni e tutti i prerequisiti dell'issue #296.

## Addendum — pre-send: stato account e preferenze (26 ottobre 2026)

Il controllo prima dell'invio FCM verifica ora anche lo stato dell'account (esclusi `banned`, `deleted`, `disabled`, `2`, `9`) e, per gli invii che dipendono da una preferenza, il valore corrente di quella preferenza. `animali` consente l'invio salvo rifiuto esplicito (`FALSE`); `demos` richiede conferma esplicita (`TRUE`). I nomi delle preferenze sono whitelist immutabile; un'opzione sconosciuta è rifiutata senza eseguire SQL. Gli avvistamenti filtrano gli account bloccati anche alla selezione iniziale. I test PostgreSQL 17 sintetici simulano blocco account e revoca di entrambe le preferenze dopo la selezione del token. L'I/O Firebase remoto rimane non transazionale: nessuna promessa di revoca atomica durante una chiamata già in corso.

## Addendum — stabilità Node test runner per suite privacy (26 ottobre 2026)

Due run indipendenti dello step unitario privacy sul runner Node 22 hanno fallito in diversi test `*.smoke.test.js` con `ERR_TEST_FAILURE`, `FileTest.#processRawBuffer`, `Unable to deserialize cloned data due to invalid or unsupported version`. Gli stessi test sono passati nei rerun. La causa più probabile è il bug upstream [nodejs/node#64061](https://github.com/nodejs/node/issues/64061), noto per la gestione del testo Unicode/emoji emesso sullo stdout dei processi test figlio. Il relativo fix [nodejs/node#64706](https://github.com/nodejs/node/pull/64706) risulta disponibile nella release v24, mentre il backport v22 era ancora oggetto della [issue #65934](https://github.com/nodejs/node/issues/65934).

Il solo workflow `.github/workflows/political-consent-save-revoke-ci.yml` passa a `actions/setup-node` con Node.js 24. **Non sono modificati** `api/package.json`, le versioni dichiarate del progetto, `render.yaml`, servizi Render, server live o i meccanismi di isolamento dei test. Il cambiamento serve a evitare il difetto di framing del runner, **non** ad aggirare test privacy o rimuovere la suite. L'esito della CI sul nuovo commit deve essere controllato separatamente prima di considerare verificata la soluzione.
