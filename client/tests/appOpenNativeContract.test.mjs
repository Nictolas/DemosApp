import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const manager = read('../android/app/src/debug/java/community/demos/DemosAppOpenAdsManager.java');
const gate = read('../android/app/src/main/java/community/demos/AppOpenFrequencyPolicy.java');
const javaTest = read('../android/app/src/test/java/community/demos/AppOpenFrequencyPolicyTest.java');
const tcfPolicy = read('../android/app/src/main/java/community/demos/AppOpenTcfConsentPolicy.java');
const tcfJUnit = read('../android/app/src/test/java/community/demos/AppOpenTcfConsentPolicyTest.java');
const gradle = read('../android/app/build.gradle');
const manifest = read('../android/app/src/debug/AndroidManifest.xml');
const mainManifest = read('../android/app/src/main/AndroidManifest.xml');
const releaseStub = read('../android/app/src/release/java/community/demos/DemosAppOpenAdsManager.java');
const mainActivity = read('../android/app/src/main/java/community/demos/MainActivity.java');
const nativePrivacy = read('../android/app/src/main/java/community/demos/NativeAppOpenPrivacyPlugin.java');
const clientPrivacy = read('../src/lib/native-app-open-privacy.ts');
const settings = read('../src/pages/Impostazioni/index.tsx');
const uiPrivacy = read('../src/pages/Impostazioni/components/AppOpenPrivacyOptions.tsx');
const landing = read('../src/pages/LandingPage.tsx');
const authPage = read('../src/pages/auth-page.tsx');
const authProvider = read('../src/hooks/use-auth.tsx');
const authBackend = read('../../api/routes/auth/profile.js');
const adultEligibility = read('../../api/utils/adsAdultEligibility.js');

