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

## QA update simulato su Android API35 (integrazione 08/11)

È stato predisposto un passaggio aggiuntivo di CI con **una sola istanza di emulatore preesistente nel workflow** (nessun servizio Render/Supabase o staging creato):
- Gradle crea due APK `release`, **firmati con il certificato DEBUG standard di CI** e identificati esclusivamente come `community.demos.qaadsrc`, senza alcuna relazione con il pacchetto Google Play `community.demos`.
- Il primo APK è la release Ads-free; il secondo include GMA/UMP e **l'unità App Open TEST ufficiale Google**, con `BuildConfig.DEBUG=false`. Non è utilizzato alcun ID di produzione.
- Installazione della baseline, avvio; `adb install -r` della candidata senza cancellare i dati; avvio dopo upgrade; disinstallazione del solo pacchetto isolato; installazione *ex novo* della candidata e avvio. Gli step controllano che il processo resti attivo senza crash AndroidRuntime rilevati. Il test è **anonimo/offline** e non può dimostrare consenso, impression o qualità UI in sessione autenticata.
- Il flag `-PdemosReleaseQaIsolated=true` è **OFF di default**, rifiuta `demosReleaseAdsTestOnly=false` e gli App ID diversi da Google SAMPLE quando la pubblicità è inclusa.
- La sola presenza dei test e degli APK non dimostra successo: **verificare lo stato della run GitHub al commit effettivo** prima di segnare PASS. APK isolati NON sono AAB, NON vanno pubblicati su Google Play.

Rimangono obbligatorie QA con dispositivi Android fisici e upgrade dal pacchetto realmente distribuito con firma Play/App Signing, oltre ai gate DPO e Play Console.

## Collaudi chiusi e compatibilità AAB cumulativa (08/11/2026)

### Evidenza CI verificata

