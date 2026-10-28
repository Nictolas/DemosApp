# DEMOS — sesso anagrafico canonico da CIE (issue #260)

## Decisione e formato
- Unico campo canonico `users.sesso`: `M`, `F` oppure `NULL`.
- M/F **non** rappresentano l'identità di genere.
- Il campo `users.sesso` esiste già nel DB Supabase produzione (28/10/2026), ma risulta vuoto per tutti i 1.857 account. **Nessun backfill** da `genere` (`u/d/a`) o `user_profile.genere`.
- Il dato M/F è derivato solo da `gender` = `male` / `female` nel UserInfo CIE dopo firma JWS, issuer, audience e sub validati.
- Il claim mancante o non riconosciuto significa `NULL`, **non** "Altro", `0` o `1`.
- La richiesta del claim gender è sotto `CIE_SEX_COLLECTION_ENABLED=true` (default false); CIE OIDC resta disabilitata per default.
- Le route browser di aggiornamento profilo non accettano `sesso` come input certificato.

## Implementato in questa PR (fase A)
- Richiesta e verifica opzionale del claim `gender` dal solo UserInfo CIE attendibile.
- Scrittura `users.sesso` contestuale alla registrazione CIE (OAuth e passkey) o alla verifica CIE, nello stesso commit transazionale.
- Scrittura idempotente: un sesso già valorizzato diversamente blocca l'operazione; nessun overwrite silenzioso.
- API autenticata `/auth/me`, `/users/me` e amministrativa `/users` espongono il nuovo sesso, `NULL` per valori non disponibili.
- Statistiche Admin di `/utenti`: sesso anagrafico CIE M/F/non disponibile; esclude organizzazioni/istituzioni e non legge il legacy `genere`.
- Test mapping, firma, feature gate, transazione/rollback, assenza di origine browser e build.

## Non incluso / gate prima del rollout
- Non c'è alcuna modifica ai dati reali o una copia `genere` → `sesso`.
- Non c'è alcuna attivazione CIE/claim in Render. Per abilitarla sono necessari finalità/base giuridica/informativa documentate, gestione accessi/retention e validazione dell'attributo con OP ufficiale.
- I vecchi endpoint/consumer `genere` (sondaggi, profili, opinioni, versioni Android preesistenti) rimangono temporaneamente compatibili. **Non** considerarli statistiche CIE: una fase successiva deve deprecarli/migrarli con test e soglia small-cell. Non rimuovere subito la colonna legacy fino a compatibilità verificata.
- Valutare `CHECK (sesso IN ('M','F'))` sul DB dopo la ricognizione degli ambienti; lo schema corrente è `varchar` nullable senza popolazione.
- Nella schermata /utenti restano da trattare separatamente i dati fittizi preesistenti sulle età.

## Verifica produzione in sola lettura (28 ottobre 2026)
`SELECT sesso, genere, count(*) FROM users GROUP BY 1, 2;` restituisce:
- sesso NULL / genere NULL: 1.709
- sesso NULL / genere u: 96
- sesso NULL / genere d: 49
- sesso NULL / genere a: 3

Nessuna classificazione M/F automatica viene fatta dai nomi dei 1.592 politici senza genere.
