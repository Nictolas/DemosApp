# DEMOS — verifica economica definitiva del percorso Firebase App Check

Data: 2026-11-03. Ambito: percorso alternativo a Play Integrity diretta.
Stato: **DOCUMENTATO COME POSSIBILITÀ GRATUITA, NON ATTIVATO**.

## Evidenze ufficiali di costo zero

- Firebase definisce **App Check** un prodotto *no-cost* su entrambi i piani. Il piano **Spark** non richiede dati di pagamento per usare i soli prodotti gratuiti.
  Fonte: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
  Prezzi: https://firebase.google.com/pricing
- Firebase App Check supporta il provider integrato **Google Play Integrity** per le app Android, e il backend personalizzato/self-hosted può verificare i token usando **Firebase Admin SDK**, senza richiedere Cloud Functions o App Engine.
  Guide: https://firebase.google.com/docs/app-check/android/play-integrity-provider
  e https://firebase.google.com/docs/app-check/custom-resource-backend
- Anche su Spark restano le quote del provider: **10.000 chiamate giornaliere** nel livello standard iniziale, soggette alle condizioni del servizio; oltre il limite NON assumere automaticamente che basti aumentare la quota senza condizioni.
  Fonte: https://firebase.google.com/docs/app-check

## Evidenze DEMOS dal repository

- Esiste già il progetto Firebase delle notifiche, referenziato come `demos-finale` in `client/scripts/build-android-native-push.mjs`; l'app Android è `community.demos`.
- Frontend: dipendenza `firebase` e hook FCM esistente.
- Backend: dipendenza `firebase-admin` e inizializzazione da variabili Render con permessi già dedicati a FCM.
- Questo NON prova che il piano economico attuale del progetto sia Spark, né che App Check sia già configurato.
- Non creare nuovi progetti Firebase o Cloud; utilizzare soltanto quello già esistente, previa verifica del piano.

## Attenzione: collegamento necessario e rischio da verificare

La procedura Firebase App Check con Play Integrity richiede esplicitamente di **collegare in Google Play Console il progetto Cloud corrispondente al progetto Firebase**, poi registrare l'app Android e la fingerprint SHA-256 nella console Firebase. La documentazione Cloud generale dice che i normali servizi Cloud richiedono un account di fatturazione anche in Free Tier; la documentazione Firebase stabilisce invece che App Check è gratis in Spark senza metodo di pagamento.

**Prima di premere 'Collega progetto Cloud'** verificare nella console Firebase che il progetto esistente sia sul piano Spark e che il collegamento/abilitazione Play Integrity NON richieda fatturazione, upgrade a Blaze o aggiunta di metodo di pagamento. Se appare una richiesta di billing o upgrade: **ANNULLARE**. Questo controllo live NON è stato svolto.

## Proposta architetturale condizionata

1. Usare Firebase App Check + provider Play Integrity, **non** il decoder diretto già preparato nella PR #572.
2. Quando la verifica economica è superata, predisporre SDK Android `firebase-appcheck-playintegrity` nello stesso progetto FCM esistente; installare la factory prima delle chiamate Firebase.
3. Per gli endpoint scelti, inviare il token App Check al backend Render e verificarlo con `firebase-admin/app-check` sul progetto esistente. In fase iniziale solo **monitoraggio**, senza blocchi.
4. **Non** attivare App Check sulle richieste web né reCAPTCHA Enterprise, né enforcement Firebase per tutti i client esistenti: potrebbero creare problemi di accessibilità e costi/quote diversi.
5. Non abilitare replay protection a consumo di API senza verificare il suo comportamento e le quote; mantenere rate limit e controlli di autorizzazione DEMOS.
6. I token App Check attestano la provenienza dall'app; **non forniscono il dettaglio dei verdict** come la API Play Integrity diretta. Non presentare i due prodotti come equivalenti.
7. Riservare un margine alla quota standard (10.000/giorno) e mantenere protezione non bloccante; il target di un milione di utenti registrati NON implica necessariamente un milione di richieste giornaliere, ma un milione di DAU non sarebbe gestibile con attestazione su tutti i dispositivi in questo livello.

## Decisione operativa

- **Percorso Firebase Spark + App Check**: prodotto ufficialmente gratuito, candidato preferito per DEMOS.
- **Verifica del piano reale Firebase e del collegamento Play Console**: GATE OBBLIGATORIO, ancora aperto.
- **Play Integrity diretta**: costo di attivazione e fatturazione non chiariti, NON procedere.
- **PR #572**: mantenere in bozza, componenti diretti disattivati. Prima di riutilizzarla per App Check occorre una revisione architetturale, non basta accendere i flag.
- **Nessun costo, provisioning, deploy o nuovo AAB** autorizzato da questa analisi.
