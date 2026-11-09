# DEMOS — Anteprima annunci web/PWA (solo QA, 9 novembre 2026)

## Cosa è stato realizzato
- Nel ramo QA cumulativo #638, **Impostazioni → Anteprima pubblicità web** è disponibile solo in web/PWA tramite `WebAdvertisingPreview`. Il pulsante «Visualizza annuncio dimostrativo» apre una simulazione grafica diversa a seconda del contesto: schermata intera nella PWA installata (iOS/Android), banner su desktop e banner compatto nel browser mobile.
- La schermata è un **mock first-party**: non è un annuncio Google, non chiama AdSense, AdMob o un inserzionista, non salva cookies/localStorage, non registra impression, non monetizza. Non si apre automaticamente né compare nel flusso firme/opinioni/voto.
- Nel pacchetto Capacitor nativo Android il componente è nascosto tramite `Capacitor.isNativePlatform()`; gli App Open nativi rimangono separati e soggetti a UMP, maggiore età, cooldown di 6 ore e schermata di caricamento effettiva.
- Funziona nel browser mobile e nella web app installata con «Aggiungi a schermata Home», **dopo un eventuale deploy del frontend web revisionato**. Un upload Android AAB **non distribuisce** nuove modifiche web a iPhone.

## Quali annunci aspettarsi

| Ambiente | Stato e risultato |
| --- | --- |
| Android AAB QA sintetica #638 | La CI compila GMA/UMP + unità App Open Google SAMPLE, ma con Firebase dummy e senza firma Play: **non installabile come AAB reale**. |
| Android Android test/closed track reale | Serve AAB completa firmata con Firebase autentico e unità **del proprietario** in modalità TEST di AdMob/Play, non Google SAMPLE in un upload Play. Test su dispositivo e consenso effettivo; un App Open può essere saltato se la schermata è già pronta. |
| Web/PWA iPhone su sito attualmente pubblico | Non integra AdSense. Non si vedono annunci Google solo perché Android ha AdMob. |
| Web/PWA QA con questa modifica, dopo deploy revisionato | Da Impostazioni l'utente può aprire **solo** l'anteprima grafica, non un annuncio Google. Nessun ricavo o traffico pubblicitario. |

## Per attivare veri annunci web in futuro
- Scegliere formalmente annunci web oltre agli App Open Android; collegare e far esaminare il dominio web in AdSense, con identificativi dello stesso proprietario e nessuna modalità «test AdSense» inventata.
- Implementare l'integrazione web **solo dietro esplicito consenso e controlli ePrivacy/GDPR**, CMP idonea, informative aggiornate, verifica blocco quando consenso assente/rifiutato, niente uso delle opinioni civiche o di segmenti politici.
- Verificare compatibilità di AdSense con Safari/PWA su dispositivo iPhone reale, disponibilità dell'inventario e policy Google. La presenza del tag non garantisce visualizzazione.
- Mantenere distinta la monetizzazione e relativa posizione fiscale dall'anteprima QA.

## Test da eseguire
1. Web/iPhone Safari e PWA dopo distribuzione del frontend QA: login, Impostazioni, pulsante preview; controllare che testo «PUBBLICITÀ DIMOSTRATIVA» sia visibile, finestra accessibile e chiudibile; nessun altro annuncio.
2. Verificare zero richieste a Google, zero cookies pubblicitari e zero accesso a dati/account/voti dalla preview.
3. Android nativo: la voce web non deve apparire; App Open Google TEST va provato separatamente secondo documentazione AdMob, con account adulto e consenso UMP.
4. Verificare che il frontend web live non cambi prima di GO distinto; la sola PR QA non modifica www.demos.community.

## Vincoli
Nessun merge in main, nessun deploy web/Android, nessuna firma Play/AdMob reale, nessuna attivazione commerciale o modifica ai dati e ai provider in questa preparazione. Lo stato della CI va verificato sul commit esatto dell'ultima modifica.


## Decisione UX mobile/desktop aggiornata — 09/11/2026

**Richiesta dell'utente**: la web app aggiunta alla schermata Home su smartphone deve avere un'esperienza simile a un App Open; desktop deve utilizzare banner. Non confondere UX equivalente con la stessa rete pubblicitaria.

