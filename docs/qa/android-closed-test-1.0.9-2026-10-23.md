# DEMOS Android 1.0.9 (versionCode 11) — candidata test chiuso

Data: 23 ottobre 2026. Pacchetto `community.demos`. Basata su `main` dopo PR #233 e #234.

## Scopo
Aggiornare la build nativa che i tester scaricano da Google Play. Comprende il web bundle React corrente, le correzioni recenti di navbar/mobile e i flussi Opinioni; backend e pannello DPO sono già pubblicati separatamente.

## Versione e prove
- `client/android/app/build.gradle`: `versionCode 11`, `versionName "1.0.9"`, minSdk 24, targetSdk 36.
- `.github/workflows/android-alpha-validation.yml`: test OAuth/native auth, regressione navbar, build frontend, Capacitor sync, icone e build Android debug + AAB release NON FIRMATO.
- Non considerare un AAB compilato in CI pronto per Play: la firma deve utilizzare l'upload keystore originale del pacchetto `community.demos`.
- Le funzionalità native push FCM vanno qualificate separatamente con `google-services.json`, build dedicata e dichiarazioni Data Safety; non annunciare push attivo solo perché il plugin è presente.

## Gate per la pubblicazione nel test chiuso
1. Controllare nella Play Console il massimo versionCode già caricato e la track chiusa corrente. Se il massimo è almeno 11, aggiornare ulteriormente la versione prima della build.
2. Assicurarsi che i tester abbiano accesso tramite il relativo account Google Play e che il link di adesione/test chiuso sia funzionante. L'aggiornamento del pacchetto NON risolve problemi di accesso alla track, di paese o di approvazione.
3. Verificare il build React e Capacitor sul commit finale. Compilare **AAB firmato** con lo stesso upload key già registrato su Play; non condividere chiavi, password o `google-services.json` nel repository o nei log.
4. Caricare `app-release.aab` nella **track di test chiuso**, aggiungere note di rilascio e inviare per revisione/rollout dalla Play Console.
5. Dopo disponibilità su Play: aggiornare uno dei dispositivi di test già iscritti e provare login Android, scelta+salvataggio Opinioni, navbar senza sovrapposizioni, approfondimenti scroll, Proponi Opinione e navigazione.
6. Raccogliere evidenze dello stato Play (in revisione/approvata/disponibile) e riportarle nel Google Sheet Engineering. Non affermare distribuzione ai tester fino a conferma Play.

## Note candidate per i tester
DEMOS 1.0.9: miglioramenti della navigazione su Android, barre di navigazione più leggibili e correzioni nella selezione e nel salvataggio delle opinioni. Aggiornamento generale di stabilità.

## Blocco attuale
Il connettore Play Console non è disponibile: questo branch prepara il candidato e i test CI ma non esegue l'upload o l'invio a revisione. Il PC remoto è connesso ma le funzioni di controllo remoto hanno raggiunto il limite mensile; non è quindi stato possibile produrre il bundle firmato con la chiave locale attraverso quella connessione.
