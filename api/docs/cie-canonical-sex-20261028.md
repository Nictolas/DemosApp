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
- Sondaggi: nuove route `/api/sondaggi/sesso` con filtri territorio; i grafici leggono M/F dal campo canonico. Le quattro route legacy `/genere` rispondono con lista vuota e header di deprecazione, senza presentare un vecchio genere come sesso.
- Opinioni: nuove route `/api/opinioni/stats/:opinionId/sesso` (nazionale/regione), con consenso politico, filtro PERSON e soppressione completa di celle inferiori a 10; le vecchie route `/genere` non restituiscono più dati.
- Modifica profili: rimossi i campi legacy `genere` dai moduli attivi e dagli elenchi API di scrittura; le API di lettura storiche rimangono per compatibilità temporanea. Non esporre il dato CIE sui profili pubblici.
- Export dati GDPR: `sesso` incluso sia nel servizio canonico sia nell'endpoint di portabilità legacy, senza cancellare `genere` dagli export storici.
- Sostenitori: sette endpoint (rappresentanti, candidati, attivisti, organizzazioni, totale e due route /sostenitori) non restituiscono più `genere` individuale né deducono "Altro" dal NULL. Il nuovo `sexDistribution` include M/F per sole PERSON, deduplica i sostenitori per ID e nasconde tutti i dati se un gruppo ha meno di 10 persone; `genderDistribution` è una mappa vuota per i vecchi client.
- Directory Attivisti/Organizzazioni e l'endpoint candidati duplicato: smettono di pubblicare il campo legacy `genere`.
- Registrazione: il passaggio informativo `/registrazione-genere` è stato ritirato dal percorso normale; nome e consensi vanno direttamente a cittadinanza, la vecchia URL reindirizza e la navigazione indietro resta compatibile con passkey. Il componente non più usato è stato eliminato; il form `registrazione-2-dati` risulta separato/non montato nel router attuale, lasciato intatto in attesa di inventario più ampio.
- Test mapping, firma, feature gate, transazione/rollback, privacy small-cell e sette endpoint Sostenitori, navigazione senza genere, assenza di origine browser, export GDPR e build.

## Non incluso / gate prima del rollout
- Non c'è alcuna modifica ai dati reali o una copia `genere` → `sesso`.
- Non c'è alcuna attivazione CIE/claim in Render. Per abilitarla sono necessari finalità/base giuridica/informativa documentate, gestione accessi/retention e validazione dell'attributo con OP ufficiale.
- I vecchi endpoint `genere` di Sondaggi/Opinioni rimangono raggiungibili ma restituiscono un array vuoto: ciò evita di pubblicare dati non verificati, pur mantenendo in vita l'URL per i client Android vecchi. I grafici dei vecchi client potrebbero apparire vuoti finché non viene distribuita una nuova build.
- I sette endpoint Sostenitori sono ora migrati, ma occorre ancora QA delle visualizzazioni Android già distribuite. La sezione Sostenitori mostrerà esplicitamente «dato mancante» o «dato nascosto» invece di inventare il genere di una persona.
- Consumatori legacy ancora da verificare/ritirare: pagine Sostenitori, dettagli specifici Opinioni, form e asset di registrazione obsoleti, tabelle storiche `user_profile.genere`, altri endpoint di lettura e compatibilità di versioni Android precedenti. Non rimuovere subito la colonna legacy prima della verifica completa delle dipendenze.
- Valutare `CHECK (sesso IN ('M','F'))` sul DB dopo la ricognizione degli ambienti; lo schema corrente è `varchar` nullable senza popolazione.
- Nella schermata /utenti restano da trattare separatamente i dati fittizi preesistenti sulle età.

## Verifica produzione in sola lettura (28 ottobre 2026)
`SELECT sesso, genere, count(*) FROM users GROUP BY 1, 2;` restituisce:
- sesso NULL / genere NULL: 1.709
- sesso NULL / genere u: 96
- sesso NULL / genere d: 49
- sesso NULL / genere a: 3

Nessuna classificazione M/F automatica viene fatta dai nomi dei 1.592 politici senza genere.

## Ripulitura dati statistici non certificati (28/10/2026)
- In `/utenti` rimosso il **fallback sintetico** delle età (`15,25,20,18,12,8`), che sostituiva intere distribuzioni quando quasi tutte le date mancavano.
- Considerare solo account `PERSON` e date `YYYY-MM-DD` realmente registrate; invalidità del calendario, nascita futura ed età oltre 125 anni producono `N/A`.
- Le date presenti **non equivalgono a CIE verificata**. I profili dei politici importati contano nel totale e sono dichiarati in schermata.
- Lettura aggregata di Supabase produzione: 1.844 PERSON, 1.614 date di nascita valorizzate, 230 mancanti e 5 implausibili (>125 anni). Nessun record modificato.
- Test anti-regressione `api/tests/userAgeStatistics.smoke.test.js` incluso nella CI. Questa attività non modifica le regole di conservazione dei dati.

## Fonte tecnica CIE
La specifica ufficiale SPID/CIE OIDC definisce `gender` come attributo anagrafico con valori `male` e `female`: https://docs.italia.it/italia/spid/spid-cie-oidc-docs/it/versione-corrente/attributi_utente.html