- PR [#634](https://github.com/Nictolas/DemosApp/pull/634) sul commit `8e8b9db54e48433caf43dfd50a5209a415ccf241`: [workflow 42513706857](https://github.com/Nictolas/DemosApp/actions/runs/42513706857) **COMPLETED SUCCESS, 2/2 job**. Entrambi `advertising-policy` e `android-native-debug-compile` sono PASS.
- Nello step `Build opt-in release candidate with Google TEST ads only` sono PASS la compilazione e il controllo della **AAB release non firmata**, con sola App ID di esempio Google, unità TEST, metadati AdMob; non è una AAB Play firmata. La normale release continua a essere **Ads-free**, senza dipendenze GMA/UMP, AdMob App ID e permission `AD_ID`.
- Emulatore Android API35: PASS con utenza anonima/offline, compilazione di APK release isolati, installazione baseline Ads-free, aggiornamento `adb install -r` verso TEST-ads, installazione pulita, verifica processo e assenza di crash AndroidRuntime rilevati. Non sono stati effettuati test consentiti da una sessione autenticata reale.
- Il [workflow 42513706828](https://github.com/Nictolas/DemosApp/actions/runs/42513706828) dei contratti catalogo è **SUCCESS**. I CI precedenti non sostituiscono il test dell'AAB realmente integrata e firmata.
- Pacchetto QA `community.demos.qaage` con Google TEST, **senza età sintetica**, archiviato nel Drive privato del titolare, non distribuito pubblicamente. Per il pacchetto isolato OAuth/Google login devono essere effettivamente verificati sul dispositivo: non presumerne il funzionamento.

### Compatibilità verificata a livello di diff (nessuna build combinata attestata)

| Integrazione | Evidenza repository | Azione per l'integratore AAB |
| --- | --- | --- |
| [#558](https://github.com/Nictolas/DemosApp/pull/558) | Base diretta della #634, entrambe Draft | Integrare **prima #558, poi #634**. Non fondere la #634 direttamente con `main` ignorando la base. |
| [#588](https://github.com/Nictolas/DemosApp/pull/588) (DEMOS 10, ECI/push) | Toccato **`client/android/app/build.gradle`** con `versionCode 16`, `versionName "1.0.13"`; la #634 parte da codice 15 / 1.0.12. Le modifiche JS di #588 a `useNativePush.ts` non si sovrappongono direttamente al manager Java AdMob. | Nella branch di integrazione preservare **16 / 1.0.13 o superiore**, senza annullare la logica di opt-in Gradle della #634; poi **recompilare e testare**. |
| [#583](https://github.com/Nictolas/DemosApp/pull/583) (tastiera) | Modifica `client/android/app/src/main/AndroidManifest.xml` per `android:windowSoftInputMode="adjustResize"`. La #634 usa il **manifest debug** soltanto per la variante advertising opt-in, senza modificare il manifest principale. | Mantenere `adjustResize` e verificare nel manifest unito **sia** la modalità tastiera sia, solo nella variante ad-capable, il metadato AdMob; testare tastiera su telefono. |
| Notifiche/FCM e Google login | #634 non modifica `useNativePush.ts` né i flussi FCM; la semplice assenza di patch comuni non certifica la compatibilità runtime. | Build configurata Firebase e test su dispositivo: login, ricezione/tap delle notifiche, ritorno in foreground, apertura deep link, assenza di annunci su pagina già pronta. |

**Confine di responsabilità:** questa PR prepara AdMob, mentre la chat/branch dell'integrazione AAB cumulativa è responsabile del merge coordinato, numero di versione, firma e rilascio. Nessuna PR viene fusa da questa verifica; la #634 resta Draft e in NO-GO annunci reali.

### Gate che richiedono ancora prove esterne

- **Tester Android fisico** (account adulto, minore e anonimo ove disponibili): verificare installazione e upgrade del pacchetto reale, login Google, CMP/UMP, rifiuto e revoca, sessioni/offline, notifiche, caricamenti naturali, visibilità e cap a sei ore. APK `qaage` con suffisso diverso non dimostra upgrade del pacchetto Play né login compatibile.
- **Accesso alle console** AdMob e Google Play: stato app, review, `app-ads.txt` accettato dal crawler, dichiarazione pubblicità, Data Safety, target età, requisiti fiscali/publisher. La sola presenza del file `app-ads.txt` non conferma la scansione.
- **DPO**: verifica finale e motivata della informativa, basi giuridiche, CMP vendor, revoca e dati effettivamente elaborati. Nessun automatismo può sostituire le decisioni effettive del titolare/DPO.
- **Build AAB cumulativa effettiva**: CI e signing verificati, versionCode corretto, installazione/aggiornamento Play, confronto dei manifest binari e contenuto SDK/permessi; release senza ads reali fino a GO separato.

## Verifica live da PC autorizzato e vincolo AdMob / Google Play — 08/11/2026

**Accesso strumenti:** DeskMCP in profilo locale `fully-unlocked` operativo, Desktop Commander online. Il browser DeskMCP isolato con profilo `demos-play-console-release` è arrivato alla pagina pubblica Play e al login Google AdMob; **non è una verifica autenticata degli stati interni** delle console. Chrome utente raggiunge la home Play Console, ma la lettura strutturata di app/dichiarazioni/stati non è ancora verificata. Non sono stati inseriti codici, modificati dati o concesse autorizzazioni.

**Verifica live HTTP / browser:**
- `https://www.demos.community/app-ads.txt` è pubblicamente raggiungibile e contiene esattamente `google.com, pub-7488681940015678, DIRECT, f08c47fec0942fa0` (stessa riga del sorgente `client/public/app-ads.txt`).
- `https://demos.community/app-ads.txt` reindirizza alla variante `www` con la medesima riga. **Raggiungibilità ≠ crawler Google verificato**.
- `https://play.google.com/store/apps/details?id=community.demos&hl=en` restituisce **«Not Found»** a una visita pubblica senza login. Ciò non prova l'assenza di test chiusi; **non è una scheda Play pubblicamente verificabile**.

**Blocco procedurale da fonti ufficiali Google (consultate 08/11):**
- [Google AdMob — configurare un'app](https://support.google.com/admob/answer/9989980?hl=it): per collegarla ad AdMob l'app Android deve essere **pubblicamente disponibile** in uno store supportato. Una app `non pubblicata` è testabile ma non può ottenere la normale verifica di idoneità prima dell'associazione allo Store.
- [Google AdMob — idoneità dell'app](https://support.google.com/admob/answer/10564477?hl=it): prima della revisione occorrono app pubblicata, scheda Store e collegamento AdMob.
- [Google AdMob — app-ads.txt](https://support.google.com/admob/answer/9776740?hl=it): il crawler prende come riferimento il sito web sviluppatore della scheda Store; può impiegare fino a 24 ore dopo un aggiornamento e lo stato effettivo va controllato in AdMob.
- [Google AdMob — guida iniziale](https://support.google.com/admob/answer/15948559?hl=en): per la readiness dell'account sono richiesti anche dati di pagamento, da confermare nella console senza attivare incassi.

**Sequenza consigliata (nessuna azione di rilascio autorizzata):**
1. Completare le verifiche della **AAB cumulativa Ads-free**, con dati privacy, notifiche, voti, Proponi e QA appropriata; lasciare disabilitati GMA/UMP per default sino al GO e mantenere il codice AdMob in Draft.
2. Quando il titolare autorizza effettivamente la disponibilità pubblica e gli altri gate della release sono superati, pubblicare la build approvata **senza annunci reali**. La pubblicazione NON è stata eseguita da questo audit.
3. Verificare che la scheda Play pubblica mostri il sito sviluppatore corretto, collegare l'app allo store in AdMob, controllare eventuali verifiche dell'account, revisione e stato del crawler app-ads.txt.
4. Solo dopo AdMob pronto, DPO/consenso/Play Data Safety aggiornati e collaudi su veri dispositivi, preparare una **successiva** release AdMob opt-in con IDs reali, firma e controlli Play. Mai considerare l'AAB CI Google TEST pronta per produzione.

**Decisione ancora del titolare:** autorizzazione pubblicazione dopo tutti i gate; non anticipare né approvare implicitamente release o annunci reali. Il calendario di disponibilità pubblica non è determinato da questa indagine.

## Evidenza account AdMob da schermata del titolare — 08/11/2026

Il titolare ha fornito in chat una schermata della **Home Google AdMob autenticata**, con URL `admob.google.com/v2/home`. Dati effettivamente leggibili nella schermata:
- Percorso iniziale **3/4**; nel riquadro **App → Collegati allo store** è richiesto di collegare l'app a uno store per richiederne la revisione; Google precisa che le app devono essere approvate prima di poter pubblicare annunci.
- **Pagamenti: «Il tuo profilo pagamenti è completo»** (check verde), indicato come pronto per essere esaminato e approvato. Questo **non** attesta avvenuta revisione fiscale/identità né possibilità di ricevere incassi.
- **Unità pubblicitarie: «La tua prima unità pubblicitaria è configurata»** (check verde). Questo **non** attesta annunci reali attivi nella AAB né l'approvazione dell'app.
- Utili stimati visibili 0,00 €. La schermata Home **non mostra** lo stato della verifica crawler `app-ads.txt`, l'eventuale `Ready`/limiti app, il dettaglio della quarta attività né i parametri GDPR/Play Data Safety.
- È stato constatato da DeskMCP che la scheda Chrome dell'utente è autenticata su AdMob, **ma la UI Automation del contenuto web non fornisce un albero affidabile** e la cattura desktop del browser è nera: dunque non si dichiarano ulteriori controlli interni autonomi. Il browser isolato DeskMCP richiede ancora login indipendente; non prelevare cookie/token della sessione personale.

**Conseguenza:** il dato Home corrobora il blocco **store linking / app readiness**. Le istruzioni ufficiali Google [Set up an app](https://support.google.com/admob/answer/9989980) e [About app readiness](https://support.google.com/admob/answer/10564477?hl=en) escludono il collegamento di app private Google Play: occorre una pagina pubblica e accessibile in uno store supportato. Una volta approvata la release cumulativa **Ads-free** per la pubblicazione dal titolare, eseguire store linking, verifica crawler `app-ads.txt` e revisione AdMob. **Non** pubblicare ora, non dichiarare AdMob `Ready` e non attivare traffico reale.

## Evidenza app-ads.txt da pagina AdMob DEMOS — 08/11/2026

Schermata autenticata fornita dal titolare dell'account: URL `https://admob.google.com/v2/apps/appadstxt`, selezione **DEMOS — Android**, voce **app-ads.txt** nel menu dell'app. La pagina visualizza **«Ancora nessuna richiesta di annuncio con file app-ads.txt»** e una tabella senza righe (`Nessun dato da visualizzare`). L'avviso indica che le modifiche agli URL del dominio possono impiegare **fino a 7 giorni** per essere rilevate dal crawler Google.

**Interpretazione limitata ai fatti:** il file `https://www.demos.community/app-ads.txt` è raggiungibile dal browser e la riga del publisher corrisponde al sorgente; la schermata AdMob **NON conferma lo stato `verified`/«trovato e verificato» e non mostra alcuna scansione datata**. Non attesta neppure un errore di sintassi del file. Non trasformare la tabella vuota in un falso PASS o FAIL. Per [Google AdMob — risoluzione problemi app-ads.txt](https://support.google.com/admob/answer/9776740/), uno stato può non apparire quando l'app non ha registrato richieste pubblicitarie negli ultimi 7 giorni **oppure** il file non è ancora verificato. Google descrive come tempo abituale fino a 24 ore dopo la rilevazione di listing/sito aggiornati, ma può essere più lungo in situazioni di basso traffico; rispettare l'avviso più conservativo della console senza promettere scadenze.

**Prossimo step sicuro:** completare e collaudare l'AAB cumulativa iniziale Ads-free; quando la pubblicazione pubblica sarà autorizzata e confermata, verificare il sito sviluppatore associato alla scheda Google Play, eseguire il collegamento in AdMob, poi controllare in console `app-ads.txt` e la revisione. Non inviare richieste pubblicitarie sintetiche o traffico reale per far apparire la riga, non accendere Ads, non forzare il rilascio. **Stato: crawler / linking ancora NO-GO non risolto.**

## Protezione supplementare — ritorno da notifiche / background (08/11/2026)

La revisione del gestore nativo ha identificato un caso di rischio non attestato dai test precedenti: **`onResume()` poteva riutilizzare un annuncio già precaricato se la WebView risultava temporaneamente vuota**, anche durante il ritorno da una notifica o da un'altra Activity. Lo stato `root.children.length === 0` da solo non distingue un vero avvio da un ripristino dopo navigazione.

**Correzione in PR #634** (`DemosAppOpenAdsManager.java`, commit `2a4bc6d` e precedenti):
- `coldLaunchDisplayWindowOpen` inizia `true` soltanto alla creazione della Activity; al **primo `onPause()`** passa irreversibilmente a `false` per quella Activity.
- All'uscita in background viene **distrutta** la creatività precari­cata. `loadOnlyTestAppOpenAd()`, il callback asincrono `onAdLoaded` e le due verifiche di `maybeShowOnlyWhileReallyLoading()` rifiutano annunci su successivi ritorni in foreground, anche con React root momentaneamente vuota.
- Non vengono cambiati UMP, TCF, criterio adulti, numero di avvii, intervallo 6 ore, autenticazione o notifiche. Un ripristino da background non dà diritto a un nuovo App Open; l'eventuale annuncio di prova resta confinato alla finestra di **avvio a freddo** con schermata davvero vuota e consenso completo. Anche una form UMP che manda in pausa l'Activity chiude tale finestra: si preferisce perdere un'impressione piuttosto che mostrarla mentre si ritorna da privacy/login/notifica.
- Contratto statico aggiunto in `client/tests/appOpenNativeContract.test.mjs`, incluso il controllo sulla creatività caricata tardivamente. Le QA anonime/offline CI non dimostrano il comportamento adulto su dispositivo: **test manuale notifica → foreground → root vuota resta obbligatorio**.
- La verifica di compilazione e test deve essere rifatta sul nuovo HEAD; non riutilizzare il PASS della CI precedente `42513706857` per affermare che questa correzione è già stata collaudata.

## Pacchetto QA aggiornato e protocollo tester Android (08/11/2026)

**Fonte verificata:** GitHub Actions [run 42522161593](https://github.com/Nictolas/DemosApp/actions/runs/42522161593), **SUCCESS 2/2**, artefatto `DEMOS-REAL-AGE-UMP-GOOGLE-TEST-ADS-DEBUG-APK` (artifact id `13633613985`). Archivio ZIP controllato (due file integri: `DEMOS-REAL-AGE-QA-TEST-ONLY.apk`, `LEGGIMI-ETA-REALE.txt`), SHA-256 del ZIP trasferito: `7a6c68b8b5e2e683fe6c358305996f75db1d7581014b7e7b2bd041eb44bab15a`. Copia conservata nel **Drive privato del titolare**, [DEMOS-QA-ETA-REALE-FIX-NOTIFICHE-TEST-2026-11-08.zip](https://drive.google.com/file/d/1U2cWNvG7vV1Im9ImzZg4IHgeSNSk30oP/view), senza permessi di condivisione con altri utenti. Link **da non pubblicare**; l'accesso del tester va autorizzato dal titolare. La vecchia ZIP di prova NON include questa correzione e non va utilizzata per certificare il test notifiche.

**Identità variante:** DEBUG `community.demos.qaage`, installazione separata dalla DEMOS Google Play, Google App ID DEMOS con sola **unità pubblicitaria TEST** Google; `DEMOS_QA_FORCE_ADULT=false`, `DEMOS_UMP_DEBUG_EEA=true`. La sola presenza della ZIP non attesta il funzionamento dell'autenticazione: la variante `.qaage` **potrebbe non essere registrata** nei client OAuth/Firebase del progetto, e Google Sign-In può quindi non riuscire. Non creare o alterare un account reale, non disabilitare il controllo d'età, non inserire credenziali nei log; in caso di login bloccato il test adulto è **NON ESEGUITO**, non PASS.

### Procedura manuale QA — inviare al tester autorizzato

| Passo | Condizione / azione | Esito atteso e prova non sensibile |
|---|---|---|
| 1 | Android fisico del tester, installare ZIP APK `.qaage` e avviare normalmente | Avvio stabile, app vera ancora installata, nessun annuncio per utente anonimo |
| 2 | Provare login con account **autorizzato di prova**, verificare chiamata `/auth/me` e stato adulto tramite UX (mai riportare JWT, email, anno di nascita) | Autenticazione reale funziona; se OAuth fallisce, annotare soltanto **LOGIN BLOCCATO** |
| 3 | Test adulto verificato, online in SEE, UMP config presente nell'account | CMP disponibile quando richiesta, nessuna pubblicità prima del consenso specifico |
| 4 | Rifiutare finalità annunci (Purpose 1) e/o vendor Google; aprire opzioni e revocare | Nessuna richiesta ads dopo rifiuto/revoca; non trasmettere stringhe TCF né identificativi |
| 5 | Solo consenso adeguato, rilanciare app su schermata naturalmente vuota; non prolungare artificialmente il caricamento | Annunci **Google TEST** eventualmente mostrati soltanto sul loading autentico, non garantiti; prima dei primi tre lanci nessun annuncio; limite massimo 1 ogni 6 ore |
| 6 | Mettere DEMOS in background, ricevere una **notifica QA autorizzata** (se funzionalità pronta), toccarla e ritornare all'app | Nessun annuncio nel ritorno alla notifica/foreground, anche con root WebView transitoriamente vuota |
| 7 | Logout/cambio account, utente non verificato, rete disattivata e ritorno online | Nessun annuncio e nessun avvio UMP sotto utente non adulto/verificato, nessun crash |
| 8 | Se possibile, verificare overlay tastiera `adjustResize`, FCM e apertura deep-link insieme alla branch AAB cumulativa | Questa ZIP è **solo AdMob**: non sostituisce il collaudo della build cumulativa firmata |

**Report minimo richiesto:** modello Android e versione OS (non seriale), versione del pacchetto QA, PASS/FAIL/BLOCCATO per ciascun passo, presenza di crash e descrizione tecnica priva di informazioni personali. Screenshot soltanto se privi di nomi, email, token, preferenze politiche, dati di votazione, TCF string e ID dispositivo.

**Vincoli finali:** APK di debug separato, firmato solo per QA; non distribuirlo su Play, non usarlo per testare aggiornamenti dalla AAB ufficiale, non inferire l'approvazione AdMob dal caricamento di un annuncio Google TEST. Il download da Drive è privato, non è già stato consegnato ai tester.
