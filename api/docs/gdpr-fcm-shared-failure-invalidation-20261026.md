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
