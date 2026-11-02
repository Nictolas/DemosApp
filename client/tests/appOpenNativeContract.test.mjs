import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const manager = read('../android/app/src/main/java/community/demos/DemosAppOpenAdsManager.java');
const gradle = read('../android/app/build.gradle');
const manifest = read('../android/app/src/debug/AndroidManifest.xml');
const mainManifest = read('../android/app/src/main/AndroidManifest.xml');
const mainActivity = read('../android/app/src/main/java/community/demos/MainActivity.java');

test('release App Open is permanently OFF and only debug contains sample App ID', () => {
  assert.match(gradle, /release\s*\{[\s\S]*?DEMOS_APP_OPEN_ADS_ENABLED', 'false'/);
  assert.match(gradle, /demosDebugAppOpenAds/);
  assert.match(manifest, /ca-app-pub-3940256099942544~3347511713/);
  assert.doesNotMatch(mainManifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
  assert.doesNotMatch(mainManifest, /ca-app-pub-/);
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
  assert.match(manager, /MIN_INTERVAL_MS/);
  assert.match(manager, /FIRST_ALLOWED_LAUNCH = 3/);
  assert.doesNotMatch(manager, /setWebViewClient\(|setWebChromeClient\(/);
  assert.doesNotMatch(manager, /sleep\(|postDelayed\(/);
});
