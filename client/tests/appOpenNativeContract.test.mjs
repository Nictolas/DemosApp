import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const manager = read('../android/app/src/debug/java/community/demos/DemosAppOpenAdsManager.java');
const gate = read('../android/app/src/main/java/community/demos/AppOpenFrequencyPolicy.java');
const javaTest = read('../android/app/src/test/java/community/demos/AppOpenFrequencyPolicyTest.java');
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

test('release App Open is permanently OFF and only debug contains sample App ID', () => {
  assert.match(gradle, /release\s*\{[\s\S]*?DEMOS_APP_OPEN_ADS_ENABLED', 'false'/);
  assert.match(gradle, /demosDebugAppOpenAds/);
  assert.match(manifest, /android:value="\$\{demosAdMobAppId\}"/);
  assert.match(gradle, /ca-app-pub-3940256099942544~3347511713/);
  assert.match(gradle, /manifestPlaceholders\['demosAdMobAppId'\]/);
  assert.doesNotMatch(mainManifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.doesNotMatch(mainManifest, /ca-app-pub-/);
  assert.match(gradle, /debugImplementation 'com\.google\.android\.libraries\.ads\.mobile\.sdk:ads-mobile-sdk/);
  assert.match(gradle, /debugImplementation 'com\.google\.android\.ump:user-messaging-platform/);
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
  assert.match(gate, /MIN_INTERVAL_MS = 24L/);
  assert.match(gate, /FIRST_ALLOWED_LAUNCH = 3/);
  assert.match(javaTest, /clockRollbackAndCorruptedPreferencesFailClosed/);
  assert.match(javaTest, /launchCounterIsOverflowSafe/);
  assert.doesNotMatch(manager, /setWebViewClient\(|setWebChromeClient\(/);
  assert.doesNotMatch(manager, /sleep\(|postDelayed\(/);
});


test('ad requests are suppressed BEFORE network activity once the app loads', () => {
  const loadMethod = manager.slice(manager.indexOf('private void loadOnlyTestAppOpenAd()'));
  const readRoot = loadMethod.indexOf('webView.evaluateJavascript(EMPTY_REACT_ROOT_JS');
  const networkCall = loadMethod.indexOf('AppOpenAd.load(');
  assert.ok(readRoot >= 0 && networkCall > readRoot, 'screen check precedes network request');
  assert.match(manager, /!foreground \|\| loading \|\| readyAd != null \|\| showing/);
  assert.match(manager, /!consentInformation.canRequestAds\(\)/);
  assert.match(manager, /ConsentStatus\.OBTAINED/);
  assert.match(manager, /catch \(ClassCastException corruptValue\)/);
  assert.match(manager, /putLong\(LAST_SHOWN, System.currentTimeMillis\(\)\)\s*\.commit\(\)/);
  assert.match(mainActivity, /appOpenAdsManager\.onDestroy\(\)/);
  assert.match(releaseStub, /void onDestroy\(\) \{\}/);
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
  assert.match(privacyMethod, /privacyFormOpen = true;\s*consentGeneration\+\+/);
  const destroyMethod = manager.slice(manager.indexOf('void onDestroy()'), manager.indexOf('private int readLaunchCount()'));
  assert.match(destroyMethod, /consentGeneration\+\+/);
  const loadMethod = manager.slice(manager.indexOf('private void loadOnlyTestAppOpenAd()'), manager.indexOf('private void maybeShowOnlyWhileReallyLoading()'));
  assert.match(loadMethod, /final long requestConsentGeneration = consentGeneration/);
  assert.match(loadMethod, /requestConsentGeneration != consentGeneration/);
  assert.match(loadMethod, /\|\| privacyFormOpen\s*\|\| activity\.isDestroyed\(\)/);
  assert.match(loadMethod, /ad\.destroy\(\)/);
});

test('debug-only EEA UMP test mode cannot leak a production ad ID or enable release SDK', () => {
  assert.match(gradle, /demosDebugAdMobAppId = \(project\.findProperty\('demosDebugAdMobAppId'\)/);
  assert.match(gradle, /demosDebugUmpEea = demosDebugAppOpenAds &&/);
  assert.match(gradle, /if \(demosDebugUmpEea\) \{\s*applicationIdSuffix '\.qaopen'/);
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
