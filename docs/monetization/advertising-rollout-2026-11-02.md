# DEMOS — App Open Ad Android: rollout controllato

Data: 2026-11-02. **Ambito prioritario esclusivo: App Open Ad Android.**
Stato: preparazione tecnica in PR draft #558; **annunci non attivi**.

## Approvazione DPO comunicata
- **02/11/2026 — approvazione dichiarata dall'utente per conto del DPO**: configurazione di consenso e impostazione preliminare App Open Android, nonché preparazione dei testi Privacy/Cookie. Questa registrazione documenta la conferma ricevuta, non una verifica indipendente né un'autorizzazione a presumere superati controlli tecnici e di piattaforma.
- **Gate DPO: approvazione preparatoria ricevuta.** Restano separati: test end-to-end su Android, comportamento di UMP al rifiuto/revoca, configurazione minori, controlli delle categorie pubblicitarie, Play Console e revisione dell'app da parte di AdMob. Eventuali modifiche sostanziali ai trattamenti effettivi richiedono riesame della documentazione.
- **Non autorizzare automaticamente** un'unità pubblicitaria reale in una release, né modificare o pubblicare messaggi CMP sulla base della sola approvazione preliminare.


## Decisione di prodotto
- Solo annunci **commerciali non personalizzati**.
- Finestra mobile di **almeno 6 ore** tra due annunci effettivamente mostrati, non tra richieste/caricamenti.
- **Nessun annuncio al primo utilizzo**; preferire mostrarlo dopo più utilizzi, come raccomandato da Google.
- Solo se c'è già un annuncio precaricato, valido e una **schermata di caricamento reale** ancora visibile al foreground. Niente attese create artificialmente.
- Non mostrare sopra voto, sondaggi, opinioni, firme, profilo, login, notifiche, contenuti sensibili o una schermata già pronta.
- Se il caricamento dell'app termina prima che l'annuncio sia pronto, saltare l'annuncio.
- Mai mostrare un annuncio appena rientrati da link esterni se contenuto principale è già visibile.
- Nessun uso di risposte, preferenze politiche, segmentazioni ideologiche, profilo, sesso, anno di nascita, residenza, email, user ID o log utente per pubblicità.
- L'App Open Google può essere chiuso dall'utente; **non possiamo imporre che duri esattamente 3 secondi**.

## Ciò che rimane sospeso
Banner AdSense web, banner Android e spazi sponsorizzati locali sono fuori dall'intervento e dalla PR corrente.

## Integrazione disponibile nella PR #558 (solo DEBUG)
- `client/android/app/build.gradle`: GMA **Next-Gen SDK 1.6.0** e UMP **4.0.0**, dipendenze `debugImplementation` soltanto; le build release non includono questi SDK. Il flag `DEMOS_APP_OPEN_ADS_ENABLED` è sempre `false` in release e `false` per impostazione predefinita anche in debug.
- `client/android/app/src/debug/AndroidManifest.xml`: App ID Google di **test per impostazione predefinita**, con placeholder Gradle che consente di fornire **solo nella compilazione debug** l'App ID DEMOS per il test UMP. L'ID reale non è scritto nel repository; il manifest release non ha App ID AdMob.
- `client/android/app/src/debug/java/community/demos/DemosAppOpenAdsManager.java`: aggiornamento UMP, richiesta del modulo necessario, verifica del consenso e di `canRequestAds()` prima dell'inizializzazione; personalizzazione disabilitata mediante Publisher Privacy Treatment; callback App Open Next-Gen; controllo della schermata realmente vuota prima di mostrare, nessuna attesa inserita artificialmente.
- `client/android/app/src/release/java/community/demos/DemosAppOpenAdsManager.java`: implementazione vuota senza SDK.
- `client/android/app/src/main/java/community/demos/NativeAppOpenPrivacyPlugin.java`: bridge Capacitor con sola API per sapere se UMP richiede il pulsante e presentare il modulo delle preferenze. Nessun dato del profilo passa dal bridge.
- `client/src/lib/native-app-open-privacy.ts` + `client/src/pages/Impostazioni/components/AppOpenPrivacyOptions.tsx`: opzioni UMP accessibili quando richieste nelle **Impostazioni** e, per chi non è autenticato, dal footer della schermata iniziale e dalla pagina di autenticazione. Su web e nella variante Android release il pulsante è assente.
- Il gestore Android svuota il precaricamento prima di aprire le opzioni UMP e ricontrolla le preferenze alla chiusura; non è possibile aprire il modulo durante un annuncio a schermo.
- **Protezione revoca in volo:** ogni apertura delle opzioni UMP incrementa una generazione di consenso locale; un App Open richiesto prima della modifica viene distrutto se la risposta asincrona arriva dopo l'inizio del cambio di consenso. Anche `Activity.onDestroy()` invalida i caricamenti pendenti. La revoca end-to-end è stata provata su emulatore; il dispositivo fisico resta da verificare.
- `client/android/app/src/main/java/community/demos/MainActivity.java`: wiring al gestore nativo solo dietro flag; il WebViewClient Capacitor non viene sostituito.
- `client/android/app/src/main/java/community/demos/AppOpenFrequencyPolicy.java`: regole condivise e pure per almeno 3 avvii, frequenza mobile di 6 ore, orologio arretrato e valori corrotti (nessuna dipendenza pubblicitaria).
- `client/android/app/src/test/java/community/demos/AppOpenFrequencyPolicyTest.java`: test JUnit eseguiti nelle varianti debug e release.
- `client/src/lib/advertising-policy.ts`: specifica fail-closed a livello web/TS; **non** è collegata direttamente all'SDK Android e non va dichiarata automaticamente applicata ai client nativi.
- `client/tests/advertisingPolicy.test.mjs` e `client/tests/appOpenNativeContract.test.mjs`: test TypeScript/contratto; CI compila e testa con JUnit sia debug sia release.
- Dopo i gate di età adulta autenticata e consenso UMP/TCF, il gestore può **precaricare un solo annuncio TEST** anche quando la UI è già pronta; il retry è limitato a una volta ogni 15 minuti. **Mostrare** l'annuncio è sempre subordinato a una nuova lettura della root React effettivamente vuota, in foreground e in un autentico caricamento. Nessuna attesa artificiale.
- Il test emulatore ha confermato caricamento, visualizzazione e callback impression di un annuncio ufficiale di prova **soltanto con schermata di caricamento sintetica nell'emulatore**. L'app reale non trattiene gli utenti; la UI spesso è già pronta, quindi non è garantita alcuna frequenza di impression in uso normale. Nessuna monetizzazione attiva nelle release.
- `SharedPreferences`: valori tipizzati male non causano crash, ma bloccano gli annunci; contatore avvii saturo senza overflow; il timestamp di display è salvato nel callback con `commit()`, non all'inizio del caricamento.
- Il gestore libera la creatività precaricata alla distruzione dell'Activity.
- **Nessuna release, AAB distribuito o sito è stato modificato da questa PR draft**.

