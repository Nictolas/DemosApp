# DEMOS — App Open Ad Android: rollout controllato

Data: 2026-11-02. **Ambito prioritario esclusivo: App Open Ad Android.**
Stato: preparazione tecnica in PR draft #558; **annunci non attivi**.

## Approvazione DPO comunicata
- **02/11/2026 — approvazione dichiarata dall'utente per conto del DPO**: configurazione di consenso e impostazione preliminare App Open Android, nonché preparazione dei testi Privacy/Cookie. Questa registrazione documenta la conferma ricevuta, non una verifica indipendente né un'autorizzazione a presumere superati controlli tecnici e di piattaforma.
- **Gate DPO: approvazione preparatoria ricevuta.** Restano separati: test end-to-end su Android, comportamento di UMP al rifiuto/revoca, configurazione minori, controlli delle categorie pubblicitarie, Play Console e revisione dell'app da parte di AdMob. Eventuali modifiche sostanziali ai trattamenti effettivi richiedono riesame della documentazione.
- **Non autorizzare automaticamente** un'unità pubblicitaria reale in una release, né modificare o pubblicare messaggi CMP sulla base della sola approvazione preliminare.


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
- **Protezione revoca in volo:** ogni apertura delle opzioni UMP incrementa una generazione di consenso locale; un App Open richiesto prima della modifica viene distrutto se la risposta asincrona arriva dopo l'inizio del cambio di consenso. Anche `Activity.onDestroy()` invalida i caricamenti pendenti. Il controllo è verificato dal test di contratto; la revoca end-to-end resta da provare su dispositivo.
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
- `client/public/app-ads.txt` **integrato in `main` via PR #563** con **la stessa riga Google esistente** in `client/public/ads.txt` (publisher ID già visibile nel progetto), secondo il formato ufficiale di Google. La CI controlla contenuto, unico venditore e presenza in `client/dist/app-ads.txt` dopo la build; **non è ancora distribuito sul sito live né verificato dal crawler AdMob**.
- Verificare nella console AdMob `App → Visualizza tutte le app → app-ads.txt → Come impostare` che lo snippet personalizzato corrisponda a questo file, quindi che il dominio dello sviluppatore nello Store sia quello desiderato. Solo dopo la pubblicazione sul sito e la scansione di AdMob si potrà chiudere il gate.
- `ads.txt` web e `app-ads.txt` Android sono file distinti, anche se in questo caso riportano lo stesso venditore Google; non implicano attivazione di banner o annunci sul sito.

Fonti ufficiali:
- https://support.google.com/admob/answer/10564477
- https://support.google.com/admob/answer/10114014
- https://support.google.com/admob/answer/10113106
- https://support.google.com/admob/answer/12226986

## Messaggio europeo AdMob e bozze legali (02/11/2026)
- In `Privacy e messaggi → Regolamenti europei → Messaggi`, l'account mostra il messaggio **`DEMOS – Consenso pubblicitario UE`**, associato a DEMOS Android, **stato: Bozza**. La levetta `Pubblica` è disattivata: **non affermare che il messaggio sia già pubblicato**.
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
- Dispositivo di prova: emulatore `Demos_QA_API35`, Android API 35, avviato con dati scrivibili separati su disco D:. Il dispositivo virtuale conteneva già `community.demos` con firma diversa: **non è stata disinstallata o sovrascritta**. Per testare in sicurezza è stato aggiunto **solo nella copia locale** `applicationIdSuffix '.qaopen'`, creando il pacchetto `community.demos.qaopen`.
- APK debug QA installato con successo. `MainActivity` avviata, processo attivo; `SharedPreferences` native `native_launch_count` inizialmente 1 e poi **3 dopo riavvii effettivi** (la scrittura `apply()` è asincrona, per cui si è attesa la persistenza prima di leggere il valore). Nessun crash `AndroidRuntime:E` rilevato durante la prova.
- Screenshot dell'emulatore: schermata di benvenuto DEMOS visibile con `Continua con Google`, link `Privacy pubblicitaria`, **nessun annuncio a schermo o overlay**. Questo è un controllo del caricamento della schermata, **non una prova di esposizione corretta dell'annuncio**.
- **NON TESTATI:** comparsa/accettazione/rifiuto del messaggio CMP, revoca e successiva soppressione della rete, primo annuncio di prova effettivamente mostrato, cadenza di 24 ore dopo impression, ritorno dal background, device reale, rete assente, accessibilità, traffico SDK e sicurezza minori. Il messaggio UE AdMob è tuttora in **BOZZA** e perciò non è possibile attribuire alla verifica un successo del flusso UMP completo.
- L'installazione/QA riguarda soltanto un pacchetto di debug distinto: **release Android ed annunci reali restano invariati**.

## Gate ancora aperti prima di attivare pubblicità nelle release
1. **PARZIALE / ID ACQUISITI:** account AdMob attivo e ID dell'app e della unità App Open verificati nella console (vedi ADS-08). **Richiede revisione**: collegamento idoneo allo store e approvazione dell'app ancora aperti; verificare la corrispondenza con il package Android `community.demos`. Non usare ID di produzione per gli annunci di prova.
2. Verificare se AdMob fornisce le unità per l'app in test chiuso. In sviluppo usare esclusivamente gli ID di test Google, senza mai generare impression reali di prova.
3. **PARZIALE:** Next-Gen e UMP integrati solo in DEBUG; prima compilazione Android debug/release riuscita il 02/11/2026, verifiche JUnit successive in corso. Decidere condizioni e ID produzione dopo audit.
4. **PARZIALE:** UMP nella sola variante DEBUG con fail-closed, `canRequestAds()` e stato `OBTAINED`; verificare la configurazione del messaggio dell'account AdMob e la gestione di revoca/rifiuto con test reali prima della variante release.
5. **DEBUG IMPLEMENTATO, DA TESTARE:** entry point per rivedere il consenso UMP quando `getPrivacyOptionsRequirementStatus() == REQUIRED`, anche prima del login. Verificare disponibilità, revoca e gestione degli errori su Android reale prima della release.
6. **CONFIGURAZIONE COMPLETATA, QA CREATIVITÀ FUTURA APERTA:** nello screenshot di AdMob DEMOS del 02/11/2026 «Politica → Bloccato»; le altre dieci categorie standard risultano consentite e le due categorie soggette a limitazioni risultano bloccate. Non modificare i blocchi senza una valutazione specifica. Quando ci saranno annunci reali, il Centro revisione annunci e i blocchi per URL saranno necessari per eventuali classificazioni errate.
7. **PARZIALE / EMULATORE OK PER LANDING:** il gestore verifica root React vuota prima di richiedere/mostrare l'annuncio. La landing si è caricata su Android API 35 senza overlay o crash. Da dimostrare con UMP realmente pubblicato che l'App Open venga richiesto e mostrato solo durante un caricamento non terminato. Nessun timer artificiale.
8. **PARZIALE / CONTATORE EMULATORE OK:** `SharedPreferences` non associata all'identità utente; tre avvii osservati su API 35. Restano da verificare con annuncio realmente mostrato il cap di 24 ore, rollback orologio e callback impression. Test JUnit sul limite, rollback e timestamp corrotti superati in CI.
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

**Solo prototipo nativo DEBUG.** DPO: assenso preliminare comunicato. Gli ID AdMob reali sono stati acquisiti ma non attivati. Per il rilascio reale mancano approvazione AdMob/store, pubblicazione e test CMP/UMP, controllo dei minori, esclusioni politiche, Play Console, distribuzione/verifica app-ads.txt e prove end-to-end su dispositivi.
