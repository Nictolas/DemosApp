# DEMOS — Anteprima annunci web/PWA (solo QA, 9 novembre 2026)

## Cosa è stato realizzato
- Nel ramo QA cumulativo #638, **Impostazioni → Anteprima pubblicità web** è disponibile solo in web/PWA tramite `WebAdvertisingPreview`. Il pulsante «Visualizza annuncio dimostrativo» apre una simulazione grafica di banner.
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