Test di sviluppo manuale, solo su dispositivo autorizzato e account/pubblicità di TEST:
```bash
cd client
npm ci
npm run android:sync
cd android
./gradlew :app:assembleDebug -PdemosDebugAppOpenAds=true
```
Senza il parametro `-PdemosDebugAppOpenAds=true`, **nessuna inizializzazione UMP/GMA**. Non utilizzare ID pubblicitari reali per questo test.

## Account AdMob e unità App Open — verifica 02/11/2026
- Account Google AdMob operativo, profilo pagamenti mostrato come completato.
- Applicazione Android **DEMOS** aggiunta in AdMob; stato osservato: **Richiede revisione**. La sola creazione dell'unità non significa approvazione dell'app e non permette di dichiarare la monetizzazione attiva.
- Nuova unità **Apertura app** creata correttamente. È distinta dalla vecchia unità **Banner**, che resta fuori dal progetto App Open.
- **Entrambi gli identificativi di produzione sono stati acquisiti** e trascritti nella roadmap privata `DEMOS – Strategia – Scalabilità e Finanziamento`, tab `ADS – MONETIZZAZIONE`, voce `ADS-08`. Non ripeterli inutilmente in GitHub, test, issue o log.
- **Non sostituire gli ID ufficiali di test Google nel prototipo DEBUG** con quelli reali. Le dipendenze AdMob e UMP continuano a non essere incluse in RELEASE. Richieste vere prima della verifica dell'account e delle autorizzazioni non sono previste.
- Passo account successivo: `Privacy e messaggi` → messaggio `Normative europee` associato a DEMOS, con collegamento alla policy privacy effettiva; poi verificare e configurare `Controlli di blocco`, limiti di età/posizionamento, conformità e revoca consenso. Evitare di dichiarare un messaggio pubblicato senza verifica nella console.
- Per l'approvazione AdMob, la app deve risultare associata a uno store supportato e idonea a revisione. **Non pubblicare DEMOS prematuramente** soltanto per questo gate.
- `client/public/app-ads.txt` **integrato in `main` via PR #563** con **la stessa riga Google esistente** in `client/public/ads.txt` (publisher ID già visibile nel progetto), secondo il formato ufficiale di Google. La CI controlla contenuto, unico venditore e presenza in `client/dist/app-ads.txt` dopo la build; **non è ancora distribuito sul sito live né verificato dal crawler AdMob**.
- Verificare nella console AdMob `App → Visualizza tutte le app → app-ads.txt → Come impostare` che lo snippet personalizzato corrisponda a questo file, quindi che il dominio dello sviluppatore nello Store sia quello desiderato. Solo dopo la pubblicazione sul sito e la scansione di AdMob si potrà chiudere il gate.
- `ads.txt` web e `app-ads.txt` Android sono file distinti, anche se in questo caso riportano lo stesso venditore Google; non implicano attivazione di banner o annunci sul sito.

Fonti ufficiali:
- https://support.google.com/admob/answer/10564477
- https://support.google.com/admob/answer/10114014
- https://support.google.com/admob/answer/10113106
- https://support.google.com/admob/answer/12226986

