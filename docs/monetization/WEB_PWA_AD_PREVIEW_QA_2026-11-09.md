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
