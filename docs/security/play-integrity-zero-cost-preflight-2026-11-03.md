# DEMOS — Play Integrity: integrazione predisposta, disattivata

Data: 03/11/2026. Stato: **PR #572 DRAFT**. Nessuna attivazione Google Cloud né API richiesta da DEMOS in produzione.

## Regola economica

- Attivare soltanto dopo verifica documentata di **costo obbligatorio €0** e approvazione esplicita dell'utente.
- Non collegare progetto Google Cloud, abilitare billing, creare servizi o chiedere aumenti quota nel frattempo.
- Google dichiara quota iniziale di 10.000 richieste/giorno per token/prepare e 10.000 decodifiche; la quota non dimostra assenza assoluta di costi.
- Evitare campi opzionali o prodotti associati con costi potenziali (ad es. device recall su larga scala).

## Componenti preparati sulla PR

- `client/android/app/build.gradle`: dipendenza ufficiale `com.google.android.play:integrity:1.6.0` e **BuildConfig.PLAY_INTEGRITY_ENABLED=false**, **PLAY_INTEGRITY_PROJECT_NUMBER=0L**.
- `client/android/app/src/main/java/community/demos/NativePlayIntegrityPlugin.java`: plugin Capacitor per preparazione token e richieste standard. Tutte le chiamate che toccherebbero Google sono bloccate dal BuildConfig.
- `client/android/app/src/main/java/community/demos/MainActivity.java`: plugin registrato, senza invocazione automatica.
- `client/src/lib/nativePlayIntegrity.ts`: helper facoltativo e non importato dalle pagine; richiede anche `VITE_PLAY_INTEGRITY_ENABLED=true`, assente nelle build correnti.
- `client/src/lib/playIntegrityHash.ts`: SHA-256 WebCrypto canonico, base64url, coerente con il server Node.
- `api/services/playIntegrityPolicy.js`: verifica dell'hash, del package, della freschezza e classificazione dei verdict **già decodificati da Google**.
- `api/services/playIntegrityDecode.js`: facade per chiamata al servizio Google con timeout di 5 secondi, nessun retry, errori sanitizzati. Non montata in alcuna route e disabilitata senza tre variabili di consenso.
- `api/tests/playIntegrityPolicy.test.js`, `api/tests/playIntegrityDecode.test.js`, `api/tests/playIntegrityWebHash.test.mjs`: test offline e di parità dei digest.
- `.github/workflows/play-integrity-preflight.yml`: test Node offline. Anche la workflow Android Alpha esistente può compilare la modifica Gradle su PR.

## Vincoli di sicurezza e privacy

- **Nessuna** modifica a login, opinioni, voti, firme, API pubbliche, trattamento dati o release Android installata.
- Nessuna risposta di integrità è accettata come attestazione se arriva in JSON dal client: Google deve decodificare il token lato server.
- Nessun token, contenuto delle opinioni, credenziale o dato personale deve finire nei log. Risposte del facade limitate a classificazioni e motivazioni generiche.
- Il fallimento di Play Integrity non deve disattivare autenticazione, autorizzazione o rate limiting DEMOS; resta un controllo aggiuntivo.
- Non usare `demos-staging`: staging condiviso ancora in bootstrap secondo OPS-STG-001; non crearne altri.
- Qualsiasi API Google deve restare disattivata e non deve consumare quote finché il controllo di costo e l'autorizzazione non sono conclusi.

## Da completare (non dichiarare completa l'integrazione)

1. Confermare costo €0 e condizioni Cloud **prima** del collegamento in Play Console.
2. Mappare e approvare gli endpoint ad alto rischio; niente richieste su ogni schermata o apertura.
3. Collegare in modo sicuro il bridge alle azioni selezionate e il decoder ad una route autenticata e limitata.
4. Provisioning di autenticazione Google con minimi permessi, solo se costo €0 dimostrato.
5. Test Android e backend end-to-end con token reali, dispositivi vari e controlli di falsi positivi.
6. Rollout solo monitoraggio e rollback; mantenere piena compatibilità web.

## Comandi CI offline

    node --experimental-strip-types --test api/tests/playIntegrityPolicy.test.js api/tests/playIntegrityDecode.test.js api/tests/playIntegrityWebHash.test.mjs

## Fonti ufficiali

- https://developer.android.com/google/play/integrity/setup
- https://developer.android.com/google/play/integrity/standard
- https://developer.android.com/google/play/integrity/verdicts
- https://developer.android.com/google/play/integrity/overview