## Messaggio europeo AdMob e bozze legali (02/11/2026)
- In `Privacy e messaggi → Regolamenti europei → Messaggi`, l'account mostra il messaggio **`DEMOS – Consenso pubblicitario UE`**, associato a DEMOS Android, **stato iniziale: Bozza**; questa rilevazione è **STORICA**, precedente alla pubblicazione confermata il 02/11/2026.
- Il modulo di configurazione mostrato nella console presenta tre scelte: `Nega il consenso`, `Acconsenti`, `Gestisci le opzioni`, senza pulsante di chiusura sostitutivo. Targeting: **SEE, Regno Unito e Svizzera**. Lingua primaria: italiano. URL di riferimento inserito: `https://demos.community/privacy-policy`.
- Impostazioni account della CMP: elenco automatico dei **198 partner comuni** mantenuto; questo **non** implica che tutti ricevano dati su ogni utente. Aggiunta automatica di ulteriori origini annunci disattivata, massimizzazione automatica dei messaggi disattivata, controllo consenso per creatività RTB attivato, controlli di interesse legittimo visibili ma **disattivati per impostazione predefinita**, modalità consenso altri prodotti Google disattivata, funzionalità speciale 2 disattivata, sincronizzazione delle scelte tra app non configurata, 0 finalità per uso proprio dichiarate nella CMP.
- Nessuna verifica indipendente dell'effettiva pubblicazione CMP o del comportamento del messaggio su dispositivi: prima del rilascio occorre provarlo con il vero **AdMob App ID**, un dispositivo di test e la corretta configurazione UMP. L'app in AdMob risulta ancora `Richiede revisione`.
- La PR #558 prepara **senza distribuire** una integrazione informativa in `client/src/pages/PrivacyPolicy.tsx` e `client/src/pages/CookiePolicy.tsx`. Il testo distingue sito web e Android, descrive il possibile trattamento di IP, identificatori, interazioni e diagnostica da parte di Google Mobile Ads, indica il futuro consenso/pubblicità non personalizzata e precisa che **nella release attuale non ci sono SDK pubblicitari**. Nessuna dichiarazione di assenza assoluta di dati per gli annunci non personalizzati.
- È stato aggiunto `client/tests/advertisingPrivacyNotice.test.mjs` alla validazione pubblicitaria CI per prevenire affermazioni errate o cambiamenti non coordinati. **Attenzione:** anche dopo il merge, la pagina web effettiva va distribuita, verificata e revisionata dal DPO, prima di pubblicare il messaggio UMP o una release con annunci.
- Restano da chiarire prima della pubblicazione definitiva: titolare e ruoli privacy dei partner, basi giuridiche effettive, finalità e retention dei dati SDK, informativa Google Play Data Safety, minori, eventuali trasferimenti extra-SEE, controllo delle categorie politiche/sensibili e verifica che UMP rispetti rifiuto/revoca.

Riferimenti tecnici:
- https://developers.google.com/admob/android/next-gen/privacy/play-data-disclosure
- https://developers.google.com/admob/android/next-gen/targeting
- https://support.google.com/admob/answer/10114014
- https://support.google.com/admob/answer/10113106

