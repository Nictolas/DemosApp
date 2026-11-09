# DEMOS Android 1.0.12 (15) — stabilizzazione 2026-11-03

## Evidenze verificate
- Base `main` al checkpoint: `0ead72bcb57106d986ad55f4fa23d8f48f14db85`.
- PR #566 integrata il 2026-11-02: `versionCode 15`, `versionName "1.0.12"`; workflow Android Alpha Validation sul commit della PR completato con successo.
- PR #571 integrata il 2026-11-03: controllo dell'AAB compilato privo di SDK pubblicitari, ID pubblicitario e metadati AdMob; workflow Android Alpha Validation sul commit della PR completato con successo.
- Navigazione mobile e scroll dedicato di iniziative popolari, ECI, referendum, preferenze notifiche e navbar sono già presenti in `main`. I test di contratto sono statici, non equivalgono a test touch su telefono.
- `NativeGoogleAuthPlugin` usa Android Credential Manager e consegna un ID token al backend DEMOS. Il token è convalidato lato server; questa revisione non tocca autenticazione, API o dati.

## Intervento isolato
Il layout principale è a viewport fissa (`100dvh`) e il manifest Android non specificava il comportamento della tastiera: il sistema poteva scegliere il pan, potenzialmente coprendo i campi e la barra di azione. `MainActivity` richiede ora `android:windowSoftInputMode="adjustResize"`, per consentire al WebView di adattare l'area disponibile alla tastiera. Aggiunto un test statico al contratto navbar; non sono stati modificati backend, Firebase, login, altre PR o Play Console. La regressione effettiva va verificata su dispositivo: non è corretto dichiararla risolta dal solo controllo del manifest.

## Distinzione delle build
- La CI Android compila una **release AAB non firmata** e può riuscire anche quando `google-services.json` non è presente: in questo caso `build.gradle` non applica il plugin Google Services. Non considerare tale artefatto una release con FCM collaudato.
- La PR #566 documenta un AAB firmato costruito localmente con la configurazione Firebase ufficiale, ma non stabilisce che ogni checkout o ogni artefatto CI corrente abbia quella configurazione.
- Prima di una candidata installabile: aggiornare il checkout al commit approvato, `npm ci`, `npm run android:sync`, `:app:assembleDebug` e `:app:bundleRelease`; in locale verificare `google-services.json` corretto **senza esporlo né committarlo**, firma/alias, versionCode e contenuti binari dell'AAB. Firma e caricamento restano fuori da questa PR.

## Checklist QA ancora aperta (telefono reale)
1. Installazione e primo avvio, Android 13–16, permessi di notifica e avvio offline.
2. Login Google, annullamento, sessione persistente, logout e successivo login; test Apple/passkey solo dove supportati.
3. Tastiera su campi login e impostazioni: campo focalizzato visibile, scroll e pulsanti sempre raggiungibili, tastiera aperta/chiusa, modalità landscape.
4. Navbar inferiore e scroll in Profilo, Impostazioni, Opinioni, Notifiche, Eventi, ECI, Referendum e Iniziative popolari (360px e landscape).
5. FCM su build configurata: permessi, registrazione token, ricezione, opt-out e rimozione token al logout, senza inviare a utenti reali per prova.

## Gate di rilascio
Solo PR DRAFT, nessun merge/deploy, nessun upload AAB o modifica Play Console, database, credenziali, provider o CHECKLIST MASTER. Non includere le PR separate per annunci, Play Integrity o votazioni parlamentari. **NO-GO** fino a test dispositivo e a una build candidata firmata/configurata verificata.