**Anteprima di sola QA implementata**:
- `WebAdvertisingPreview.tsx` controlla prima `Capacitor.isNativePlatform()` (su Android nativo è invisibile). Se il browser è standalone tramite `(display-mode: standalone)` oppure `navigator.standalone === true` (iOS Safari), un clic manuale apre la demo **a schermo intero**, con chiusura accessibile.
- Browser desktop (`min-width: 900px`) mostra una demo banner; browser mobile non installato mostra banner compatto.
- È SEMPRE una demo first-party, mostrata solo su clic in Impostazioni. La grafica non è inserzione AdSense né impression pubblicitaria. Non apre automaticamente al lancio, non legge preferenze politiche, non contatta reti o conserva stato. Non sono attivi banner o fullscreen reali sul sito.
- La UI distingue esplicitamente «PWA a schermo intero», «banner desktop» e «banner browser mobile» e cita l'assenza di garanzia di un annuncio al lancio.

**Future reti pubblicitarie reali**:
1. Android distribuito su Play: App Open con AdMob, condizioni di consenso/età e loading screen reale; solo con propria unità attiva in test mode e firma/Firebase reali durante QA.
2. PWA installata: AdSense **vignette** è il formato fullscreen web più vicino, ma Google decide i trigger (in genere click/navigazione, opzionalmente ritorno da scheda in background) e il frequency cap. **Non è un App Open nativo e non garantisce impression all'apertura della PWA**. Non simulare a mano un annuncio in vero contenitore fullscreen AdSense, non creare ritardi artificiali e non modificare codice terzo.
3. Desktop browser: banner in-content e/o laterali, senza vignette, dove previsto dalle configurazioni AdSense e consentito; su browser mobile normale eventualmente banner non invasivo. Attenzione: Google AdSense Auto ads è tipicamente configurato per il sito e può non supportare selezione granularizzata per sola modalità PWA: verificare capacità effettiva e comportamento di Safari/SPA prima di promettere un'esclusione completa di un formato per dispositivo.
4. Privacy: CMP Google-certified idonea a SEE/UK/CH quando richiesta, revoca/rifiuto funzionanti, no annunci/SDK prima del gate applicabile, informative aggiornate prima dell'attivazione, esclusione prudenziale di pagine con firme/voti/moduli e dati sensibili, verifica su smartphone.
5. Per AdSense le frequenze vignette configurabili ufficialmente sono da 1 minuto a 1 ora: **non promettere lo stesso cap Android di 6 ore** senza un meccanismo compatibile col provider e confermato dai test. Un utente può inoltre non vedere annunci per mancanza di disponibilità o per scelte di consenso.

Documentazione Google verificata il 09/11/2026:
- https://support.google.com/adsense/answer/16531962?hl=it (trigger vignette e apertura pagina)
- https://support.google.com/adsense/answer/9305577?hl=it (formati auto e desktop)
- https://support.google.com/adsense/answer/13956167?hl=en (frequency cap supportato)
- https://support.google.com/adsense/answer/1346295?hl=en (ads only on web / WebView approvate)
- https://support.google.com/adsense/answer/16853623?hl=en (trigger aggiuntivi)

**Stato rilascio**: QA branch soltanto, nessun deploy né cambio Google AdSense; codice soggetto a CI e prova visiva su iPhone standalone/desktop prima del GO.


## Fondazione AdSense manuale fail-closed — 09/11/2026

