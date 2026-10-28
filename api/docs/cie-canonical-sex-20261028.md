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


## Riconciliazione successiva: dati storici/inferiti e falsi claim CIE (28/10/2026)

Questa sezione **sostituisce come fotografia attuale** i conteggi delle verifiche storiche sopra, che restano documentati come tappe precedenti. Query aggregata in sola lettura sulla produzione Supabase:

- `users` totale **1.838**: **1.825 PERSON**, 11 ORGANIZATION, 2 INSTITUTION.
- PERSON: `users.sesso` **M=1.007**, **F=419**, **NULL=399**; tra i politici P, **355 NULL**. Organizzazioni e istituzioni hanno tutte sesso NULL (non applicabile).
- **1.426** persone hanno M/F registrato, ma **nessuna delle 1.426** ha `users.verified=true`, e `identity_verifications` contiene **zero righe**. Questi valori non costituiscono quindi evidenza di certificazione CIE. Provengono da precedenti backfill storici, attribuzioni esplicitamente autorizzate dal nome e verifiche manuali di fonti istituzionali: non equipararli a un claim CIE.
- Il lotto `Andrea` include **45 profili** con sesso compilato, anche laddove la provenienza è nominativa/istituzionale: il completamento del campo non dimostra una verifica CIE. Rimangono discrepanze fra alcune DOB dei politici legacy e fonti parlamentari; nessuna DOB è stata rettificata in questo intervento.
- Per la diagnostica: **1.440** profili politici P risultano creati in DB il 9 gennaio 2026. Ciò segnala un gruppo da auditare, **non dimostra** da solo quale processo abbia generato le DOB.

**Correzione in questa PR Draft:** le schede Sondaggi (entrambe le varianti), Opinioni e Sostenitori non usano più «CIE» o «certificato» nei titoli degli aggregati derivati dalla sola colonna `users.sesso`. Mostrano l'avvertenza che M/F può essere storico o inferito. Anche commenti e messaggi diagnostici backend sono allineati. Aggiunto test anti-regressione.

**Gate obbligatorio prima del merge:** mantenere un solo campo valore `sesso`, ma modellare separatamente **provenienza e stato di verifica** (senza duplicare M/F) e usare un'attestazione server-side valida per mostrare la dicitura «CIE verificata». Il solo `users.sesso IN ('M','F')` non prova la certificazione. La futura scrittura con UserInfo CIE validato può prevalere sul valore storico, ma serve una traccia verificabile e una revisione GDPR/DPO. Non attivare `CIE_SEX_COLLECTION_ENABLED` e non pubblicare la PR finché non sono soddisfatti QA Android, test CIE reale e verifiche privacy.

Riferimento operativo: commento di audit alla PR #380 del 28/10/2026; checklist unica GH-260. Nessuna modifica ai dati di produzione, al sistema di autenticazione o alle regole RLS è stata introdotta da questa correzione di etichette.


## Fase B proposta — provenienza minima `sesso_fonte` (solo PR Draft, non applicata al database)

Migratore **da applicare esplicitamente prima di attivare CIE**: `api/migrations/20261028_cie_sex_provenance.sql`.
Introduce un solo metadato `public.users.sesso_fonte VARCHAR(1) NULL`, **non** una seconda colonna M/F e senza alcun backfill:
- `NULL`: provenienza non registrata. Tutti gli M/F già presenti restano `NULL` fino a una prova tracciabile; nessuno è promosso automaticamente a CIE.
- `L`: dato legacy dichiarato (solo con provenienza documentata).
- `N`: attribuzione per nome, esplicitamente indicata come inferita.
- `O`: confronto con fonte istituzionale (non CIE).
- `C`: UserInfo CIE verificata server-side nella transazione di riconoscimento.

Un vincolo DB ammette una fonte non nulla solo per persone con `sesso M/F`. Nessun indice nuovo e nessun documento anagrafico conservato. Le etichette `L/N/O` **non vengono applicate automaticamente retroattivamente**, poiché la provenienza dei record storici non è attestata individualmente.

Il helper `persistVerifiedCieSex` scrive `sesso` e `sesso_fonte='C'` nella stessa UPDATE, dopo la registrazione dell'identità verificata e **solo se** esiste una riga attiva `identity_verifications` con `provider='CIE'`, `status='verified'`, `detached_at IS NULL` per l'utente. L'UPDATE è nella stessa transazione delle registrazioni OAuth/passkey/CIE: se la riga di verifica manca, l'operazione fallisce e causa rollback dell'identità in fase di registrazione. `claims.sesso=NULL` non genera alcuna etichetta CIE.

**Importante:** `sesso_fonte='C'` è un indicatore di origine, ma le future interfacce «CIE verificata» devono controllare anche lo stato verificabile della riga `identity_verifications`, non solo il codice né il campo M/F. Se l'identità è staccata, l'affidabilità/retention va riconciliata con la policy privacy prima di mostrare certificazioni. Il nuovo metadato non deve essere modificabile da browser o pannelli admin.

**Piano di rollout:** (1) revisione DPO, informativa e retention della provenienza; (2) migrazione applicata e verificata su staging rappresentativo, test rollback; (3) test E2E OIDC con OP reale per verifica e rinnovo/riconciliazione; (4) smoke delle statistiche e delle vecchie build Android; (5) migrazione controllata di produzione con flag CIE ancora OFF; (6) merge/deploy solo dopo CI verde e gate autorizzati. Non confondere una PR Draft con codice live.

Le date di nascita divergenti dei profili politici restano una ricognizione separata, non cambiare dati anagrafici senza ID parlamentare verificato e prova univoca.