## Verifica pubblica e blocco categorie — 02/11/2026
- La verifica HTTP eseguita dal dispositivo Windows collegato (nessun browser Edge) su `https://demos.community/app-ads.txt` ha restituito `301` verso `https://www.demos.community/app-ads.txt`, poi **`200 OK`** con `Content-Type: text/plain` e la riga **`google.com, pub-7488681940015678, DIRECT, f08c47fec0942fa0`**. Il deploy frontend Render `ac9d79b` risulta `live`.
- **Gate HTTP e pubblicazione del file: CHIUSO.** **Gate verifica AdMob: APERTO**; non è stata letta la console AdMob per sapere se il crawler ha associato il publisher al dominio sviluppatore indicato in Play. La scansione può richiedere almeno 24 ore.
- Le informative Privacy/Cookie sono ora in `main` tramite PR #564 e nel frontend Render `live` al commit `ac9d79b`. Il comportamento della pagina nel browser va controllato, ma il suo deploy è completato.
- In AdMob, agire a **livello di app**, non account: `App → DEMOS → Controlli di blocco → Gestisci le categorie sensibili → Politica → Blocca`. Lo screenshot AdMob fornito dall'utente il **02/11/2026 alle 16:46** mostra chiaramente il menu specifico **DEMOS → Controlli di blocco**, la riga **`Politica: Bloccato`** e il selettore blu. **Configurazione app-level CONFERMATA**, non dedotta dallo stato dell'account. La classificazione automatica non garantisce il blocco di ogni creatività. Il riscontro resta visivo, non una lettura diretta dell'API AdMob.
- Non attivare indiscriminatamente tutti i blocchi sensibili: le categorie ristrette (come alcuni annunci per alcol o gioco d'azzardo) possono essere già bloccate in partenza e le categorie disponibili dipendono dal paese. Verificare eventuali ulteriori blocchi mirati in base al contenuto e all'audience di DEMOS.
- Anche dopo il blocco `Politica`, Google specifica che la classificazione automatica non garantisce la rimozione di ogni annuncio politico. Controllare periodicamente il `Centro revisione annunci` e bloccare eventuali inserzionisti/URL indesiderati. Il filtro categoriale non sostituisce la moderazione.
- Fonti: https://support.google.com/admob/answer/3150176?hl=it, https://support.google.com/admob/answer/3150953?hl=it, https://support.google.com/admob/answer/9363762, https://support.google.com/admob/answer/14538460

## Verifica locale su emulatore Android API 35 — 02/11/2026
- In ambiente Windows collegato è stata creata una **worktree isolata** su disco D: al commit `3a7c9d4`; la worktree abituale con modifiche preesistenti è stata lasciata intatta. L'APK di QA usa **solo gli identificativi di TEST Google** e la flag `-PdemosDebugAppOpenAds=true`. Nessun AAB di produzione creato o distribuito.
- `npm ci`: completato. `node --test tests/advertisingPolicy.test.mjs tests/appOpenNativeContract.test.mjs tests/advertisingPrivacyNotice.test.mjs`: **16 test superati**. `npm run android:sync`: riuscito. `gradlew :app:assembleDebug -PdemosDebugAppOpenAds=true`: **BUILD SUCCESSFUL**, 104 task.
- Dispositivo di prova: emulatore `Demos_QA_API35`, Android API 35, avviato con dati scrivibili separati su disco D:. Il dispositivo virtuale conteneva già `community.demos` con firma diversa: **non è stata disinstallata o sovrascritta**. Per la prima prova è stato aggiunto **solo nella copia locale** `applicationIdSuffix '.qaopen'`, creando il pacchetto `community.demos.qaopen`; **nelle nuove prove EEA il suffisso viene applicato automaticamente da Gradle soltanto alla build debug**, senza sovrascrivere DEMOS.
- APK debug QA installato con successo. `MainActivity` avviata, processo attivo; `SharedPreferences` native `native_launch_count` inizialmente 1 e poi **3 dopo riavvii effettivi** (la scrittura `apply()` è asincrona, per cui si è attesa la persistenza prima di leggere il valore). Nessun crash `AndroidRuntime:E` rilevato durante la prova.
- Screenshot dell'emulatore: schermata di benvenuto DEMOS visibile con `Continua con Google`, link `Privacy pubblicitaria`, **nessun annuncio a schermo o overlay**. Questo è un controllo del caricamento della schermata, **non una prova di esposizione corretta dell'annuncio**.
- **NOTA STORICA (PRIMA DELLA PUBBLICAZIONE CMP):** in questa prima prova restavano indisponibili accettazione, rifiuto, revoca e impression. Dopo la pubblicazione in AdMob questi test sono stati eseguiti, come documentato nella successiva sezione **QA App Open TEST e protezione minori**. Restano ancora aperti device fisico, accessibilità, offline, controllo minori su rilascio e test su caricamento naturale.
- L'installazione/QA riguarda soltanto un pacchetto di debug distinto: **release Android ed annunci reali restano invariati**.

## Test UMP EEA con App ID DEMOS (solo debug) — 02/11/2026

- In PR #558 è stato aggiunto l'opt-in Gradle `-PdemosDebugUmpEea=true` e `-PdemosDebugAdMobAppId=<APP_ID_DEMOS>`. La modalità EEA usa `ConsentDebugSettings` soltanto nel manager `src/debug`; l'emulatore Android è un dispositivo di test riconosciuto automaticamente da UMP. La build predefinita mantiene l'App ID dimostrativo di Google. L'unità pubblicitaria rimane **sempre** quella TEST ufficiale `ca-app-pub-3940256099942544/9257395921`.
- QA isolata su Windows, Android API 35, pacchetto `community.demos.qaopen` (in questa prima prova il suffisso era locale; **ora l'isolamento è automatico nelle sole build debug con `-PdemosDebugUmpEea=true`**, mai nelle release). `node --test`: **18/18**. Gradle `:app:assembleDebug :app:compileReleaseJavaWithJavac`: **BUILD SUCCESSFUL** (167 task). Installazione QA `Success`.
- **Blocco riscontrato in esecuzione:** chiamando `requestConsentInfoUpdate` con il **vero App ID DEMOS** e geografia EEA simulata, UMP registra `Publisher misconfiguration: Failed to read publisher's account configuration; no form(s) configured for the input app ID`. Il callback riceve **`update-failed-code=3`**. Non è comparso alcun modulo di consenso. Coerente con la schermata AdMob che mostrava il messaggio «DEMOS – Consenso pubblicitario UE» ancora in **BOZZA**. Per attribuire definitivamente la causa bisogna pubblicare il messaggio e riprovare; il test non dimostra un malfunzionamento dell'interfaccia Android.
- **Fail-closed verificato nel codice:** nel ramo errore UMP il gestore non chiama `initializeSdk`; non tenta di caricare né mostrare un annuncio. La prova non va conteggiata come test superato del rifiuto/revoca: non è stato possibile interagire col modulo.
- **Controllo anti-leak release:** il `BuildConfig` compilato con opzioni debug EEA attive conserva `DEMOS_APP_OPEN_ADS_ENABLED=false`, `DEMOS_UMP_DEBUG_EEA=false`, App ID e Ad Unit vuoti nella variante release. Il manifest release generato non include `com.google.android.gms.ads.APPLICATION_ID`.
- **Azione necessaria in AdMob:** aprire `Privacy e messaggi → Regolamenti europei → Messaggi → DEMOS – Consenso pubblicitario UE`, completare eventuali convalide e **pubblicare il messaggio UE** per DEMOS. DPO: assenso preparatorio comunicato; verificare che scelte e testi finali corrispondano all'approvazione. La pubblicazione del solo messaggio non attiva gli annunci nella release Android priva di SDK.
- **Dopo la pubblicazione:** cancellare soltanto i dati del pacchetto di test `community.demos.qaopen` o usare nuovo emulatore (non cancellare `community.demos`); riprovare UMP con EEA simulata, accetta/nega/gestisci e revoca; verificare rete, preferenze e frequenza. **Non trattare `ConsentStatus.OBTAINED` o `canRequestAds()` come prova che l'utente abbia acconsentito a ogni finalità:** gli stati UMP non identificano da soli i singoli consensi TCF, quindi la politica «Nega → non mostrare» deve essere provata e, se necessario, implementata con un gate aggiuntivo conforme prima del GO.
- Fonte ufficiale: https://developers.google.com/admob/android/next-gen/privacy

## QA UMP pubblicata: accetta, rifiuto, revoca e persistenza — 02/11/2026

- **Messaggio AdMob pubblicato e acceso:** «DEMOS – Consenso pubblicitario UE», come mostrato nello screenshot del 02/11/2026. Il precedente errore UMP `no form(s) configured` (codice 3) si riferiva alla fase in cui il messaggio era ancora in bozza ed è stato risolto pubblicandolo.
- **Ambiente rigorosamente locale e temporaneo:** worktree separata `D:\DEMOS_AppOpen_QA_20261102`, emulatore dedicato `Demos_UMP_QA_API35` (seriale `emulator-5562`), APK `community.demos.qaopen` che non sostituisce l'app originale. La copia usa App ID DEMOS solo per leggere la configurazione reale UMP, **unità annunci TEST di Google** e geografia SEE simulata, senza creare staging o risorse permanenti su Render/Supabase. È rispettata la direttiva **staging unico**, PR #565 e Checklist Master `OPS-STG-001`: non utilizzare `demos-staging` fino al completamento del bootstrap; non toccare i vecchi staging.
- **Prove Android effettive:** il messaggio UMP compare con «Consent», «Do not consent», «Manage options». Il rifiuto lascia `canRequestAds=true` e `ConsentStatus.OBTAINED` anche quando i bit TCF per finalità e fornitori sono **tutti a zero**; è stata quindi integrata la policy `AppOpenTcfConsentPolicy` che richiede consenso esplicito alla finalità 1 e al fornitore Google (GVL 755), altrimenti **non inizializza l'SDK, non carica e non mostra annunci**. Il consenso positivo rende `explicitTcf=true` e consente l'inizializzazione **solo TEST**.
- **Revoca:** corretto il mancato refresh della voce «Privacy pubblicitaria» tra UMP e React; corretto il crash all'apertura della finestra UMP da thread secondario Capacitor. Il pulsante compare e apre correttamente le preferenze; dopo «Nega», i consensi verificati tornano a zero senza crash. È stata provata anche la **persistenza dopo il riavvio completo** del solo pacchetto QA: `updated status=3 canRequestAds=true explicitTcf=false privacyOptions=REQUIRED`, `form-complete ... explicitTcf=false`; 11 bit delle finalità e 1549 bit di consenso vendor rimangono a zero, nessun log `sdk-initialize-approved` nel riavvio.
- **Test:** 21/21 test Node di contratto e policy superati nell'ultima prova; compilazione Android debug + test Java e verifica variante release eseguiti con successo. La release rimane priva delle dipendenze UMP/AdMob. Dopo alcuni cambiamenti documentali il controllo complessivo GitHub resta da rivalidare, poiché il test browser «Opinioni» di un workflow è andato in timeout dopo 120 secondi; è stato richiesto un rerun del solo job.
- **Rischi da chiudere:** il messaggio UMP mostra fino a **210 partner** e menziona localizzazione precisa; è necessaria revisione DPO e confronto con minimizzazione, senza presumere trasferimenti effettivi a tutti i partner. Un'app aperta con caricamento normale può non ricevere annunci, perché la finestra UI è breve. L'impression TEST con caricamento sintetico e il blocco immediato a 6h sono verificati; restano QA su dispositivo fisico, offline, accessibilità, scadenza reale di sei ore, target Play/minori e approvazione AdMob. **NO-GO release pubblicitaria**.

## Frequenza App Open aggiornata: 6 ore — 02/11/2026
- Scelta esplicita del titolare: sostituire **24 ore** con **6 ore minime tra due impression App Open realmente mostrate**, non tra due aperture o richieste/caricamenti. Non significa pubblicità obbligatoria a ogni apertura.
- Regola unica sia in Java nativo (`AppOpenFrequencyPolicy.MIN_INTERVAL_MS = 6L * 60L * 60L * 1000L`) sia in TypeScript (`MIN_APP_OPEN_INTERVAL_MS = 6 * 60 * 60 * 1000`). Il timestamp resta registrato soltanto da `onAdShowedFullScreenContent` e persiste per dispositivo.
- **Invariati**: no annunci ai primi due avvii (primo consentito dal terzo), consenso UMP e gate TCF esplicito, sola schermata realmente in caricamento, nessun annuncio su voti/opinioni sensibili, nessuna attesa artificiale, controllo foreground, app release senza SDK ads.
- Test Java JUnit: 5 ore ancora bloccato, a 6 ore consentito; controllo rifiuto, orologio arretrato, timestamp corrotti e overflow. Test Node di contratto nativo e policy TypeScript aggiornati. È stata osservata una **impression Google TEST** in caricamento sintetico solo sull'emulatore e il blocco di nuove richieste prima delle 6h; JUnit verifica il confine delle 6h. Restano test su caricamento naturale e durata reale; non dichiarare conclusa la QA UX.
- Cambio in sola PR #558 **DRAFT**, senza deploy, AAB o modifica a staging. Direttiva OPS-STG-001 rispettata.

## QA offline e utente anonimo — 02/11/2026

- **Offline fail-closed verificato su emulatore API 35 dedicato.** Solo pacchetto `community.demos.qaopen` resettato, Wi-Fi e dati temporaneamente disattivati, quindi avvio Android con App ID DEMOS limitato alla QA. UMP ha riportato `update-failed-code=2`; l'app è rimasta attiva e non sono presenti eventi `sdk-initialize-approved` o richieste `app-open-test-request-started`. Connessioni Wi-Fi/dati originali entrambe riabilitate e verificate in coda alla prova. Nessuna rete/servizio backend modificato.
- **Anonimo/minore/età sconosciuta (default deny) su build realmente compilata:** `-PdemosDebugQaForceAdult=false`, EEA debug e App ID DEMOS. Dopo reinstallazione e reset del SOLO pacchetto QA, l'app funziona senza `DemosAdsQA`, senza raccolta di preferenze UMP/TCF e senza inizializzazione SDK Ads. Il campo nativo `DEMOS_QA_FORCE_ADULT` verificato `false`. Il caso età non disponibile è stato osservato; i confini 17/18/19 anni sono inoltre verificati da test Node del server. Non sono stati usati account di test reali.
- **Staging e privacy:** usata solo AVD temporanea locale `DEMOS_APP_OPEN_QA_API35` sul seriale `emulator-5562`, distinta dall'emulatore originale `emulator-5560`; non usare `demos-staging` in bootstrap, non alterare vecchi staging. App ID DEMOS solo per leggere CMP durante QA, ad unit sempre TEST Google. Nessun annuncio reale, nessun rilascio.
- **Residui non surrogabili con test locali:** dispositivo Android fisico, usabilità/accessibilità e localizzazione del messaggio, scelta DPO sui 210 partner e l'eventuale geolocalizzazione, Play Console Data Safety/dichiarazione Ads/target minori, visibilità nello store pubblico, scansione `app-ads.txt`, verifica e approvazione AdMob. Una impression sintetica su emulatore non equivale a monetizzazione effettiva durante una normale apertura. La PR deve restare in **DRAFT** fino a una decisione esplicita di rilascio dopo i gate.
 
## QA App Open TEST e protezione minori — 02/11/2026 (ultimo aggiornamento)

- **Età (default deny):** `api/utils/adsAdultEligibility.js` calcola dall'anno già presente nella query autenticata `/auth/me` un unico booleano `ads_adult_eligible` (senza nuove letture DB). I minorenni, i profili non verificati e gli utenti che potrebbero avere ancora 17 anni in base all'anno dichiarato sono esclusi. La bridge nativa riceve **solo un booleano**, non data di nascita, identità o opinioni. Logout e sessioni non verificate chiudono la porta; UMP e SDK ads non partono prima del via libera. QA con `demosDebugQaForceAdult=true` ammessa **solo** per emulatore debug EEA; release `false` incondizionato, nessuna libreria Ads.
- **Test ripetibili:** 22 test Node policy/contratti, quattro test Node sui confini d'età; Gradle `assembleDebug`, JUnit debug/release e compilazione release completati. Staging unico `demos-staging` (PR #565, `OPS-STG-001`) **non usato**. Nessuna modifica a backend, produzione o Google Play.
- **Preload consentito, display vincolato:** dopo UMP effettivo e TCF Purpose 1 + Google vendor 755, SDK debug carica al massimo una creatività TEST in cache (retry limitato 15 minuti), e può visualizzarla soltanto se React è **effettivamente vuoto** nel momento di show. Nessun ritardo artificiale nell'app per forzare impression.
- **Prova visiva API 35:** unità Google TEST `ca-app-pub-3940256099942544/9257395921`, App ID DEMOS solo per UMP QA, pacchetto `community.demos.qaopen`; con utente sintetico adulto EEA e consenso confermato, log `app-open-test-request-started` 19:01:47, `app-open-test-loaded` 19:01:50, `app-open-test-shown` 19:03:04 e `app-open-test-impression` 19:03:04. Screenshot dell'annuncio campione Google Ads verificato. **La root React è stata svuotata manualmente nel WebView SOLO per simulare una schermata in caricamento nel QA isolato**; questo non prova un'impression reale in un caricamento naturale dell'app.
- **Cap:** `SharedPreferences` ha registrato `last_ad_shown_wall_clock_ms=1793646184036` nel callback show; riportando l'Activity in foreground prima di sei ore sono rimasti **1 request, 1 show, 1 impression**: nessuna ulteriore richiesta o reset del timestamp. JUnit conferma 5h ancora bloccato, 6h eleggibile. Non è stata osservata un'attesa di sei ore con orologio reale.
- **Gate ancora aperti:** revisione DPO delle informative CMP (fino a 210 partner, testo geolocalizzazione), accurate dichiarazioni Google Play Data Safety/Ads/target d'età, QA su telefono Android, test offline/accessibilità e utilizzo naturale, AdMob review e collegamento store/app-ads.txt dopo che l'app sarà pubblica. La PR #558 resta **DRAFT**, release Android senza SDK pubblicitari, nessun AAB rilasciato. Qualsiasi abilitazione reale deve avvenire con una PR/release **separata, esplicitamente autorizzata**.

## Gate ancora aperti prima di attivare pubblicità nelle release
1. **PARZIALE / ID ACQUISITI:** account AdMob attivo e ID dell'app e della unità App Open verificati nella console (vedi ADS-08). **Richiede revisione**: collegamento idoneo allo store e approvazione dell'app ancora aperti; verificare la corrispondenza con il package Android `community.demos`. Non usare ID di produzione per gli annunci di prova.
2. Verificare se AdMob fornisce le unità per l'app in test chiuso. In sviluppo usare esclusivamente gli ID di test Google, senza mai generare impression reali di prova.
3. **DEBUG QA CONVALIDATA:** Next-Gen e UMP solo DEBUG; compilazioni debug/release e test Java riusciti. Consenso, rifiuto, revoca, riavvio, precaricamento, callback mostra/impression di annuncio TEST verificati su emulatore. Prima del rilascio restano DPO, idoneità Google Play/AdMob e QA fisica.
4. **DEBUG UMP CONVALIDATA SU EMULATORE:** messaggio UE pubblicato in AdMob, osservato su emulatore. Test reali «Acconsenti», «Nega» e «Revoca» superati. Poiché UMP `OBTAINED`/`canRequestAds()` possono restare veri dopo il rifiuto, è obbligatorio il gate TCF esplicito (Purpose 1 + Google vendor 755) prima delle richieste. Verificata persistenza del rifiuto dopo riavvio. Restano minori, privacy, dispositivi fisici e release: **NO-GO**.
5. **DEBUG QA SUPERATA, DEVICE REALE APERTO:** entry point «Privacy pubblicitaria» visibile dopo refresh UMP; apertura della finestra privacy UMP sul thread principale Android e revoca completata senza crash su emulatore. Manca prova su dispositivo fisico, accessibilità e gestioni errori/offline.
6. **CONFIGURAZIONE COMPLETATA, QA CREATIVITÀ FUTURA APERTA:** nello screenshot di AdMob DEMOS del 02/11/2026 «Politica → Bloccato»; le altre dieci categorie standard risultano consentite e le due categorie soggette a limitazioni risultano bloccate. Non modificare i blocchi senza una valutazione specifica. Quando ci saranno annunci reali, il Centro revisione annunci e i blocchi per URL saranno necessari per eventuali classificazioni errate.
7. **QA EMULATORE TEST SUPERATA; UX NATURALE DA VALIDARE:** precaricamento dopo UMP/TCF e idoneità adulta; la root React viene verificata immediatamente prima del display. Visualizzazione e impression sono state ottenute solo con root volutamente svuotata nel WebView di prova, non alterando l'app reale. Nessun timer artificiale.
8. **CAP SEI ORE / EMULATORE PARZIALE OK:** tre avvii necessari, una impression reale di TEST e timestamp scritto nel callback `onAdShowedFullScreenContent`; dopo un ritorno in foreground il conteggio è rimasto una sola impression/una richiesta. JUnit verifica prima delle 6h bloccato e 6h consentito, rollback e preferenze corrotte. Non osservata un'attesa di sei ore reali.
9. **DEBUG IMPLEMENTATO:** ignorare e distruggere `AppOpenAd` caricati da oltre **quattro ore** e saltare se la pagina è già caricata; test dispositivi ancora necessari.
10. Se manca qualsiasi gate, il contenuto parte normalmente, senza pubblicità.
11. **FILE PUBBLICATO E VERIFICATO VIA HTTP:** PR #563 `app-ads.txt` integrata in `main`, frontend Render `demos-frontend` `live` al commit `ac9d79b` (02/11/2026). `https://demos.community/app-ads.txt` redirige verso `www`, restituisce `200 OK`, `text/plain` e la riga Google attesa. **CRAWLER/STORE ADMOB ANCORA APERTI:** app DEMOS attualmente in test chiuso non trovata nella ricerca AdMob dello store con `community.demos`; in AdMob appare «Richiede revisione» e «Pubblicazione annunci limitata». Non spacciare la verifica HTTP per approvazione AdMob.
12. **PARZIALE:** assenso preparatorio DPO comunicato; Privacy/Cookie integrate tramite PR #564 e distribuite su Render al commit `ac9d79b`, URL pubblici HTTP 200. Prima di un rilascio con annunci restano controllo visivo testi, revisione del Registro trattamenti sulle operazioni effettive, Google Play Data Safety e dichiarazione Ads, test reali (primo avvio, rifiuto/revoca UMP, offline, rotazione, background/foreground, voto, accessibilità e fallimenti rete).

## Situazione osservata
- Su `main`, `client/android/app/build.gradle` non integra AdMob/UMP.
- `client/android/app/src/main/AndroidManifest.xml` non riporta un AdMob application ID.
- `client/index.html` riferisce Cookiebot rimosso per fine prova; l'App Open richiede gestione nativa della privacy, non l'ex sistema web.
- Il sito contiene `client/public/ads.txt`, ma non sostituisce `app-ads.txt`.
- Il progetto sta distribuendo versioni Android in test: non inserire nuova pubblicità nella release già avviata senza approvazione e QA.

## QA locale
```bash
cd client
node --test tests/advertisingPolicy.test.mjs tests/appOpenNativeContract.test.mjs
```

Il CI compila i sorgenti Java sia in debug sia in release, ora esegue anche test JUnit nativi nelle due varianti e verifica che **`releaseRuntimeClasspath` non contenga AdMob Next-Gen né UMP**. Questo non sostituisce i test di visualizzazione su Android né la verifica della revoca del consenso.
Nel test limitato agli annunci Google di prova, la verifica UMP non garantisce che una richiesta sia effettivamente consentita senza configurare Privacy & Messaging in un account AdMob reale.

## Documentazione
- https://developers.google.com/admob/android/next-gen/app-open
- https://developers.google.com/admob/android/next-gen/quick-start
- https://developers.google.com/admob/android/next-gen/privacy
- https://developers.google.com/admob/android/next-gen/targeting
- https://developers.google.com/admob/android/test-ads
- https://support.google.com/admob/answer/9363762

Piano: Google Sheet `DEMOS – Strategia – Scalabilità e Finanziamento`, tab `ADS – MONETIZZAZIONE`. PR: https://github.com/Nictolas/DemosApp/pull/558

**Solo prototipo nativo DEBUG.** DPO: assenso preliminare comunicato. L'App ID DEMOS è stato usato esclusivamente per la diagnostica UMP su APK debug isolato; l'unità annunci è sempre di prova e nessun ID reale è abilitato in release. Per il rilascio reale mancano approvazione AdMob/store, pubblicazione e test CMP/UMP, controllo dei minori, esclusioni politiche, Play Console, distribuzione/verifica app-ads.txt e prove end-to-end su dispositivi.

## Hardening UMP tra sessioni adulte — 02/11/2026

- Nel prototipo **DEBUG**, il passaggio adulto → logout/account non idoneo → nuova sessione adulta invalida l'autorizzazione pubblicitaria precedente, scarta annunci precaricati e richiede nuovamente `requestConsentInfoUpdate` prima di qualsiasi nuova richiesta. La preferenza UMP sul dispositivo non è cancellata e non si afferma che equivalga a un consenso verificato per un diverso account.
- Una risposta UMP o un callback del modulo privacy appartenente alla sessione precedente non può riabilitare gli annunci grazie al confronto della generazione; gli errori restano fail-closed anche se SDK già inizializzato in una sessione precedente.
- Test di contratto estesi a nuova sessione, errori e callback tardivi. **Questa è una protezione del codice, non la prova manuale di cambio account su dispositivo reale.** Rimangono aperti QA fisica, Play Data Safety e revisione AdMob; nessun SDK pubblicitario in release.

- La voce **Privacy pubblicitaria** rimane raggiungibile da schermata iniziale/login anche dopo logout, per consentire la revoca a chi abbia già espresso una scelta. Aprire volontariamente le opzioni UMP da anonimo non avvia SDK Ads o richieste pubblicitarie; un callback di modifica non crea eleggibilità adulta. Il test fisico di questo flusso resta aperto.


## QA DOM Chrome headless — 02/11/2026

- Verifica da Windows autorizzato **esclusivamente con Google Chrome** (percorso installato sotto Program Files (x86)), profilo isolato temporaneo su disco D:, eliminato dopo il test. Nessun Edge, nessun accesso ai dati utenti, nessun deploy e nessuna modifica a Render/Supabase.
- `https://www.demos.community/privacy-policy`: DOM React renderizzato e ispezionato tramite `--headless=new --dump-dom`; 39.599 caratteri, presenti i riferimenti testuali **DEMOS**, **Android**, **Google AdMob** e **Google UMP**.
- `https://www.demos.community/cookie-policy`: DOM React renderizzato e ispezionato analogamente; 11.919 caratteri, presenti gli stessi riferimenti.
- **Conclusione limitata:** disponibilità del contenuto informativo Android sul sito verificata anche *dopo* rendering del DOM, non soltanto HTTP 200 o esistenza dei sorgenti. Non costituisce audit legale, verifica visuale con screenshot, accessibilità, audit rete/cookie o collaudo su dispositivo fisico. La revisione DPO e la conformità Google Play rimangono aperte.

## Allineamento registro ADS-12: richiesta vs visualizzazione

- Il manager DEBUG **può precaricare** una creatività Google di TEST dopo verifica adulta, UMP e consenso TCF anche con UI React già popolata (retry non prima di 15 minuti). NON è corretto dichiarare che la root vuota sia richiesta **prima di `AppOpenAd.load()`** nell'implementazione corrente.
- La root React vuota viene invece verificata **prima di mostrare** (`ad.show()`) e rivalutata nell'azione asincrona. Nessun ritardo artificiale di caricamento. Una richiesta di preload non equivale a impression; non va dichiarato che nessuna richiesta avvenga mentre l'app è utilizzabile.
- La roadmap ADS-12 è stata rettificata per riflettere questi fatti. Test fisico di contesto, performance e UX naturale non ancora svolto.

## Sette gruppi di gate prima degli annunci reali (aperti)

1. Collaudo Android fisico: consenso/rifiuto/revoca, account adulto/minore/anonimo, cambio account, offline e accessibilità.
2. App Open in flussi naturali: cold start, foreground, no overlay su contenuto disponibile/voto, cap di 6 ore dopo impression effettiva.
3. Revisione finale DPO: CMP e partner AdMob, trattamento dati tecnici/possibile localizzazione, revoca, Registro trattamenti e basi giuridiche.
4. Google Play Console: dichiarazioni Ads/Data Safety, pubblico destinatario/età, eventuali autorizzazioni e coerenza con SDK effettivamente rilasciati.
5. Collegamento DEMOS al Play Store pubblico e approvazione/review app da parte di AdMob (attualmente test chiuso e "Richiede revisione").
6. Conferma scansione e verifica `app-ads.txt` nel pannello AdMob (file pubblico HTTP OK, crawler non ancora verificato).
7. Nuova PR separata e verificata per variante release con ID di produzione, CI, test finali e autorizzazione esplicita al rilascio.

**NO-GO:** i sette punti non possono essere dichiarati chiusi dai workflow GitHub. Non utilizzare `demos-staging` finché rimane in bootstrap; non creare altri staging permanenti.
