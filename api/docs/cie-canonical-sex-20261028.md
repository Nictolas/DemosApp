# DEMOS — sesso anagrafico canonico da CIE (issue #260)

## Decisione e formato
- Unico campo canonico `users.sesso`: `M`, `F` oppure `NULL`.
- M/F **non** rappresentano l'identità di genere.
- Il campo `users.sesso` contiene ora anche **144 valori storici dichiarati** (95 M da `genere=u`, 49 F da `genere=d`), recuperati il 28/10/2026 su esplicita richiesta dell'amministratore; l'eventuale attributo CIE verificato potrà sovrascriverli.
- La fonte può essere storica (`genere=u/d`) oppure CIE. Quando il valore arriva da CIE, viene derivato soltanto da `gender=male/female` nel UserInfo verificato (firma JWS, issuer, audience, sub). Il dato storico **non** deve essere presentato come CIE verificato.
- Il claim mancante o non riconosciuto significa `NULL`, **non** "Altro", `0` o `1`.
- La richiesta del claim gender è sotto `CIE_SEX_COLLECTION_ENABLED=true` (default false); CIE OIDC resta disabilitata per default.
- Le route browser di aggiornamento profilo non accettano `sesso` come input certificato.

## Implementato in questa PR (fase A)
- Richiesta e verifica opzionale del claim `gender` dal solo UserInfo CIE attendibile.
- Scrittura `users.sesso` contestuale alla registrazione CIE (OAuth e passkey) o alla verifica CIE, nello stesso commit transazionale.
- Scrittura **soltanto per `account_type='PERSON'`**: una successiva verifica CIE valida prevale anche se il valore storico era diverso. Account inesistenti, istituzioni e organizzazioni restano esclusi. La scrittura CIE avviene server-side e nella transazione di verifica.
- API autenticata `/auth/me`, `/users/me` e amministrativa `/users` espongono il nuovo sesso, `NULL` per valori non disponibili.
- Statistiche Admin di `/utenti`: M/F/non disponibile dai valori presenti in `users.sesso`; non distingue implicitamente CIE da dato storico, esclude organizzazioni/istituzioni e non legge direttamente `genere`.
- Sondaggi: nuove route `/api/sondaggi/sesso` con filtri territorio; i grafici leggono M/F dal campo canonico. Le quattro route legacy `/genere` rispondono con lista vuota e header di deprecazione, senza presentare un vecchio genere come sesso.
- Opinioni: nuove route `/api/opinioni/stats/:opinionId/sesso` (nazionale/regione), con consenso politico, filtro PERSON e soppressione completa di celle inferiori a 10; le vecchie route `/genere` non restituiscono più dati.
- Modifica profili: rimossi i campi legacy `genere` dai moduli attivi e dagli elenchi API di scrittura; le API di lettura storiche rimangono per compatibilità temporanea. Non esporre il dato CIE sui profili pubblici.
- Export dati GDPR: `sesso` incluso sia nel servizio canonico sia nell'endpoint di portabilità legacy, senza cancellare `genere` dagli export storici.
- Sostenitori: sette endpoint (rappresentanti, candidati, attivisti, organizzazioni, totale e due route /sostenitori) non restituiscono più `genere` individuale né deducono "Altro" dal NULL. Il nuovo `sexDistribution` include M/F per sole PERSON, deduplica i sostenitori per ID e nasconde tutti i dati se un gruppo ha meno di 10 persone; `genderDistribution` è una mappa vuota per i vecchi client.
- Directory Attivisti/Organizzazioni e l'endpoint candidati duplicato: smettono di pubblicare il campo legacy `genere`.
- Registrazione: il passaggio informativo `/registrazione-genere` è stato ritirato dal percorso normale; nome e consensi vanno direttamente a cittadinanza, la vecchia URL reindirizza e la navigazione indietro resta compatibile con passkey. Il componente non più usato è stato eliminato; il form `registrazione-2-dati` risulta separato/non montato nel router attuale, lasciato intatto in attesa di inventario più ampio.
- Notifiche voti politici: lettura `users.sesso` al posto di `genere`; i titoli di Camera, Senato e consigli comunali sono femminili/maschili solo con M/F canonici. Senza dato anagrafico usano formule neutrali («In Senato,», «Alla Camera,», «Nel consiglio comunale,»), mai un maschile attribuito arbitrariamente.
- Test mapping, firma JWS, cifratura JWE, manomissione di `gender`, feature gate, transazione/rollback, limitazione agli account PERSON, privacy small-cell e sette endpoint Sostenitori, titoli notifiche senza inferenze, navigazione senza genere, assenza di origine browser, export GDPR e build.

