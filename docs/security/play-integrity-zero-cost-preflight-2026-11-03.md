# DEMOS — Play Integrity: preparazione a costo zero

Data: 03/11/2026. Stato: SOLO PREPARAZIONE, NON INTEGRATA.

## Vincolo economico

- Non attivare fatturazione o servizi Google Cloud a consumo.
- La quota documentata da Google è 10.000 richieste token/giorno e 10.000 decodifiche/giorno. La quota non costituisce da sola una garanzia di costo zero.
- Non collegare un progetto Cloud, creare nuovi progetti o richiedere aumenti finché l'assenza di costi non sia verificata e approvata.
- Questa PR non richiede API, rete, credenziali, Render env, nuove risorse o modifiche AAB.

## Struttura verificata

- Android: Capacitor 6, package community.demos, minSdk 24, targetSdk 36.
- Client: client/android, registrazione bridge nativo in MainActivity.java.
- Backend: Express/Node.js su Render, libreria google-auth-library già presente.
- SDK Android ufficiale Google Play Integrity: com.google.android.play:integrity:1.6.0 (NON aggiunto ancora).

## Codice preparato

- api/services/playIntegrityPolicy.js: funzioni pure, nessuna chiamata Google.
- api/tests/playIntegrityPolicy.test.js: test offline senza token, senza fatturazione.
- Flag disabilitati per default: PLAY_INTEGRITY_ENABLED, PLAY_INTEGRITY_ZERO_COST_CONFIRMED, PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER.
- Funzioni di serializzazione canonica, requestHash SHA-256, analisi di pacchetto, timestamp, hash e verdict.
- Attenzione: il parser NON autentica token Play Integrity. Accetta soltanto esiti ottenuti direttamente da Google dopo decodifica server-side. Mai accettare un JSON arbitrario dal client.
- Nessuna modifica a route, registrazioni, voti, opinioni, preferenze, web, login, AAB o deploy.

## Test locale

    node --test api/tests/playIntegrityPolicy.test.js

## Prima di un'integrazione effettiva

1. Verificare se Play Integrity può essere utilizzata senza fatturazione o spese, nel progetto Cloud esistente.
2. Mappare le azioni ad alto rischio da attestare, evitando verifiche su ogni schermata.
3. Realizzare bridge Android Capacitor e requestHash identico lato client/server (vettori test).
4. Decoder autenticato su Render con rate limiting e quota; nessun token grezzo nei log.
5. Avviare in modalità osservazione, senza blocchi, mantenendo web pienamente funzionante.
6. Eseguire test locali e CI; non usare demos-staging finché è in bootstrap.
7. Non interferire con l'AAB corrente o la release in corso.

## Fonti

- https://developer.android.com/google/play/integrity/setup
- https://developer.android.com/google/play/integrity/overview
- https://developer.android.com/google/play/integrity/standard
- https://developer.android.com/google/play/integrity/verdicts