import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL('../src/lib/advertising-policy.ts', import.meta.url), 'utf8',
);
const ts = createRequire(new URL('../package.json', import.meta.url))('typescript');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(js, { module, exports: module.exports });

const {
  canRequestAppOpenAd,
  MIN_APP_OPEN_INTERVAL_MS,
  APP_OPEN_ADS_ENABLED_BY_DEFAULT,
} = module.exports;

const eligible = {
  enabled: true,
  privacyGatePassed: true,
  nonPersonalizedAdsEnforced: true,
  providerApproved: true,
  isNativeAndroid: true,
  isForeground: true,
  isLoadingScreen: true,
  isFirstUse: false,
  hasSensitiveContentVisible: false,
  lastShownAtMs: null,
  nowMs: 1_800_000_000_000,
};

test('App Open is off by default and gated by explicit approval', () => {
  assert.equal(APP_OPEN_ADS_ENABLED_BY_DEFAULT, false);
  for (const key of [
    'enabled', 'privacyGatePassed', 'nonPersonalizedAdsEnforced',
    'providerApproved', 'isNativeAndroid', 'isForeground', 'isLoadingScreen'
  ]) {
    assert.equal(canRequestAppOpenAd({ ...eligible, [key]: false }), false, key);
    assert.equal(canRequestAppOpenAd({ ...eligible, [key]: undefined }), false, key);
  }
  assert.equal(canRequestAppOpenAd(eligible), true);
});

test('does not interrupt the first use, or any visible sensitive screen', () => {
  assert.equal(canRequestAppOpenAd({ ...eligible, isFirstUse: true }), false);
  assert.equal(canRequestAppOpenAd({ ...eligible, isFirstUse: undefined }), false);
  assert.equal(canRequestAppOpenAd({ ...eligible, hasSensitiveContentVisible: true }), false);
  assert.equal(canRequestAppOpenAd({ ...eligible, hasSensitiveContentVisible: undefined }), false);
  assert.equal(canRequestAppOpenAd({ ...eligible, isLoadingScreen: false }), false);
  assert.equal(canRequestAppOpenAd({ ...eligible, isForeground: false }), false);
});

test('never requests an ad twice in a rolling 6-hour interval', () => {
  const time = eligible.nowMs;
  assert.equal(MIN_APP_OPEN_INTERVAL_MS, 6 * 60 * 60 * 1000);
  assert.equal(canRequestAppOpenAd({ ...eligible, lastShownAtMs: time - 5 * 60 * 60 * 1000 }), false);
  assert.equal(canRequestAppOpenAd({ ...eligible, lastShownAtMs: time - MIN_APP_OPEN_INTERVAL_MS + 1 }), false);
  assert.equal(canRequestAppOpenAd({ ...eligible, lastShownAtMs: time - MIN_APP_OPEN_INTERVAL_MS }), true);
  assert.equal(canRequestAppOpenAd({ ...eligible, lastShownAtMs: time - MIN_APP_OPEN_INTERVAL_MS - 1 }), true);
});

test('clock anomalies or corrupt persisted timestamps fail closed', () => {
  const time = eligible.nowMs;
  for (const previous of [time + 1, Number.NaN, Number.POSITIVE_INFINITY, -1, undefined]) {
    assert.equal(canRequestAppOpenAd({ ...eligible, lastShownAtMs: previous }), false);
  }
  for (const now of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.equal(canRequestAppOpenAd({ ...eligible, nowMs: now }), false);
  }
});

test('no ad SDK/identifiers or web-banner implementation in App Open policy module', () => {
  assert.doesNotMatch(source, /AppOpenAd\.load\(|MobileAds\.initialize\(|adsbygoogle|AdSenseBanner/);
  assert.doesNotMatch(source, /politicalOpinions|userId|accountId|voteAnswers|comuneResidenza/);
});