## Non incluso / gate prima del rollout
- Su richiesta dell'amministratore sono già stati copiati **solo** 144 valori dei campi storici `u/d` su account `PERSON` con `sesso IS NULL`. Gli altri account sono invariati. Non è stata modificata la struttura del database.
- Non c'è alcuna attivazione CIE/claim in Render. Per abilitarla sono necessari finalità/base giuridica/informativa documentate, gestione accessi/retention e validazione dell'attributo con OP ufficiale.
- I vecchi endpoint `genere` di Sondaggi/Opinioni rimangono raggiungibili ma restituiscono un array vuoto: ciò evita di pubblicare dati non verificati, pur mantenendo in vita l'URL per i client Android vecchi. I grafici dei vecchi client potrebbero apparire vuoti finché non viene distribuita una nuova build.
- I sette endpoint Sostenitori sono ora migrati, ma occorre ancora QA delle visualizzazioni Android già distribuite. La sezione Sostenitori mostrerà esplicitamente «dato mancante» o «dato nascosto» invece di inventare il genere di una persona.
- Consumatori legacy ancora da verificare/ritirare: dettagli specifici Opinioni, form e asset di registrazione obsoleti, tabelle storiche `user_profile.genere`, altri endpoint di lettura e compatibilità di versioni Android precedenti. Non rimuovere subito la colonna legacy prima della verifica completa delle dipendenze.
- Valutare `CHECK (sesso IN ('M','F'))` sul DB dopo la ricognizione degli ambienti; lo schema corrente è `varchar` nullable già popolato parzialmente.
- Il problema dei dati fittizi sulle età è stato corretto e pubblicato separatamente tramite PR #383 (non dipende dal rollout CIE).

## Verifica produzione in sola lettura (28 ottobre 2026)
`SELECT sesso, genere, count(*) FROM users GROUP BY 1, 2;` restituisce:
- **Dopo il backfill**: persone `sesso=M`: 95; `sesso=F`: 49; `sesso=NULL`: 1.700. Solo per `PERSON`, `genere=a` rimane invariato (3 profili). Un record `INSTITUTION` con `genere=u` non è stato toccato.

Nessuna classificazione M/F automatica viene fatta dai nomi dei 1.592 politici senza genere.

## Ripulitura dati statistici non certificati (28/10/2026)
- In `/utenti` rimosso il **fallback sintetico** delle età (`15,25,20,18,12,8`), che sostituiva intere distribuzioni quando quasi tutte le date mancavano.
- Considerare solo account `PERSON` e date `YYYY-MM-DD` realmente registrate; invalidità del calendario, nascita futura ed età oltre 125 anni producono `N/A`.
- Le date presenti **non equivalgono a CIE verificata**. I profili dei politici importati contano nel totale e sono dichiarati in schermata.
- Lettura aggregata di Supabase produzione: 1.844 PERSON, 1.614 date di nascita valorizzate, 230 mancanti e 5 implausibili (>125 anni). Nessun record modificato.
- Test anti-regressione `api/tests/userAgeStatistics.smoke.test.js` incluso nella CI. Questa attività non modifica le regole di conservazione dei dati.

## Fonte tecnica CIE
La specifica ufficiale SPID/CIE OIDC definisce `gender` come attributo anagrafico con valori `male` e `female`: https://docs.italia.it/italia/spid/spid-cie-oidc-docs/it/versione-corrente/attributi_utente.html
