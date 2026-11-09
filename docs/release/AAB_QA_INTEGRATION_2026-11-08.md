# DEMOS — AAB cumulativa QA locale, 8 novembre 2026

## Esito
- **Compilazione riuscita**: AAB non firmata Android 1.0.14, versionCode 17.
- **Percorso**: `client/android/app/build/outputs/bundle/release/app-release.aab` nella presente worktree QA.
- **Dimensioni**: 9.908.369 byte.
- **SHA-256**: `877EEFF74CBF23F85B2138EC373A1916581AEB81BB0A51F90F68361733327E9D`.
- Bundle validato: AndroidManifest di bundle conferma `versionCode 17` e `versionName 1.0.14`, Java compilato, 3 DEX e asset Vite inclusi. `jarsigner` conferma **NON FIRMATO**.
- AdMob: App Open SDK in percorso release con `BuildConfig.DEMOS_APP_OPEN_ADS_ENABLED=true`, **solo Google unit TEST** `ca-app-pub-3940256099942544/9257395921`; nessun ID commerciale in questo build. Non caricare questo AAB su Play closed track.
- Firebase: `demos-finale`, pacchetto Android `community.demos`; `google-services.json` copiato unicamente dalla configurazione locale verificata, *git-ignored*, non aggiunto a commit o Google Sheet. Plugin Capacitor Push Notifications nativo presente.

## Composizione sorgenti soltanto locale, senza push GitHub
- Test branch privata temporanea: worktree `.qa-aab-cumulative-20261108`, derivata da main `f61f67611`, head QA `d8d1e8f15` più due modifiche di sync Capacitor e incremento versione locale non committati.
- PR integrate soltanto nella copia QA: **#634 AdMob** (con base #558), **#633 Camera/Senato** (con base #576), **#635 eurodeputati**, **#502 Proponi soggetti**, **#620 fonti civiche/ECI/FCM**, **#583 tastiera**, **#588 native Push Android**. Nei tre conflitti ECI con #588 è stata conservata la più recente cache upsert *no DELETE* e i test di #620; conservate le parti Android/FCM di #588.
- PR #569 AI gratuita **esclusa dalla prima AAB** perché in conflitto sul router europarlamentare; la funzionalità AI resta facoltativa solo dopo collaudo.
- La copia QA non è stata pubblicata su GitHub e non costituisce una revisione/merge di ciascuna PR originale.

## Test locali della composizione
- `npm ci` client e API PASS.
- `VITE_ANDROID_NATIVE_PUSH_ENABLED=true` frontend Vite: build PASS (4055 moduli).
- API contrattuali selezionate: **40/40 PASS**.
- Client contrattuali notifiche/voti: **9/9 PASS**.
- ECI Python: **23/23 PASS**.
- `npm run android:sync:push`: PASS con Firebase locale verificato.
- Gradle `:app:bundleRelease` con App ID e unità Google SAMPLE (nessuna unità reale): **PASS, 182 task**, versionCode 17. Non equivale a test di dispositivo reale.

## BLOCCANTI prima di firma, Play e produzione — DOB NON blocca
1. Verifica completa della composizione in **CI GitHub sulla stessa HEAD** e test end-to-end con staging Render/Supabase **unificato**; includere contratti API reali e dati simulati separati. No nuovo staging.
2. Notifiche civiche/ECI/FCM: preflight T-55, source → outbox → FCM → telefono/tap/opt-out, **0/6 prove reali** concluse.
3. Proponi soggetti: schema e flussi moderazione, autorizzazioni utenti, consenso/diritti GDPR e test E2E verificati nel backend effettivo.
4. Camera/Senato ed EP: autorizzare soltanto ID istituzionali confermati e verificare le API/autenticazione; profili privi di crosswalk NON ricevono voti attribuiti. Un solo ultimo voto, NO storico, NO partiti/gruppi.
5. AdMob Play closed track: NON usare ID di Google TEST: usare ID del proprietario su AdMob con *app-version test mode* verificato, permessi adulti/consenso UMP e revisione DPO/Data Safety. Le ads commerciali rimangono disattivate.
6. Generare AAB firmata con upload key autorizzata, verificare Play versionCode > precedenti, reinstallazione/aggiornamento e collaudo su dispositivi fisici. Nessun upload, attivazione o deploy senza esplicito GO.
7. PR #569 AI resta fuori fino a integrazione separata con PE e test rigorosi; **NON blocca questa QA**.

**Decisione utente:** le tre DOB da correggere NON sono un gate per creare/testare o inviare la prossima AAB. Migrazioni DOB rinviate senza cambiare utenti reali, senza eliminare i controlli sugli identificativi ufficiali.

**Attività vietate/non eseguite**: nessun merge su main, push GitHub dalla QA, deploy Render, migrazione Supabase, nuova staging, invio Firebase reale, firma release, upload Google Play, attivazione annunci commerciali. Non pubblicare questa AAB non firmata.
## Integrazione e nuova AAB QA verificata 9 novembre 2026
- PR GitHub cumulativa: **#638 Draft** `integration/aab-cumulative-qa-20261109`, nessun merge su main.
- Regressioni risolte con test: rotte di priorità referendum dismesse rispondono 410/no-store, mentre le votazioni reali mantengono entrambi i guard CIE/consenso; sorgenti Camera/Senato attribuite in smoke solo con URL ufficiali e ID prova, non in produzione; ECI usa insieme UPSERT senza DELETE e advisory lock transazionale contro sincronizzazioni sovrapposte; fixture ECI PostgreSQL include la colonna reale `updated_at`; test Grazia mock del consenso fail-closed; test Openpolis dell'assenza di storico nominale aggiornato alla policy effettiva.
- Risolto crash **Capo di Stato** `ReferenceError` su JSX non importati `ThumbsUp`, `Info`, `CardDescription`: import espliciti + regressione automatica, compatibilità CRLF del test statico.
- Test sul codice cumulativo: **42/42 Node** nei contratti interessati; **23/23 Python ECI**; **30/30 prove Chrome** su 6 rotte/5 viewport con dati completamente sintetici. Il test effettivo di due sincronizzazioni ECI concorrenti resta da confermare sulla CI PostgreSQL GitHub.
- **AAB ricompilata dopo i fix**, 1.0.14 versionCode 17: file `app-release.aab` di **9.908.369 byte**, SHA256 **`877EEFF74CBF23F85B2138EC373A1916581AEB81BB0A51F90F68361733327E9D`**. `jarsigner -verify`: **unsigned**, Google SAMPLE App Open AdMob, push nativo e Firebase locale validati. Ancora vietata distribuzione Play.
- Il QA Chrome non equivale a 6/6 consegne Firebase su telefono fisico. Nessun nuovo staging, firma, Firebase reale, SQL produzione, deploy o Play upload.