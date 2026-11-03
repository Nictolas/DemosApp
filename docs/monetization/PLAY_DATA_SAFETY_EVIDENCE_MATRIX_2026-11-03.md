# DEMOS — matrice di evidenze Play Data Safety, fase Ads-free

**Data:** 03/11/2026 · **Stato:** precompilazione tecnica; NON dichiarazione Play confermata · **Ramo:** PR #558, senza merge in main.

## Scopo e limiti

La prima release pubblica deve essere **senza Ads**. La verifica binaria effettuata su APK/AAB `UNSIGNED` della CI rileva assenza di `AD_ID`, AdMob App ID e namespace SDK Ads/UMP; **non** prova che l'app non raccolga dati. La Data Safety di Google Play riguarda tutte le trasmissioni di dati fuori dal dispositivo, anche effettuate da librerie e servizi di terzi, non soltanto la pubblicità. Google Play richiede inoltre la verifica di quanto sia effettivamente distribuito sullo Store e dei flussi di dati reali. Il termine "condivisione" ha eccezioni specifiche (es. trattamento per conto del titolare), da valutare con i contratti: un SDK Google/Firebase non va classificato automaticamente come condivisione oppure non condivisione.

**Non usare questa matrice per inviare la dichiarazione senza revisione DPO e verifica Play Console.** Le righe qui sotto contengono una *categoria preliminare da controllare* e una fonte del repository, non un'autocertificazione dell'uso/retention effettivi in produzione. Nessun valore reale di utente è stato letto.

## Matrice per la prima release senza annunci

| Flusso / dato | Evidenza diretta nel codice | Categoria Play da valutare | Scopo tecnico riscontrato | Stato dell'audit |
|---|---|---|---|---|
| Email, ID account, autenticazione | `api/routes/auth/profile.js` recupera ID/email e decifra email; `client/src/hooks/use-auth.tsx` usa JWT | Informazioni personali: email / ID utente; sicurezza | Accesso, gestione account e sessioni | **Confermato nel codice**; verificare ogni provider OAuth e conservazione |
| Google Sign-In e credenziale | `client/android/app/src/main/java/community/demos/NativeGoogleAuthPlugin.java` ottiene Google ID token, inoltrato al backend per verifica | Informazioni personali/ID utente; dati di autenticazione, se pertinenti alle definizioni Play | Login nativo | **Confermato nel codice**; verificare flussi Google, privacy provider e se registrato fuori dispositivo |
| Profilo anagrafico e territoriale | `api/routes/auth/profile.js` consulta `data_nascita`, `cittadinanza`, `paese/regione/provincia/comune_residenza`; `client/src/pages/PrivacyPolicy.tsx` descrive anno di nascita/sesso | Informazioni personali, eventuale localizzazione *dichiarata*; distinguere residenza da geolocalizzazione precisa | Profilo e statistiche territoriali | **Confermato** per alcuni campi; verificare sesso e struttura effettiva della data di nascita; NO inferenza di geolocalizzazione GPS |
| Opinioni politiche e consenso GDPR Art. 9 | `api/routes/user/political-opinions-consent.js` e `client/src/pages/PrivacyPolicy.tsx` | Eventuale "Other user-generated content"/"Other info"; **sensibilità speciale** da validare col DPO, senza assegnare arbitrariamente una checkbox Play | Sondaggi e partecipazione | **Trattamento descritto e verificato**; inventariare payload, local-first, backup, cancellazioni e aggregazione reale |
| Consenso ai dati politici, timestamp, IP, user agent | `api/routes/user/political-opinions-consent.js`: POST registra IP/user-agent nella prova del consenso; GET li riporta al client | Eventuali info su dispositivo / diagnostica e dati personali; Play può categorizzare l'IP a seconda dell'uso effettivo | Prova del consenso, audit e sicurezza | **Confermato nel codice**; verificare retention, accessi e necessità di esporre IP/user-agent nel GET |
| Consensi registrazione | `api/routes/user/registration-consents.js` gestisce consensi privacy/termini e timestamp | Dati personali/attività dell'account, secondo modalità reale | Conformità e gestione account | **Confermato nel codice**; verificare informativa e archiviazione |
| Token per notifiche push | `api/routes/fcm-tokens.js` associa `user_id`, `fcm_token` e `last_seen_at` in `user_devices`; `client/src/lib/native-push.ts` gestisce il token locale | **ID dispositivo o altri ID** da valutare; notifiche | Notifiche push, registrazione e revoca dispositivo | **Confermato nel codice**; verificare Firebase/Google, configurazione attiva per variante e modalità opt-in |
| Preferenze notifiche e analisi | `api/routes/user/privacy-settings.js` legge/salva `email_notifications`, `push_notifications`, `data_analytics` | Attività dell'app / preferenze o categoria adeguata | Preferenze funzionali | **Confermato nel codice**; flag `data_analytics` non prova da solo che un SDK analytics raccolga dati: verificare runtime |
| Errori, log di sicurezza e telemetria | `api/services/centralizedLogger.js` contiene log per eventi audit/security con ID account, IP e sessione *se esplicitamente previsti*; scrittura Axiom condizionata da env | Informazioni personali/ID e diagnostica dell'app (in base ai payload effettivi) | Sicurezza, diagnostica, retention | **Codice condizionale confermato**; verificare variabili live, minimizzazione, retention, fornitori e tipologia eventi |
| Token sessione e dati cifrati sul dispositivo | `client/src/hooks/use-auth.tsx` gestisce token e pulizia cache, profili cifrati; `client/src/pages/PrivacyPolicy.tsx` descrive cache locale | **Distinguere solo locale** da trasferimenti verso API e terzi | Sessione e disponibilità offline | **Confermato nel codice**; verificare logout, revoca da altro dispositivo, copie di backup, reimport |
| Firebase e dipendenze native | `api/services/firebaseAdmin.js` abilita messaggistica se credenziali configurate; `client/android/app/build.gradle` include Google Credential Manager/Google ID | Dipende dalla documentazione del provider e dal runtime distribuito | Login e notifiche | **Provider verificati nel codice**; controllare dichiarazioni SDK e configurazione degli AAB Play |
| Google Mobile Ads e UMP | `client/android/app/build.gradle` nella PR #558 usa solo `debugImplementation`; build release: SDK assenti, AAB CI testato | Per la prima release **non attribuire automaticamente SDK Ads**; nella futura release Ads rivedere IP, ad ID, diagnostica, interazioni | Prototipo di monetizzazione *solo debug* | **Ads-free confermato sul CI AAB unsigned**, non sull'AAB firmato Play |

