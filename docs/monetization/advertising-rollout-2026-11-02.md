# DEMOS — Pubblicità commerciali, fase 1

Data: 2026-11-02. Stato: **preparazione tecnica, NO-GO pubblicazione ads**.

## Decisioni confermate
- Android Capacitor: App Open Ad con massimo una visualizzazione per finestra mobile di 24 ore; mai al primo utilizzo. Non promettere una durata fissa di tre secondi: il formato e la chiusura sono gestiti dalla rete.
- Web demos.community: AdSense solo in slot manuali, inizialmente sulla pagina informativa pubblica /scopri-demos. Niente Auto Ads che si sovrappongono a sondaggi, firma, voto, profilo, autenticazione o pannelli amministrativi.
- Banner Android in basso: fase successiva, solo se non copre navbar, pulsanti fissi, safe area e contenuti; non montare banner Web AdSense nella WebView Capacitor.
- Sostenitori locali: gestione **separata** dai sostenitori politici e dalle aste Google. Distinguere donazione senza corrispettivo da sponsorizzazione commerciale etichettata.
- Solo annunci commerciali contestuali/non personalizzati. Nessuna campagna politica e nessun uso di voti, risposte, segmento ideologico, badge, ID utente o dati politici. Non passare il Comune di residenza a una rete pubblicitaria nella fase iniziale.
- Nessun log di ID pubblicitari, interessi, user ID o dati politici associati a impression.

## Stato tecnico verificato su main (02/11/2026)
1. `client/public/ads.txt` presente; l'esistenza del file non certifica approvazione AdSense né introiti.
2. `client/index.html` annota Cookiebot rimosso per fine periodo prova.
3. I precedenti `AdSenseBanner.tsx` e `useCookieConsent.ts` descritti in COOKIEBOT_IMPLEMENTATION.md non risultano più sul branch principale; la documentazione è storica.
4. `client/android/app/build.gradle` non dipende ancora da Google Mobile Ads/UMP e il Manifest non contiene l'AdMob application ID.
5. `client/src/pages/CookiePolicy.tsx` dichiara correttamente **nessun annuncio attivo**. Non cambiare tale dichiarazione finché i trattamenti non sono realmente attivati.
6. `client/src/lib/advertising-policy.ts` è un controllo fail-closed puro, non richiama nessuna rete e non è ancora collegato a una UI. Non considerarlo un'integrazione AdMob/AdSense completa.

## Gate obbligatori
- [ ] Identificare titolare/beneficiario dei ricavi e trattamento contabile, senza assumere automaticamente che il beneficiario sia l'associazione.
- [ ] Verificare approvazione AdMob dell'app e AdSense di demos.community; recuperare gli ID *da account*, non inventarli. Test unit ID Google solo su ambienti di sviluppo.
- [ ] Predisporre **app-ads.txt** sul dominio collegato come sito dello sviluppatore in Play Console, con righe verificate dell'account AdMob (distinto da ads.txt).
- [ ] Web: integrare CMP certificata Google/TCF e registrare consenso/prefrenze per scopi pubblicitari; senza segnale positivo non caricare script né effettuare richieste.
- [ ] Android: integrare UMP, relativo messaggio in Privacy & messaging; requestConsentInfoUpdate a ogni avvio; niente ad request prima del gate. Le limited ads vanno valutate separatamente e non presumono assenza di requisiti legali.
- [ ] Forzare e verificare richieste **non personalizzate** (AdSense NPA=1, verifica rete; AdMob impostazioni/request configuration documentate e testate).
- [ ] Configurare esclusioni per categorie politiche e filtri creativi negli account pubblicitari; verificare limiti reali dei filtri, che non garantiscono una esclusione perfetta.
- [ ] Implementare App Open solo mentre la schermata di caricamento è *davvero* visibile. Se l'annuncio arriva tardi, saltarlo. Mai sovrapporre votazioni o schermate sensibili.
- [ ] Pubblicare informative privacy/cookie aggiornate, registri, revoca e opzioni privacy; completare controllo DPO.
- [ ] Aggiornare dichiarazione Data Safety/identificatori pubblicitari su Play Console e testare su dispositivi reali prima del merge/deploy.
- [ ] Test negativi: consenso negato/revocato, nessun CMP, offline, logout, multi-account, primo avvio, splash completato, Android background/foreground, nav fissa e accessibilità.
- [ ] Consentire attivazione progressiva tramite flag **off per default**, separata dai gate di sicurezza della release minima DEMOS.

## Riferimenti ufficiali
- https://developers.google.com/admob/android/app-open
- https://developers.google.com/admob/android/privacy
- https://support.google.com/admob/answer/9363762
- https://support.google.com/admob/answer/14538460
- https://support.google.com/adsense/answer/13554116
- https://support.google.com/adsense/answer/7670312

Roadmap Google: `DEMOS – Strategia – Scalabilità e Finanziamento`, tab `ADS – MONETIZZAZIONE`.

## Importante
**Questo PR non attiva pubblicità né introduce SDK o tracciamento.** Non dichiarare la monetizzazione implementata finché i gate sopra non hanno evidenze e la UI non è collegata alle reti verificate.
