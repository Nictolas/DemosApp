# DEMOS — Controllo FCM: fast path indicizzabile e fallback normalizzato fail-closed

**26 ottobre 2026 — proposta PR DRAFT basata sulla PR #342; nessuna migrazione, deploy o accesso a produzione.**

## Problema verificato nel codice

Le PR #341 e #342 confermano la precedenza di `public.user_devices` sulla copia legacy `public.users.fcm_tokens`. Un token canonico disattivato, o registrato a un altro utente, **non deve poter essere ripescato** dall'array legacy.

Per riconoscere anche token con spazi ai margini (input legacy), il controllo in `currentSupporterPushService.js` utilizzava:

```sql
NOT EXISTS (
  SELECT 1 FROM public.user_devices registered
  WHERE btrim(registered.fcm_token) = btrim(legacy.token)
)
```

Il controllo prima di Firebase utilizzava lo stesso predicato contro `$2`. La migrazione `api/database/create-user-devices-table.sql` ha già un vincolo `UNIQUE(fcm_token)`, indicizzato con btree: **un confronto esclusivamente su `btrim(fcm_token)` non è direttamente compatibile con l'indice della colonna**. Inoltre l'attuale endpoint `api/routes/fcm-tokens.js` valida l'input usando `.trim()` ma salva il token ricevuto senza normalizzarlo, quindi non è lecito eliminare il confronto normalizzato senza prima verificare e bonificare eventuali righe storiche.

## Mitigazione SQL isolata, senza DDL

Solo la parte di *precedenza del registro canonico sul legacy* usa ora un'espressione `CASE` in due fasi:

```sql
CASE
  WHEN EXISTS (
    SELECT 1 FROM public.user_devices registered
    WHERE registered.fcm_token = btrim(legacy.token)
  ) THEN FALSE
  ELSE NOT EXISTS (
    SELECT 1 FROM public.user_devices registered
    WHERE btrim(registered.fcm_token) = btrim(legacy.token)
  )
END
```

Nel controllo immediatamente pre-invio il predicato usa `registered.fcm_token = $2` e `btrim(registered.fcm_token) = $2`. La condizione `CASE` preserva il comportamento *fail-closed*:
- **Corrispondenza esatta** con un record canonico, **anche inattivo o di un altro account**: la copia legacy è negata direttamente, senza dover eseguire il ramo di normalizzazione.
- **Nessuna corrispondenza esatta**: il ramo normalizzato rimane obbligatorio. Se esiste `' padded-token '` in `user_devices` e `'padded-token'` in legacy, il legacy è comunque negato.
- Nessuna riga canonica: un token solo legacy rimane compatibile, purché account attivo e consenso presenti.

La ricerca di un token *attivo* nel registro canonico continua a richiedere `d.user_id=u.id`, `d.is_active=TRUE` e token equivalente tramite `btrim`. Nessun vincolo di consenso è rimosso; nessuna modifica alle API o alla gestione di Firebase. La logica è una sola query SQL e usa lo snapshot della singola istruzione.

## Regressione PostgreSQL 17, soltanto synthetic

`api/scripts/verify-supporter-notification-consent-ci.js`, già protetto da guardrail GitHub Actions/host localhost/database CI/rollback, viene esteso per:
- Creare nella transazione con `ROLLBACK` un `UNIQUE INDEX idx_user_devices_token_exact_ci(fcm_token)` che riproduce l'access path del vincolo versionato. Non viene creato alcun indice persistente.
- Verificare l'esistenza **nel SQL applicativo** sia del predicato esatto indicizzabile, sia del ramo `btrim` normalizzato con `CASE`.
- Verificare separatamente con `EXPLAIN (FORMAT JSON)`, `enable_seqscan=off` ristretto a un savepoint, che il predicato di uguaglianza **isolato** su `fcm_token` possa utilizzare il btree `idx_user_devices_token_exact_ci` con `Index Cond`. Il piano della query complessiva rimane responsabilità del planner e non viene dichiarato sempre indicizzato.
- Ripetere le prove di token disattivato, token trasferito, token solo legacy, query con `search_path=pg_temp,public` e consenso revocato.
- Aggiungere espressamente un registro inattivo canonico con `' padded-inactive '` e una copia legacy `'padded-inactive'`: **deve prevalere il record canonico anche quando solo il ramo normalizzato lo riconosce**.
- Nuovo marcatore di test: `SUPPORTER_FCM_EXACT_INDEX_PLAN_PG17_PASS`, senza perdere `SUPPORTER_DEVICE_OVERRIDES_LEGACY_PG17_PASS`.

## Costi, caveat e dipendenze

Questa modifica **non elimina il ramo che può eseguire una scansione normalizzata**. Il vantaggio possibile riguarda soprattutto i token con riga canonica esatta, nel qual caso il `CASE` può terminare senza il fallback. Per token realmente non registrati — tipicamente legacy-only — la scansione normalizzata rimane. Non sono stati eseguiti benchmark quantitativi su staging né stimati risparmi reali.

Una ottimizzazione completa richiederebbe prima una scelta autorizzata su normalizzazione dei token al momento della registrazione, audit delle righe storiche e, se necessario, un indice per l'espressione `btrim(fcm_token)` o una migrazione. **Nessun DDL di produzione è incluso in questa PR.**

Resta la finestra tra la verifica SQL e l'accettazione remota da Firebase. La issue #296 richiede ancora: journal indipendente con prova di completezza/freschezza/durabilità fino al freeze, quarantena effettiva Render/Supabase/Data API e worker, prove B2 Object Lock COMPLIANCE/VersionId/retention su staging provider e decisioni DPIA/titolare/DPO/retention/costi.

**Nessun merge, deploy, migrazione, accesso a dati reali, modifica alla produzione, segreto o servizio attivato.**
