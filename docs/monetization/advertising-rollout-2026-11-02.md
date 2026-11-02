# DEMOS — App Open Ad Android: rollout controllato

Data: 2026-11-02. **Ambito prioritario esclusivo: App Open Ad Android.**
Stato: preparazione tecnica in PR draft #558; **annunci non attivi**.

## Decisione di prodotto
- Solo annunci **commerciali non personalizzati**.
- Finestra mobile di **almeno 24 ore** tra due annunci effettivamente mostrati, non tra richieste/caricamenti.
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
- `client/android/app/src/debug/AndroidManifest.xml`: App ID di **test ufficiale** Google esclusivamente in debug.
- `client/android/app/src/debug/java/community/demos/DemosAppOpenAdsManager.java`: aggiornamento UMP, richiesta del modulo necessario, verifica del consenso e di `canRequestAds()` prima dell'inizializzazione; personalizzazione disabilitata mediante Publisher Privacy Treatment; callback App Open Next-Gen; controllo della schermata realmente vuota prima di mostrare, nessuna attesa inserita artificialmente.
- `client/android/app/src/release/java/community/demos/DemosAppOpenAdsManager.java`: implementazione vuota senza SDK.
- `client/android/app/src/main/java/community/demos/NativeAppOpenPrivacyPlugin.java`: bridge Capacitor con sola API per sapere se UMP richiede il pulsante e presentare il modulo delle preferenze. Nessun dato del profilo passa dal bridge.
- `client/src/lib/native-app-open-privacy.ts` + `client/src/pages/Impostazioni/components/AppOpenPrivacyOptions.tsx`: opzioni UMP accessibili quando richieste nelle **Impostazioni** e, per chi non è autenticato, dal footer della schermata iniziale e dalla pagina di autenticazione. Su web e nella variante Android release il pulsante è assente.
- Il gestore Android svuota il precaricamento prima di aprire le opzioni UMP e ricontrolla le preferenze alla chiusura; non è possibile aprire il modulo durante un annuncio a schermo.
- `client/android/app/src/main/java/community/demos/MainActivity.java`: wiring al gestore nativo solo dietro flag; il WebViewClient Capacitor non viene sostituito.
- `client/android/app/src/main/java/community/demos/AppOpenFrequencyPolicy.java`: regole condivise e pure per almeno 3 avvii, frequenza mobile di 24 ore, orologio arretrato e valori corrotti (nessuna dipendenza pubblicitaria).
- `client/android/app/src/test/java/community/demos/AppOpenFrequencyPolicyTest.java`: test JUnit eseguiti nelle varianti debug e release.
- `client/src/lib/advertising-policy.ts`: specifica fail-closed a livello web/TS; **non** è collegata direttamente all'SDK Android e non va dichiarata automaticamente applicata ai client nativi.
- `client/tests/advertisingPolicy.test.mjs` e `client/tests/appOpenNativeContract.test.mjs`: test TypeScript/contratto; CI compila e testa con JUnit sia debug sia release.
- Prima di **richiedere** un annuncio al network, il WebView verifica che la root React sia ancora vuota; la stessa condizione è ricontrollata prima di mostrare l'annuncio. Una pagina già pronta non genera alcuna richiesta AdMob.
- L'inserimento di un annuncio resta **molto improbabile** durante un cold start: DEMOS non introduce una schermata di caricamento artificiale, e su un warm resume la pagina di norma è già pronta. **Questo prototipo non va considerato una soluzione commercialmente attiva o idonea a produrre impression** senza ulteriore revisione UX e QA.
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
- `app-ads.txt`: usare solo la riga autorizzata ottenuta dall'account AdMob, verificarla sul dominio sviluppatore indicato nello store, non generarla per supposizione.

Fonti ufficiali:
- https://support.google.com/admob/answer/10564477
- https://support.google.com/admob/answer/10114014
- https://support.google.com/admob/answer/10113106
- https://support.google.com/admob/answer/12226986

## Gate ancora aperti prima di attivare pubblicità nelle release
1. **PARZIALE / ID ACQUISITI:** account AdMob attivo e ID dell'app e della unità App Open verificati nella console (vedi ADS-08). **Richiede revisione**: collegamento idoneo allo store e approvazione dell'app ancora aperti; verificare la corrispondenza con il package Android `community.demos`. Non usare ID di produzione per gli annunci di prova.
2. Verificare se AdMob fornisce le unità per l'app in test chiuso. In sviluppo usare esclusivamente gli ID di test Google, senza mai generare impression reali di prova.
3. **PARZIALE:** Next-Gen e UMP integrati solo in DEBUG; prima compilazione Android debug/release riuscita il 02/11/2026, verifiche JUnit successive in corso. Decidere condizioni e ID produzione dopo audit.
4. **PARZIALE:** UMP nella sola variante DEBUG con fail-closed, `canRequestAds()` e stato `OBTAINED`; verificare la configurazione del messaggio dell'account AdMob e la gestione di revoca/rifiuto con test reali prima della variante release.
5. **DEBUG IMPLEMENTATO, DA TESTARE:** entry point per rivedere il consenso UMP quando `getPrivacyOptionsRequirementStatus() == REQUIRED`, anche prima del login. Verificare disponibilità, revoca e gestione degli errori su Android reale prima della release.
6. Configurare in AdMob esclusioni di categorie politiche e verificare la reale efficacia dei blocchi. La non-personalizzazione e il consenso non garantiscono da soli privacy completa o assenza di identificatori.
7. **PARZIALE:** il gestore nativo verifica root React vuota PRIMA sia della richiesta al network, sia del display. Validare su un dispositivo che rappresenti sempre un caricamento reale, senza interruzioni. Nessun timer per trattenere gli utenti.
8. **DEBUG IMPLEMENTATO:** `SharedPreferences` non associata all'identità dell'utente, almeno tre avvii e 24 ore dall'ultimo `onAdShowedFullScreenContent`; nuovi test JUnit su limite, rollback e timestamp corrotti. QA dispositivo ancora aperto.
9. **DEBUG IMPLEMENTATO:** ignorare e distruggere `AppOpenAd` caricati da oltre **quattro ore** e saltare se la pagina è già caricata; test dispositivi ancora necessari.
10. Se manca qualsiasi gate, il contenuto parte normalmente, senza pubblicità.
11. Verificare `app-ads.txt` sul dominio sviluppatore associato allo Store, separato da `ads.txt` web; recuperare la riga **reale** da AdMob.
12. Prima del rilascio: aggiornare informativa privacy/cookie e registro dei trattamenti, Play Console Data Safety e dichiarazione Ads, controllo DPO, test reali (primo avvio, UMP rifiutato/revocato, offline, rotazione, background/foreground, voto, accessibilità e fallimenti rete).

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

**Solo prototipo nativo DEBUG.** Gli ID AdMob reali sono stati acquisiti ma non attivati. Per il rilascio reale mancano approvazione AdMob/store, configurazione CMP/UMP reale, controllo dei minori, esclusioni politiche, Play Console, app-ads.txt e prove end-to-end su dispositivi.
