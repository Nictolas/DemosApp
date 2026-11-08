# ADS-15 — Preparazione dichiarazioni Play e verifica pacchetto release

Data verifica: 03/11/2026. Ambito: PR #558 **solo debug** e futura release pubblicitaria da autorizzare separatamente.

## 1. Evidenza sul pacchetto compilato, non sul bundle dello Store

- Source controllato: PR #558 dopo riconciliazione con main, commit `fa850b85ebc250c07ae3cacb9ca234b15a91a456`.
- `npm run android:sync` e `:app:assembleRelease` eseguiti localmente in worktree temporanea, con Android SDK già installato, senza firma o upload. Build riuscita, 178 task.
- APK **non firmato e soltanto locale**: `app-release-unsigned.apk`, 5.208.783 byte; SHA-256 `D005D3F921D755F323C37CC5EA6ED013F18D5082C3679C108D1256AD251091E9`.
- Lettura reale con Android `aapt dump badging/permissions/xmltree`: applicationId `community.demos`, `versionName=1.0.12`, `versionCode=15`, minSdk 24, targetSdk 36.
- Nel manifest compilato: permesso `com.google.android.gms.permission.AD_ID` **assente**; meta-data `com.google.android.gms.ads.APPLICATION_ID` **assente**; stringhe `ca-app-pub-` **assenti**.
- `:app:dependencies --configuration releaseRuntimeClasspath`: nessuna dipendenza `com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk`, `com.google.android.ump:user-messaging-platform` o `com.google.android.gms:play-services-ads`.
- Workflow `Advertising policy validation` esteso per compilare un APK release unsigned ed eseguire automaticamente le tre verifiche manifest + ID: in caso di comparsa di annunci/ID pubblicitari in release, **fallisce**. Dopo il commit va atteso il suo esito CI.
- **Limite:** questo controllo non certifica l'identità del bundle firmato installato dai tester e non verifica le dichiarazioni attualmente salvate in Play Console. Non prova assenza di altre raccolte di dati nell'app.


## 1-bis. Evidenza AAB scaricato direttamente dalla CI GitHub (03/11/2026)