test('normal release remains SDK-free; explicit opt-in is required for ad-capable candidates', () => {
  assert.match(gradle, /demosReleaseAppOpenAds = \(project\.findProperty\('demosReleaseAppOpenAds'\) \?: 'false'\)/);
  assert.match(gradle, /DEMOS_APP_OPEN_ADS_ENABLED', demosReleaseAppOpenAds\.toString\(\)/);
  assert.match(gradle, /java\.setSrcDirs\(\[demosReleaseAppOpenAds \? 'src\/debug\/java' : 'src\/release\/java'\]\)/);
  assert.match(gradle, /demosDebugAppOpenAds/);
  assert.match(manifest, /android:value="\$\{demosAdMobAppId\}"/);
  assert.match(gradle, /ca-app-pub-3940256099942544~3347511713/);
  assert.match(gradle, /manifestPlaceholders\['demosAdMobAppId'\]/);
  assert.doesNotMatch(mainManifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.doesNotMatch(mainManifest, /ca-app-pub-/);
  assert.match(gradle, /debugImplementation 'com\.google\.android\.libraries\.ads\.mobile\.sdk:ads-mobile-sdk/);
  assert.match(gradle, /debugImplementation 'com\.google\.android\.ump:user-messaging-platform/);
  assert.match(gradle, /if \(demosReleaseAppOpenAds\) \{\s*releaseImplementation 'com\.google\.android\.libraries\.ads\.mobile\.sdk:ads-mobile-sdk/);
  assert.match(gradle, /releaseImplementation 'com\.google\.android\.ump:user-messaging-platform/);
  assert.doesNotMatch(gradle, /\n\s+implementation 'com\.google\.android\.libraries\.ads\.mobile\.sdk/);
  assert.doesNotMatch(releaseStub, /MobileAds|UserMessagingPlatform|AppOpenAd\.load/);
  assert.match(mainActivity, /if \(BuildConfig\.DEMOS_APP_OPEN_ADS_ENABLED\)/);
});

test('UMP completes before GMA Next-Gen initializes and only test unit may load', () => {
  assert.match(manager, /consentInformation\.requestConsentInfoUpdate\(/);
  assert.match(manager, /loadAndShowConsentFormIfRequired\(/);
  assert.match(manager, /consentInformation\.canRequestAds\(\)/);
  assert.match(manager, /ConsentStatus\.OBTAINED/);
  assert.match(manager, /MobileAds\.initialize\(/);
  assert.match(manager, /RequestConfiguration\.PublisherPrivacyPersonalizationState\.DISABLED/);
  assert.match(manager, /new AdRequest\.Builder\(BuildConfig\.DEMOS_APP_OPEN_UNIT_ID\)/);
  assert.match(gradle, /ads-mobile-sdk:1\.6\.0/);
  assert.match(gradle, /user-messaging-platform:4\.0\.0/);
});

test('real loading is checked and no arbitrary wait or WebView overrides are added', () => {
  assert.match(manager, /getElementById\('root'\)/);
  assert.match(manager, /r\.children\.length===0/);
  assert.match(manager, /SystemClock\.elapsedRealtime\(\)/);
  assert.match(manager, /MAX_AD_AGE_MS/);
  assert.match(manager, /onAdShowedFullScreenContent\(\)/);
  assert.match(manager, /AppOpenFrequencyPolicy\.mayRequest/);
  assert.match(gate, /MIN_INTERVAL_MS = 6L/);
  assert.match(gate, /FIRST_ALLOWED_LAUNCH = 3/);
  assert.match(javaTest, /clockRollbackAndCorruptedPreferencesFailClosed/);
  assert.match(javaTest, /launchCounterIsOverflowSafe/);
  assert.doesNotMatch(manager, /setWebViewClient\(|setWebChromeClient\(/);
  assert.doesNotMatch(manager, /sleep\(|postDelayed\(/);
});


test('preload requires consent and ad display requires real loading', () => {
  const load = manager.slice(manager.indexOf('private void loadOnlyTestAppOpenAd()'), manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  const show = manager.slice(manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  assert.match(load, /AppOpenAd\.load\(/);
  assert.match(load, /MIN_LOAD_RETRY_MS/);
  assert.match(load, /!adultEligible/);
  assert.match(load, /!hasExplicitTcfConsent\(\)/);
  assert.match(show, /EMPTY_REACT_ROOT_JS/);
  assert.ok(show.indexOf('webView.evaluateJavascript(') < show.indexOf('ad.show(activity)'));
  assert.match(show, /putLong\(LAST_SHOWN, System.currentTimeMillis\(\)\)\s*\.commit\(\)/);
  assert.match(show, /onAdImpression\(\)/);
  assert.match(mainActivity, /appOpenAdsManager\.onDestroy\(\)/);
  assert.match(releaseStub, /void onDestroy\(\) \{\}/);
});

test('notification return and background resume cannot surface a cached App Open ad', () => {
  assert.match(manager, /private boolean coldLaunchDisplayWindowOpen = true/);
  const paused = manager.slice(manager.indexOf('void onPause()'), manager.indexOf('boolean arePrivacyOptionsRequired()', manager.indexOf('void onPause()')));
  assert.match(paused, /foreground = false;\s*coldLaunchDisplayWindowOpen = false;/);
  assert.match(paused, /if \(readyAd != null\) \{\s*readyAd\.destroy\(\);\s*readyAd = null;/);
  const load = manager.slice(manager.indexOf('private void loadOnlyTestAppOpenAd()'), manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  const show = manager.slice(manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  assert.ok(load.indexOf('!coldLaunchDisplayWindowOpen') > 0);
  assert.ok(load.indexOf('!coldLaunchDisplayWindowOpen') < load.indexOf('AppOpenAd.load('));
  assert.ok(load.indexOf('!coldLaunchDisplayWindowOpen', load.indexOf('public void onAdLoaded(')) > load.indexOf('public void onAdLoaded('));
  assert.ok(show.indexOf('!coldLaunchDisplayWindowOpen') > 0);
  const guardJsCallback = show.indexOf('result -> {');
  assert.ok(show.indexOf('!coldLaunchDisplayWindowOpen', guardJsCallback) > guardJsCallback);
  assert.ok(show.indexOf('!coldLaunchDisplayWindowOpen', guardJsCallback) < show.indexOf('ad.show(activity)'));
  assert.match(mainActivity, /appOpenAdsManager\.onPause\(\)/);
});

test('required UMP privacy options are reachable from Android settings without release ads', () => {
  assert.match(manager, /getPrivacyOptionsRequirementStatus\(\)/);
  assert.match(manager, /PrivacyOptionsRequirementStatus\.REQUIRED/);
  assert.match(manager, /UserMessagingPlatform\.showPrivacyOptionsForm\(/);
  assert.match(manager, /readyAd\.destroy\(\)/);
  assert.match(manager, /privacyFormOpen = true/);
  assert.match(manager, /privacyFormOpen = false/);
  assert.match(releaseStub, /arePrivacyOptionsRequired\(\) \{ return false; \}/);
  assert.match(mainActivity, /registerPlugin\(NativeAppOpenPrivacyPlugin\.class\)/);
  assert.match(mainActivity, /appOpenAdsManager\.showPrivacyOptions\(/);
  assert.match(nativePrivacy, /@CapacitorPlugin\(name = "NativeAppOpenPrivacy"\)/);
  assert.match(nativePrivacy, /result\.put\("required",/);
  assert.match(clientPrivacy, /Capacitor\.isNativePlatform\(\)/);
  assert.match(clientPrivacy, /Capacitor\.getPlatform\(\) === 'android'/);
  assert.match(settings, /<AppOpenPrivacyOptions \/>/);
  assert.match(uiPrivacy, /if \(!required\) return null/);
  assert.match(uiPrivacy, /if \(compact\)/);
  assert.match(landing, /<AppOpenPrivacyOptions compact \/>/);
  assert.match(authPage, /<AppOpenPrivacyOptions compact \/>/);
  // Inspect only actual JSObject output keys: comments mentioning political
  // data must not be treated as an outbound payload.
  const outputKeys = [...nativePrivacy.matchAll(/result\.put\("([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(outputKeys, ['required']);
});

test('in-flight SDK ad requests are invalidated when consent changes or Activity closes', () => {
  assert.match(manager, /private long consentGeneration = 0/);
  const privacyStart = manager.indexOf('void showPrivacyOptions(');
  const privacyEnd = manager.indexOf('void onDestroy()', privacyStart);
  const privacyMethod = manager.slice(privacyStart, privacyEnd);
  assert.match(privacyMethod, /privacyFormOpen = true;\s*consentVerifiedForAdultSession = false;\s*final long optionsGeneration = invalidateConsentGeneration\(\)/);
  const destroyMethod = manager.slice(manager.indexOf('void onDestroy()'), manager.indexOf('private int readLaunchCount()'));
  assert.match(destroyMethod, /invalidateConsentGeneration\(\)/);
  const loadMethod = manager.slice(manager.indexOf('private void loadOnlyTestAppOpenAd()'), manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  assert.match(loadMethod, /final long requestConsentGeneration = consentGeneration/);
  assert.match(loadMethod, /requestConsentGeneration != consentGeneration/);
  assert.match(loadMethod, /\|\| privacyFormOpen\s*\|\| activity\.isDestroyed\(\)/);
  assert.match(loadMethod, /ad\.destroy\(\)/);
});

test('queued GMA initialization is invalidated across logout and consent changes', () => {
  const invalidate = manager.slice(
    manager.indexOf('private long invalidateConsentGeneration()'),
    manager.indexOf('DemosAppOpenAdsManager(MainActivity')
  );
  assert.match(manager, /private final AtomicLong workerConsentEpoch = new AtomicLong\(\)/);
  assert.match(invalidate, /workerConsentEpoch\.incrementAndGet\(\)/);
  assert.match(invalidate, /return \+\+consentGeneration/);
  assert.match(manager, /adultEligible = confirmedAdult;\s*invalidateConsentGeneration\(\)/);
  assert.match(manager, /final long optionsGeneration = invalidateConsentGeneration\(\)/);
  assert.match(manager, /void onDestroy\(\) \{[\s\S]*?invalidateConsentGeneration\(\)/);

  const initialize = manager.slice(
    manager.indexOf('private void initializeSdk()'),
    manager.indexOf('// A single Google TEST ad may be preloaded')
  );
  assert.match(initialize, /if \(initialized \|\| initializing \|\|/);
  assert.match(initialize, /final long authorizedEpoch = workerConsentEpoch\.get\(\)/);
  assert.ok(
    initialize.indexOf('authorizedEpoch != workerConsentEpoch.get()') <
      initialize.indexOf('MobileAds.initialize('),
    'worker authorization must be checked BEFORE MobileAds initializes',
  );
  assert.match(initialize, /if \(authorizedEpoch != workerConsentEpoch\.get\(\)\) \{/);
  assert.match(initialize, /initializing = false;\s*\/\/ Consent may have been re-granted/);
  assert.match(initialize, /initializeSdk\(\);\s*\}\);\s*return;/);
  assert.match(initialize, /catch \(RuntimeException initializationFailure\)/);
  assert.doesNotMatch(initialize, /initializationFailure\.getMessage\(\)/);
  assert.match(initialize, /loadOnlyTestAppOpenAd\(\)/);
});

test('debug-only EEA UMP test mode cannot leak a production ad ID or enable release SDK', () => {
  assert.match(gradle, /demosDebugAdMobAppId = \(project\.findProperty\('demosDebugAdMobAppId'\)/);
  assert.match(gradle, /demosDebugUmpEea = demosDebugAppOpenAds &&/);
  // Play Internal App Sharing is the only opt-in where the DEBUG APK may use
  // the existing DEMOS package; normal EEA QA stays separately installable.
  assert.match(gradle, /demosDebugQaPlayInternalSharing = demosDebugUmpEea && demosDebugQaForceAdult &&/);
  assert.match(gradle, /demosDebugQaRealAge = demosDebugUmpEea && !demosDebugQaForceAdult &&/);
  assert.match(gradle, /if \(demosDebugQaRealAge\) \{\s*applicationIdSuffix '\.qaage'/);
  assert.match(gradle, /else if \(demosDebugUmpEea && !demosDebugQaPlayInternalSharing\s*&& !demosDebugQaPlayRealAge\) \{\s*applicationIdSuffix '\.qaopen'/);
  assert.match(gradle, /demosDebugQaPlayInternalSharing = demosDebugUmpEea && demosDebugQaForceAdult &&/);
  assert.match(gradle, /release\s*\{[\s\S]*?DEMOS_QA_FORCE_ADULT', 'false'/);
  assert.match(gradle, /release\s*\{[\s\S]*?DEMOS_UMP_DEBUG_EEA', 'false'/);
  assert.match(manager, /if \(BuildConfig\.DEMOS_UMP_DEBUG_EEA\)/);
  assert.match(manager, /new ConsentDebugSettings\.Builder\(activity\)/);
  assert.match(manager, /setDebugGeography\(ConsentDebugSettings\.DebugGeography\.DEBUG_GEOGRAPHY_EEA\)/);
  assert.match(manager, /paramsBuilder\.setConsentDebugSettings\(/);
  assert.match(manager, /logQaConsent\("form-complete"\)/);
  assert.match(manager, /activity\.isDestroyed\(\) \|\| activity\.isFinishing\(\)/);
  assert.doesNotMatch(gradle, /ca-app-pub-7488681940015678/);
  assert.doesNotMatch(manifest, /ca-app-pub-7488681940015678/);
  assert.match(gradle, /DEMOS_APP_OPEN_UNIT_ID', '"ca-app-pub-3940256099942544\/9257395921"'/);
  assert.doesNotMatch(releaseStub, /ConsentDebugSettings|MobileAds|UserMessagingPlatform/);
});

test('Play Internal App Sharing offers a real-age QA variant without bypassing identity checks', () => {
  assert.match(gradle, /demosDebugQaPlayRealAge = demosDebugUmpEea && !demosDebugQaForceAdult &&/);
  assert.match(gradle, /project\.findProperty\('demosDebugQaPlayRealAge'\)/);
  assert.match(gradle, /&& !demosDebugQaPlayRealAge\) \{\s*applicationIdSuffix '\.qaopen'/);
  const workflow = read('../../.github/workflows/advertising-policy-validation.yml');
  const stepStart = workflow.indexOf('- name: Package real-age debug APK for Play Internal App Sharing');
  const stepEnd = workflow.indexOf('- name: Archive real-age only-for-internal-sharing debug APK', stepStart);
  assert.ok(stepStart >= 0 && stepEnd > stepStart);
  const qaStep = workflow.slice(stepStart, stepEnd);
  assert.match(qaStep, /-PdemosDebugQaForceAdult=false/);
  assert.match(qaStep, /-PdemosDebugQaPlayRealAge=true/);
  assert.match(qaStep, /-PdemosDebugUmpEea=true/);
  assert.match(qaStep, /package: name='community\.demos'/);
  assert.match(qaStep, /DEMOS_QA_FORCE_ADULT = false;/);
  assert.match(qaStep, /DEMOS_UMP_DEBUG_EEA = true;/);
  assert.match(qaStep, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.doesNotMatch(qaStep, /-PdemosDebugQaForceAdult=true/);
  assert.doesNotMatch(qaStep, /-PdemosReleaseAdsApproved=true/);
  assert.match(workflow, /DEMOS-PLAY-INTERNAL-REAL-AGE-DEBUG-TEST-ONLY/);
  // A second debug build cleans Gradle's output tree: the emulator must
  // install the archived real-age APK from a durable QA directory.
  const ageStage = workflow.slice(
    workflow.indexOf('- name: Package age-gated Android QA APK without synthetic adult'),
    workflow.indexOf('- name: Archive age-gated QA APK (no synthetic adult)')
  );
  assert.match(ageStage, /mkdir -p qa-real-age-apks/);
  assert.ok(ageStage.includes('cp "$apk" qa-real-age-apks/DEMOS-REAL-AGE-QA-TEST-ONLY.apk'));
  const emulatorStage = workflow.slice(
    workflow.indexOf('- name: Offline anonymous emulator smoke for real-age QA'),
    workflow.indexOf('- name: Confirm release runtime does not include AdMob or UMP')
  );
  assert.ok(emulatorStage.includes('client/android/qa-real-age-apks/DEMOS-REAL-AGE-QA-TEST-ONLY.apk'));
  assert.ok(!emulatorStage.includes('client/android/app/build/outputs/apk/debug/real-age-qa/'));
});

test('UMP configuration errors fail closed instead of using cached consent or initializing ads', () => {
  const match = manager.match(/requestError -> \{([\s\S]*?)\r?\n            \}\r?\n        \);/);
  assert.ok(match, 'current-session UMP error handler must be present');
  const onFailure = match[1];
  assert.doesNotMatch(onFailure, /initializeSdk\(|MobileAds\.initialize\(|AppOpenAd\.load\(/);
  assert.match(onFailure, /requestError\.getErrorCode\(\)/);
  assert.doesNotMatch(onFailure, /requestError\.getMessage\(\)/);
  assert.match(manager, /if \(formError != null \|\| requestGeneration != consentGeneration\s*\|\| !adultEligible \|\| activity\.isDestroyed\(\) \|\| activity\.isFinishing\(\)\) return/);
});

test('explicit TCF consent gate blocks refusal before any SDK initialization or ad request', () => {
  assert.match(manager, /PreferenceManager\.getDefaultSharedPreferences\(activity\)/);
  assert.match(manager, /getString\("IABTCF_PurposeConsents", ""\)/);
  assert.match(manager, /getString\("IABTCF_VendorConsents", ""\)/);
  assert.match(manager, /AppOpenTcfConsentPolicy\.allowsGoogleNonPersonalizedAdRequest\(/);
  assert.match(tcfPolicy, /GOOGLE_GVL_VENDOR_ID = 755/);
  assert.match(tcfPolicy, /purposeConsents\.charAt\(0\) != '1'/);
  assert.match(tcfPolicy, /vendorConsents\.charAt\(GOOGLE_GVL_VENDOR_ID - 1\) != '1'/);
  assert.match(tcfJUnit, /explicitDoNotConsentFailsClosedEvenIfUmpCanRequestAds/);
  assert.match(tcfJUnit, /googleVendorConsentDeniedAlwaysBlocksRequests/);
  assert.match(manager, /ConsentStatus\.OBTAINED\s*&& hasExplicitTcfConsent\(\)/);
  const initialize = manager.slice(manager.indexOf('private void initializeSdk()'), manager.indexOf('private void loadOnlyTestAppOpenAd()'));
  assert.match(initialize, /if \(initialized[\s\S]*?!hasExplicitTcfConsent\(\)\) return;/);
  const load = manager.slice(manager.indexOf('private void loadOnlyTestAppOpenAd()'), manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  assert.match(load, /!hasExplicitTcfConsent\(\)/);
  assert.ok(load.indexOf('!hasExplicitTcfConsent()') < load.indexOf('AppOpenAd.load('), 'explicit TCF gate must precede network requests');
  const show = manager.slice(manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  assert.match(show, /!hasExplicitTcfConsent\(\)/);
  assert.match(gradle, /buildConfigField 'String', 'DEMOS_ADMOB_APP_ID', "/);
});

test('native UMP privacy status is observable after asynchronous startup and revocation', () => {
  assert.match(manager, /PRIVACY_STATUS_CHANGED_JS/);
  assert.match(manager, /window\.dispatchEvent\(new Event\('demos:app-open-privacy-status-changed'\)\)/);
  assert.match(manager, /webView\.evaluateJavascript\(PRIVACY_STATUS_CHANGED_JS, null\)/);
  assert.match(manager, /logQaConsent\("updated"\);\s*notifyPrivacyOptionsChanged\(\)/);
  assert.match(manager, /logQaConsent\("form-complete"\);\s*notifyPrivacyOptionsChanged\(\)/);
  assert.match(manager, /privacyFormOpen = false;\s*notifyPrivacyOptionsChanged\(\)/);
  assert.match(uiPrivacy, /window\.addEventListener\('demos:app-open-privacy-status-changed', refresh\)/);
  assert.match(uiPrivacy, /window\.removeEventListener\('demos:app-open-privacy-status-changed', refresh\)/);
  assert.match(uiPrivacy, /document\.addEventListener\('visibilitychange', onVisibilityChange\)/);
  assert.match(uiPrivacy, /currentRequestId === requestId/);
});

test('UMP privacy options dialog is always opened on the Android main thread', () => {
  const method = mainActivity.slice(
    mainActivity.indexOf('void showAppOpenPrivacyOptions('),
    mainActivity.indexOf('@Override', mainActivity.indexOf('void showAppOpenPrivacyOptions('))
  );
  assert.match(method, /runOnUiThread\(\(\) -> \{/);
  assert.ok(method.indexOf('runOnUiThread') < method.indexOf('appOpenAdsManager.showPrivacyOptions('));
  assert.match(method, /isFinishing\(\) \|\| isDestroyed\(\)/);
  assert.match(nativePrivacy, /activity\.showAppOpenPrivacyOptions\(/);
});


test('minor/unknown-age users do not invoke UMP, initialize SDK or request App Open', () => {
  assert.match(adultEligibility, /year <= now\.getUTCFullYear\(\) - 19/);
  assert.match(authBackend, /ads_adult_eligible: isConfirmedAdultForAds\(user\.data_nascita\)/);
  assert.match(authProvider, /userData\.ads_adult_eligible === true/);
  assert.match(authProvider, /setNativeAppOpenAdultEligibility\(verifiedAdultForAds\)/);
  assert.match(authProvider, /await setNativeAppOpenAdultEligibility\(false\)/);
  assert.match(clientPrivacy, /setAdultEligibility\(\{ eligible: eligible === true \}\)/);
  assert.match(nativePrivacy, /setAdultEligibility\(PluginCall call\)/);
  assert.match(nativePrivacy, /Boolean\.TRUE\.equals\(confirmed\)/);
  assert.match(mainActivity, /runOnUiThread\(\(\) -> \{[\s\S]*?appOpenAdsManager\.setAdultEligible\(verifiedAdult\)/);
  assert.match(manager, /private boolean adultEligible = false/);
  assert.match(manager, /void setAdultEligible\(boolean confirmedAdult\)/);
  assert.match(manager, /if \(BuildConfig\.DEMOS_QA_FORCE_ADULT && !confirmedAdult\) return/);
  assert.match(manager, /if \(!umpRequested\) \{[\s\S]*?requestAdultConsent\(\)/);
  assert.match(manager, /if \(!adultEligible \|\| activity\.isFinishing\(\) \|\| activity\.isDestroyed\(\)\) return/);
  assert.match(manager, /\|\| !adultEligible \|\| !consentVerifiedForAdultSession \|\| !hasExplicitTcfConsent\(\)/);
  assert.match(manager, /if \(!BuildConfig\.DEMOS_APP_OPEN_ADS_ENABLED\s*\|\| !adultEligible/);
  assert.doesNotMatch(manager, /!BuildConfig\.DEBUG/);
  assert.match(gradle, /demosDebugQaForceAdult = demosDebugUmpEea &&/);
  assert.match(gradle, /DEMOS_QA_FORCE_ADULT', 'false'/);
  assert.doesNotMatch(nativePrivacy, /data_nascita|birthYear|userId|politicalOpinions/);
});

test('new authenticated adult sessions revalidate UMP and stale callbacks cannot authorize ads', () => {
  const adultMethod = manager.slice(manager.indexOf('void setAdultEligible('), manager.indexOf('private void requestAdultConsent()'));
  const consentMethod = manager.slice(manager.indexOf('private void requestAdultConsent()'), manager.indexOf('// Updates only a UI visibility flag'));
  const privacyMethod = manager.slice(manager.indexOf('void showPrivacyOptions('), manager.indexOf('void onDestroy()'));
  const resumeMethod = manager.slice(manager.indexOf('void onResume()'), manager.indexOf('void onPause()'));
  const initialize = manager.slice(manager.indexOf('private void initializeSdk()'), manager.indexOf('private void loadOnlyTestAppOpenAd()'));
  const load = manager.slice(manager.indexOf('private void loadOnlyTestAppOpenAd()'), manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  const show = manager.slice(manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  assert.match(adultMethod, /consentVerifiedForAdultSession = false/);
  assert.match(adultMethod, /umpRequested = false/);
  assert.doesNotMatch(adultMethod, /else if \(consentInformation != null/);
  assert.match(consentMethod, /final long requestGeneration = consentGeneration/);
  assert.match(consentMethod, /requestGeneration != consentGeneration/g);
  assert.match(consentMethod, /consentVerifiedForAdultSession = true/);
  assert.match(consentMethod, /consentVerifiedForAdultSession = false/);
  assert.match(privacyMethod, /final long optionsGeneration = invalidateConsentGeneration\(\)/);
  assert.match(privacyMethod, /optionsGeneration != consentGeneration/);
  assert.match(privacyMethod, /consentVerifiedForAdultSession = true/);
  assert.match(resumeMethod, /!consentVerifiedForAdultSession/);
  assert.match(initialize, /!consentVerifiedForAdultSession/);
  assert.match(load, /!consentVerifiedForAdultSession/g);
  assert.match(show, /!consentVerifiedForAdultSession/g);
});

test('anonymous users retain a working privacy-revocation entry point without enabling ads', () => {
  const method = manager.slice(manager.indexOf('void showPrivacyOptions('), manager.indexOf('void onDestroy()'));
  assert.match(method, /optionsGeneration != consentGeneration/);
  assert.match(method, /if \(adultEligible && consentInformation\.canRequestAds\(\)/);
  assert.doesNotMatch(method, /optionsGeneration != consentGeneration\s*\|\| !adultEligible/);
  assert.match(method, /onSuccess\.run\(\)/);
  assert.match(method, /consentVerifiedForAdultSession = false/);
});

test('ad-capable release is test-only by default and requires explicit approval for real ads', () => {
  assert.match(gradle, /demosReleaseAdsTestOnly = \(project\.findProperty\('demosReleaseAdsTestOnly'\) \?: 'true'\)/);
  assert.match(gradle, /demosReleaseAdsApproved = \(project\.findProperty\('demosReleaseAdsApproved'\) \?: 'false'\)/);
  assert.match(gradle, /demosReleaseAdUnitId != demosSampleAppOpenUnitId/);
  assert.match(gradle, /if \(!demosReleaseAdsApproved && !demosReleasePlayClosedQa\)/);
  assert.match(gradle, /manifest\.srcFile 'src\/debug\/AndroidManifest.xml'/);
  assert.match(gradle, /DEMOS_UMP_DEBUG_EEA', 'false'/);
  assert.match(gradle, /DEMOS_QA_FORCE_ADULT', 'false'/);
  assert.match(manager, /AppOpenFrequencyPolicy\.mayRequest\(/);
  assert.match(manager, /AppOpenTcfConsentPolicy\.allowsGoogleNonPersonalizedAdRequest\(/);
  assert.doesNotMatch(manager, /!BuildConfig\.DEBUG/);
});

test('closed Google Play QA forbids demo IDs and requires owner test-mode confirmation', () => {
  assert.match(gradle, /demosReleasePlayClosedQa = \(project\.findProperty\('demosReleasePlayClosedQa'\) \?: 'false'\)/);
  assert.match(gradle, /demosReleasePlayClosedQaOwnerConfirmed =\s*\(project\.findProperty\('demosReleasePlayClosedQaOwnerConfirmed'\) \?: 'false'\)/);
  assert.match(gradle, /if \(demosReleasePlayClosedQa && \(!demosReleaseAppOpenAds/);
  assert.match(gradle, /\|\| demosReleaseQaIsolated \|\| demosReleaseAdsTestOnly/);
  assert.match(gradle, /\|\| demosReleaseAdsApproved \|\| !demosReleasePlayClosedQaOwnerConfirmed/);
  assert.match(gradle, /if \(!demosReleaseAdsApproved && !demosReleasePlayClosedQa\)/);
  assert.match(gradle, /demosReleaseAdMobAppId == demosSampleAppId/);
  assert.match(gradle, /demosReleaseAdUnitId == demosSampleAppOpenUnitId/);
  assert.match(gradle, /Google demo IDs are forbidden for Play closed QA/);
  assert.match(gradle, /DEMOS_QA_FORCE_ADULT', 'false'/);
  assert.match(gradle, /DEMOS_UMP_DEBUG_EEA', 'false'/);
  // Google demo AAB is only for off-Play CI. On-Play closed-track QA uses
  // OWNER's AdMob units with externally verified per-version TEST MODE.
  const workflow = read('../../.github/workflows/advertising-policy-validation.yml');
  assert.match(workflow, /No Play release, real ads, device QA or DPO approval is inferred/);
  assert.match(workflow, /-PdemosReleasePlayClosedQa=true/);
  assert.match(workflow, /-PdemosReleasePlayClosedQaOwnerConfirmed=true/);
  assert.match(workflow, /-PdemosReleaseAdsTestOnly=false/);
  assert.match(workflow, /PASS: closed Play QA rejects missing owner test-mode confirmation and Google demo IDs/);
});

test('isolated test release upgrade is signed for QA only and cannot use real ad IDs', () => {
  assert.match(gradle, /demosReleaseQaIsolated = \(project\.findProperty\('demosReleaseQaIsolated'\) \?: 'false'\)/);
  assert.match(gradle, /if \(demosReleaseQaIsolated && \(!demosReleaseAdsTestOnly \|\| demosReleaseAdsApproved/);
  assert.match(gradle, /demosReleaseAdMobAppId != demosSampleAppId/);
  assert.match(gradle, /applicationIdSuffix '\.qaadsrc'/);
  assert.match(gradle, /signingConfig signingConfigs\.debug/);
  assert.match(gradle, /else if \(keystorePropertiesFile\.exists\(\)\) \{\s*signingConfig signingConfigs\.release/);
  assert.match(gradle, /DEMOS_QA_FORCE_ADULT', 'false'/);
  assert.match(gradle, /DEMOS_UMP_DEBUG_EEA', 'false'/);
  const workflow = read('../../.github/workflows/advertising-policy-validation.yml');
  assert.match(workflow, /Build isolated Ads-free to TEST-ads release upgrade pair/);
  assert.match(workflow, /adb install -r client\/android\/qa-isolated-apks\/DEMOS-APP-OPEN-TEST-CANDIDATE-ISOLATED\.apk/);
  assert.doesNotMatch(workflow, /adb install -r "\$candidate"/);
  assert.match(workflow, /adb uninstall community\.demos\.qaadsrc/);
  assert.match(workflow, /Offline anonymous emulator smoke for real-age QA/);
  // Build an AAB along the real release code path, but never publish or sign it.
  assert.match(workflow, /:app:bundleRelease/);
  assert.ok(workflow.includes('bundle=app/build/outputs/bundle/release/app-release.aab'));
  assert.ok(workflow.includes('test -s "$bundle"'));
  assert.match(workflow, /PASS: test-only opt-in unsigned AAB compiled/);
  // The emulator runner runs EACH script line in a fresh /bin/sh process.
  assert.match(workflow, /if adb logcat -d -s AndroidRuntime:E \| grep -Fq 'community\.demos\.qaadsrc'; then echo [^\n]+; exit 1; fi/);
});