## Decisioni da prendere prima di compilare la Data Safety in Play Console

1. **Pacchetto distribuito:** recuperare da Play Console la release effettivamente disponibile (Alpha `1.0.11 (14)` o altra), l'elenco SDK e il suo manifest *firmato*. L'AAB CI `1.0.12 (15)` non equivale all'AAB installato dai tester.
2. **Categorie e finalità:** per ogni riga stabilire «raccolti», «condivisi», finalità, indispensabilità/opzionalità, elaborazione transitoria, sicurezza del trasporto, conservazione e cancellazione. Una riga può mappare a più categorie.
3. **Verifica dati politici:** controllare, con DPO, come la classificazione Play e la documentazione GDPR Art. 9 rappresentano le opinioni e i voti senza sottodichiararli.
4. **Provider terzi:** consultare le schede Data Safety vigenti delle versioni SDK realmente incluse (Google Identity/Credential Manager, Firebase se presente, altri plugin Capacitor), e i contratti di titolare/responsabile per Render, Supabase, Axiom se attivo.
5. **IP e agent:** verificare l'effettiva registrazione e retention delle prove di consenso, dei log security e la minimizzazione dell'endpoint GET del consenso; non dichiarare «nessun dato dispositivo» senza prova.
6. **Anno di nascita:** il contratto applicativo desiderato è solo l'anno; `api/routes/auth/profile.js` riformatta `data_nascita` in `DD/MM/YYYY`. Determinare se il backend conserva una data fittizia (da anno) o una data completa: evitare affermazioni non dimostrate.
7. **Push e analisi:** verificare quali permessi e SDK siano attivi negli AAB firmati e se `data_analytics` abbia veri consumatori runtime prima di dichiarare dati analytics.
8. **Pubblicazione:** verificare direttamente la sezione Data Safety/Ads e lo stato della scheda Play. L'accesso al canale Produzione è concesso, ma la pubblicazione pubblica non è dimostrata.

## Esito operativo 03/11/2026

- **Inventario di codice iniziale preparato**: flussi identificati e collegati a file/endpoint esistenti.
- **Stato NON verificato in Play Console**: nessuna dichiarazione inviata, salvata o alterata; richiesti DPO e controllo runtime.
- **Prima release Ads-free**: blocco «Data Safety» non chiuso finché le categorie non sono confermate per l'AAB firmato; gate Android fisici e GO finale ancora aperti.
- **Monetizzazione**: mantenere la PR #558 DRAFT, senza merge, Ads reali o nuovo AAB.

Fonti di riferimento: [Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469) e [Google Mobile Ads Next-Gen — Data Disclosure](https://developers.google.com/admob/android/next-gen/privacy/play-data-disclosure).