- Run **Android Alpha Validation** [41548834153](https://github.com/Nictolas/DemosApp/actions/runs/41548834153), commit PR #558 `2119d90ef5a86fb6fc433075f5fb2e73d83366dc`, concluso con successo. Scaricato l'artefatto ufficiale GitHub Actions ID `13190541457` denominato `demos-android-current-UNSIGNED-aab`, senza firmarlo o installarlo.
- ZIP artefatto: 4.489.487 byte, **SHA-256 `dcdae26d5e3d581c3d76b8a7970f49ae5b96a18c084869d7e09a7411c4781eaa`**, corrispondente al digest pubblicato da GitHub.
- AAB interno `app-release.aab`: 4.891.204 byte, **SHA-256 `d90de1276c45ce0df0a3be4e3cf9ff85979f03db4bb4b0d29133572c78ad00a9`**, formato ZIP Android App Bundle con `BundleConfig.pb`, `base/manifest/AndroidManifest.xml`, `base/dex/classes.dex` e metadati dipendenze.
- Controllo **sul binario reale generato dalla CI**, non soltanto Gradle o APK locale: package `community.demos` presente nel manifest compilato; **assenti** `com.google.android.gms.permission.AD_ID`, `com.google.android.gms.ads.APPLICATION_ID` e `ca-app-pub-` dal manifest. Nella DEX e nei metadati delle dipendenze non risultano le firme specifiche dei pacchetti GMA, UMP o Play Services Ads verificate dallo script.
- Aggiunto `scripts/check-ads-free-aab.py`: lettura ZIP e verifica fail-closed con librerie standard Python, controllo di manifest, DEX, metadati dipendenze e firme Jar. **Test locale positivo PASS** su AAB GitHub e **test negativo PASS** (bundle temporaneo con `AD_ID` artificialmente inserito fa fallire il controllo). Aggiunto passo obbligatorio in `.github/workflows/android-alpha-validation.yml` per ogni prossimo `bundleRelease` da questa PR.
- **Limiti fondamentali:** il binario esaminato è **UNSIGNED**. Non dimostra quale AAB firmato sia distribuito ai tester su Play, né la correttezza delle dichiarazioni Ads/Data Safety. È un controllo mirato di SDK pubblicitari/permesso `AD_ID`, non una certificazione di assenza di tutti i trattamenti dati o una scansione esaustiva di librerie terze. Per la futura release monetizzata, il guardrail dovrà essere sostituito/aggiornato deliberatamente nella PR release autorizzata.

La **matrice preliminare dei dati già trattati da DEMOS**, distinta dall'SDK Ads, è in [PLAY_DATA_SAFETY_EVIDENCE_MATRIX_2026-11-03.md](PLAY_DATA_SAFETY_EVIDENCE_MATRIX_2026-11-03.md). Nessuna voce di quella matrice è una dichiarazione Play già inviata.

## 2. Fonti ufficiali per la futura dichiarazione con GMA Next-Gen

- GMA Next-Gen SDK 1.6.0 è presente *solo* in `debugImplementation` della PR #558, con `UMP` 4.0.0. Non deve essere dichiarato come già presente nella release disponibile ai tester.
- Google documenta per il **Next-Gen SDK** possibili raccolte/condivisioni automatiche: IP (dal quale può essere stimata una posizione approssimativa), interazioni con l'app, diagnostica/prestazioni, identificatori dispositivo e account (es. Android Advertising ID e App Set ID). Finalità indicate: annunci, analisi e prevenzione frodi. **Fonte:** https://developers.google.com/admob/android/next-gen/privacy/play-data-disclosure.
- Google Play richiede dichiarazioni complete per **tutte le versioni attivamente distribuite**, anche in test chiuso, incluse eventuali librerie di terzi. Il modulo Data Safety non descrive soltanto AdMob, ma tutti i trattamenti effettivi dell'app. **Fonte:** https://support.google.com/googleplay/android-developer/answer/10787469.
- Il permesso `com.google.android.gms.permission.AD_ID` può essere aggiunto dal manifest di un SDK pubblicitario, anche se non si scrive manualmente nel manifest dell'app. **Fonte:** https://support.google.com/googleplay/android-developer/answer/6048248.

## 3. Checklist prima di dichiarare Ads e Data Safety in Play Console

1. Aprire la **versione effettivamente distribuita** su Play Console e confrontare la relativa dichiarazione Ads/Data Safety con il suo manifest e la lista dei suoi SDK (il solo APK locale non basta).
2. Inventariare i dati di **tutta** DEMOS (account, opinioni, notifiche, autenticazione, log, SDK), distinguendo raccolta/condivisione e trattamento per finalità. Non classificare il progetto come «nessun dato raccolto» sulla sola base dell'assenza di SDK Ads.
3. Se si prepara la nuova release con GMA Next-Gen: rianalizzare le categorie dati del fornitore e la configurazione effettiva, verificare `AD_ID` nel bundle compilato e il significato delle diverse finalità; non dare per certo che disattivare la personalizzazione elimini ogni dato tecnico.
4. Distinguere il consenso valido/rifiuto/revoca UMP e l'esclusione dei minorenni dai **dati tecnici trattati** quando lo SDK è autorizzato a inizializzarsi. Verificare descrizioni, partner CMP e contratti con il DPO.
5. Verificare dichiarazioni Play su **Annunci presenti**, Data Safety, pubblico/età e privacy policy. Registrare gli esiti verificati dalla console, non ipotizzarli.
6. Prima del nuovo AAB: test fisico Android e collaudo UX naturale, approvazione AdMob/app-ads crawler e autorizzazione esplicita della PR release separata.

**Stato 03/11/2026: preflight tecnico su APK locale PASS; dichiarazioni Play non verificate né aggiornate, rilascio con annunci ancora NO-GO.**
