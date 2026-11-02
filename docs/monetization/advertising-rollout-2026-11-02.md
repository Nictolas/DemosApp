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

## Base codice introdotta
- `client/src/lib/advertising-policy.ts`: unica regola App Open Android fail-closed. Il flag predefinito è OFF e **nessun SDK o tracciamento è caricato**.
- `client/tests/advertisingPolicy.test.mjs`: regressioni su consenso, configurazione, frequenza 24h, primo uso e schermate sensibili.
- `.github/workflows/advertising-policy-validation.yml`: verifica automatica nelle PR.
- Nessuna modifica a `AndroidManifest.xml`, `MainActivity.java`, Gradle, AAB o app live.

## Gate di sviluppo prima di collegare AdMob
1. Ottenere account AdMob operativo e controllare che `community.demos` e il relativo dominio sviluppatore risultino corretti. Confermare **AdMob App ID** e **App Open Ad Unit ID**, senza inventarli o pubblicarli negli output.
2. Verificare se AdMob fornisce le unità per l'app in test chiuso. In sviluppo usare esclusivamente gli ID di test Google, senza mai generare impression reali di prova.
3. Integrare **Google Mobile Ads SDK** e **Google UMP SDK** nella parte **nativa Android**, non uno script AdSense all'interno della WebView Capacitor.
4. Integrare UMP: `requestConsentInfoUpdate()` **a ogni avvio**, quindi `loadAndShowConsentFormIfRequired()`; consentire richieste solo dopo la verifica di `canRequestAds()` e ulteriori condizioni documentate per limitare rigorosamente la personalizzazione.
5. Definire un entry point per modificare/rivedere le scelte privacy, se richiesto da UMP.
6. Configurare in AdMob esclusioni di categorie politiche e verificare la reale efficacia dei blocchi. La non-personalizzazione e il consenso non garantiscono da soli privacy completa o assenza di identificatori.
7. La componentistica di `MainActivity` deve segnalare al gestore App Open **solo un loading screen vero**; non usare un timer fittizio, né l'evento activity start come autorizzazione automatica a mostrare un annuncio.
8. Usare una persistente `SharedPreferences` o equivalente per primo uso e ultimo **onAdShowedFullScreenContent**, rispettando clock rollback.
9. Scartare unità pubblicitarie precaricate oltre **quattro ore**; se caricamento o callback arriva tardi, non mostrare.
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
node --test tests/advertisingPolicy.test.mjs
```

## Documentazione
- https://developers.google.com/admob/android/app-open
- https://developers.google.com/admob/android/privacy
- https://developers.google.com/admob/android/test-ads
- https://support.google.com/admob/answer/9363762

Piano: Google Sheet `DEMOS – Strategia – Scalabilità e Finanziamento`, tab `ADS – MONETIZZAZIONE`. PR: https://github.com/Nictolas/DemosApp/pull/558

**Non ancora un'integrazione SDK completa.** Per l'attivazione restano necessari account/ID, modulo UMP, implementazione Android effettiva e test.