**Nuovo codice già integrato solo nella branch QA:**
- `client/src/lib/web-advertising-policy.ts` classifica browser desktop, browser mobile, PWA standalone (anche iOS `navigator.standalone`), Android nativo. Unità reale bannner solo nella rotta pubblica `/scopri-demos`; esclusi /auth, profilo, votazioni, firme, opinioni, moduli ecc. La PWA è esplicitamente separata: vignettes solo come futura possibilità da verificare, **nessun Auto ads Google iniettato**.
- `client/src/components/WebAdSenseBanner.tsx` inserito nella pagina informativa `ScopriDemos.tsx`. Il componente contiene la predisposizione per una **unità manuale AdSense** con `data-ad-client`, `data-ad-slot`, script asincrono ufficiale e `requestNonPersonalizedAds = 1` eseguito **prima** del caricamento dello script e della richiesta. Tuttavia **non può caricare lo script né generare richieste** con la configurazione corrente. Solo dopo TUTTI i gate e una fonte CMP verificata si potrà attivare.
- Test automatici `client/tests/webAdvertisingPolicy.test.mjs` e workflow `.github/workflows/advertising-policy-validation.yml`: test negativo per ogni gate, ID, path, Android, PWA installata, abilitazione default, eventuale banner con condizioni valide, NPA=1, assenza script nel `index.html`.
- Google account Auto ads deve restare **OFF** per questa fase di banner manuali: lo script di pagina potrebbe altrimenti innescare formati overlay su altre pagine della SPA. Ciò non è certificabile dal solo codice e **va verificato nel pannello AdSense prima dell'attivazione**. Il flag nel frontend non sostituisce la verifica effettiva nel provider.

**Gate espliciti (TUTTI necessari per banner veri):**
1. `VITE_DEMOS_WEB_ADS_ENABLED=true` (default non impostato => OFF).
2. `VITE_DEMOS_ADSENSE_SITE_APPROVED=true` dopo effettiva review dominio da AdSense.
3. `VITE_DEMOS_WEB_ADS_CMP_CERTIFIED=true` solo dopo installazione e test reali di una CMP web certificata e TCF.
4. `VITE_DEMOS_WEB_ADS_NONPERSONALIZED_ONLY=true`, verifica con DevTools request `npa=1` e politiche/consenso.
5. `VITE_DEMOS_WEB_ADS_AUTO_ADS_DISABLED=true` **solo** dopo verifica che gli Auto ads siano disattivati in AdSense, così lo script non produce vignette fuori rotta.
6. `VITE_DEMOS_ADSENSE_CLIENT_ID=ca-pub-<16 cifre>` e `VITE_DEMOS_ADSENSE_BANNER_SLOT=<10 cifre>` ricavati dall'account proprietario approvato (non inventati).
7. Bridge live `window.__demosWebAdsConsentBridge.canServeNonPersonalizedAds()` implementato dalla CMP verificata, che deve fornire una decisione aggiornata e inviare `demos:web-ad-consent-changed` su cambiamenti. **Questo bridge NON è ancora presente**, quindi gli annunci restano OFF anche forzando i flag in build.

La revoca, quando un banner è stato caricato nella pagina, comporta un reload dell'intero documento per non mantenere uno script pubblicitario attivo. In QA bisogna verificare il comportamento dei form reali, pagina informativa e preferenze persistite CMP, oltre alla corretta gestione su navigazione SPA.

**Sulla PWA installata** non si attiva lo script AdSense Auto ads: senza una separazione documentale sicura è impossibile garantire che vignette caricate in una SPA non appaiano poi su pagine politicamente sensibili. La richiesta «schermata intera come App Open» rimane come obiettivo di interfaccia, NON una feature pubblicitaria implementata. Non caricare annunci inventati o interstitial manuali non conformi alle policy.

**Avvertenze fondamentali:**
- L'unità pubblicitaria web richiede *un account e un sito AdSense approvati*, non gli identificativi AdMob di Google Play e non la sola presenza di `ads.txt`.
- Le pubblicità AdSense non personalizzate possono comunque utilizzare cookie tecnici e trattare dati del dispositivo; non dichiarare zero-tracking senza esame effettivo.
- Prima dell'attivazione live: update informative Privacy/Cookie, verifica contratti/registro GDPR e CMP, consenso/rifiuto/revoca, review DPO e compatibilità iOS PWA, layout pubblicitario e percorsi sensibili.
- Nessun merge, deploy, ID commerciale usato, script Google richiesto, evento o dispositivo tester effettivamente provato da questa modifica.

**Riferimenti Google ufficiali:**
- AdSense manual ad units e codice: https://support.google.com/adsense/answer/9274019
- NPA=1 e richieste differite: https://support.google.com/adsense/answer/7670312
- CMP certificata e IAB TCF: https://support.google.com/adsense/answer/13554116
- Auto ads e esclusione pagine: https://support.google.com/adsense/answer/9262311
- Vignette trigger e frequency cap: https://support.google.com/adsense/answer/16531962

