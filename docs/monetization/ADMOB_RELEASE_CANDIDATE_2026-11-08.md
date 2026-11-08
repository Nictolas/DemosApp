# DEMOS — AdMob App Open, release candidate condizionata (08/11/2026)

**Stato: PR DRAFT / NO-GO annunci reali / NO-GO AAB cumulativa.** Dipende dalla PR #558 (branch `feat/advertising-privacy-first-20261102`). Nessun merge, deploy, Google Play upload o traffico Ads reale è autorizzato da questo documento.

## Ambito e decisioni immutate

- **Solo App Open Android**, non banner, interstitial aggiuntivi, AdSense web o annunci locali.
- Primo annuncio dal **terzo avvio**; **almeno sei ore** tra due visualizzazioni reali, misurate dal callback di visualizzazione, non dai preload.
- Nessun annuncio sopra contenuti pronti, voti, opinioni, sondaggi, firme, login, profili o notifiche; niente attese artificiali e nessuna impression garantita nei caricamenti rapidi.
- Solo adulti autenticati con indicatore booleano `ads_adult_eligible=true` da `/auth/me` (età autodichiarata, **non** verifica forte). Anonimi, minorenni e casi incerti: no UMP / no Ads.
- UMP prima di inizializzare GMA; blocco in mancanza di consenso esplicito TCF Purpose 1 e Google vendor 755, anche se `canRequestAds()` risulta vero. Personalizzazione disabilitata, consent changes invalidano gli ad precaricati. Nessun targeting con dati politici, ID profilo o comune.
- Il gestore mantiene la `WebViewClient` Capacitor e lascia intatti notifiche e navigazione.

## Cosa cambia rispetto alla PR #558

Il codice Java nativo esistente può essere usato anche da una **release candidate esplicitamente opt-in**: sono stati rimossi i controlli `BuildConfig.DEBUG` che la rendevano inutilizzabile in release. Le difese su età, consenso, periodo e caricamento restano invariati.

`client/android/app/build.gradle` prevede due percorsi:

| Compilazione | Default | SDK GMA/UMP | Manager | Unità |
| --- | --- | --- | --- | --- |
| `assembleRelease` standard | Ads **OFF** | Assenti | Stub | Nessuna |
| `assembleRelease -PdemosReleaseAppOpenAds=true ...` | Solo opt-in | GMA Next-Gen 1.6.0 / UMP 4.0.0 | Gestore esistente | **TEST Google** per default |
| Candidata con ID reali | Richiede opt-in *ulteriore* + autorizzazione | Presenti | Gestore | Reali, **non testare senza test devices/gate** |

Per le QA automatiche ci si limita all'App ID Google di esempio e all'unità App Open ufficiale di **TEST**. La candidata reale non va generata né distribuita senza esito positivo dei gate Play/AdMob/DPO e test su installazione/aggiornamento.

## Comandi ammessi per CI locale, senza annunci reali

```bash
cd client
npm ci
npm run android:sync
cd android
./gradlew :app:testDebugUnitTest :app:testReleaseUnitTest :app:assembleRelease
# Compilazione opt-in di sola prova, con identificativi pubblici GOOGLE SAMPLE:
./gradlew :app:assembleRelease \
  -PdemosReleaseAppOpenAds=true \
  -PdemosReleaseAdsTestOnly=true \
  -PdemosReleaseAdMobAppId=ca-app-pub-3940256099942544~3347511713
```

I controlli CI devono dimostrare **entrambi**: release ordinaria senza SDK e App ID pubblicitario; candidata opt-in con GMA/UMP e sola unità TEST. Senza `-PdemosReleaseAdsApproved=true` una configurazione con `demosReleaseAdsTestOnly=false` viene rifiutata da Gradle. L'approvazione tecnica della build **non coincide** con consenso al deploy. Gli ID produzione, presenti solo nella documentazione privata di account, vanno passati via proprietà locali/secret autorizzati, senza stamparli nei log o nel repository.

## Evidenze precedenti (PR #558)

- Emulatore API35: consentire, rifiutare, modificare/revocare e persistenza al riavvio provati con UMP DEMOS e unità TEST; fail-closed dopo rifiuto.
- App Open di TEST: `loaded`, `shown` e `impression` osservati **solo** in schermata di caricamento simulata; blocco di sei ore controllato.
- Android QA anonimo/offline senza adulto sintetico: nessuna richiesta UMP/Ads; CI al 07/11/2026 verde, run 42395691876.
- **Non** sono attestati display su avvio naturale adulto, installazione/aggiornamento su dispositivo fisico, accessibilità, ritorno da notifiche e compatibilità con l'AAB cumulativa.

## Gate di uscita — tutti obbligatori

1. **AdMob**: app `community.demos` collegata a store verificabile, review completata, verifica crawler `app-ads.txt`. Il file HTTP era già pubblicato ma il crawler non era confermato.
2. **Consenso / GDPR / ePrivacy**: il DPO controlla testo e finalità, configurazione attuale CMP con fino a 210 partner e possibile localizzazione SDK; consenso/rifiuto/revoca in ambiente non simulato e registro trattamenti. L'approvazione preparatoria del 02/11 non basta.
3. **Google Play**: target età, Ads declaration, Data Safety completa dell'AAB realmente destinato allo Store, audit SDK/permessi inclusi `AD_ID`, policy privacy; nessuna dichiarazione di trattamento zero soltanto perché gli annunci sono non personalizzati.
4. **QA telefono fisico** con account test adulto/minore/anonimo, prima installazione **e aggiornamento**, offline/online, consensi e logout, collisione con voto/firme/notifiche, back/foreground, accessibilità, veri tempi di caricamento e cap ≥6h.
5. **AAB cumulativa**: integrazione con le altre PR Android/notifiche e verifica binaria dell'AAB firmata; preservare il default Ads-free sino al GO.
6. **Monetizzazione/fiscalità**: titolarità dei ricavi, condizioni AdMob e inquadramento fiscale da confermare, senza attivare pagamenti.

## Esito di questa sessione

Proposta tecnica su ramo separato: sorgenti/CI predisposti; **i test finali vanno documentati con run GitHub specifico**. Il dispositivo Desktop Commander autorizzato risulta offline (08/11/2026): non dichiarare nuove prove locali o su telefoni. Nessun test con annunci reali, nessun deploy o modifica a Proponi / Parlamento / ECI.

Fonti ufficiali: https://developers.google.com/admob/android/next-gen/app-open/single-load ; https://support.google.com/admob/answer/9341964 ; https://support.google.com/googleplay/android-developer/answer/10787469 .
