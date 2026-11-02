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
const { canRequestCommercialAd, MIN_APP_OPEN_INTERVAL_MS } = module.exports;

const web = {
  placement: 'web_banner',
  pathname: '/scopri-demos',
  enabled: true,
  privacyGatePassed: true,
  providerApproved: true,
  isNativeApp: false,
};
const app = {
  placement: 'android_app_open',
  pathname: '/',
  enabled: true,
  privacyGatePassed: true,
  providerApproved: true,
  isNativeApp: true,
  isLoadingScreen: true,
  isFirstUse: false,
  nowMs: 1_800_000_000_000,
};

test('fails closed until ads, privacy and provider are explicitly enabled', () => {
  for (const key of ['enabled', 'privacyGatePassed', 'providerApproved']) {
    assert.equal(canRequestCommercialAd({ ...web, [key]: false }), false);
    assert.equal(canRequestCommercialAd({ ...app, [key]: false }), false);
  }
});

test('web ads are allowed only on a public non-sensitive informational route', () => {
  assert.equal(canRequestCommercialAd(web), true);
  assert.equal(canRequestCommercialAd({ ...web, pathname: '/scopri-demos/' }), true);
  for (const pathname of [
    '/profilo', '/opinioni', '/opinioni-nazionali', '/vota', '/firma',
    '/sondaggi', '/referendum-abrogativi', '/iniziative-popolari',
    '/registrazione', '/privacy-policy', '/notifiche', '/eventi',
    '/scopri-demos/private'
  ]) {
    assert.equal(canRequestCommercialAd({ ...web, pathname }), false, pathname);
  }
  assert.equal(canRequestCommercialAd({ ...web, isNativeApp: true }), false);
});

test('App Open cannot appear on first use, during voting, or after the loading screen', () => {
  assert.equal(canRequestCommercialAd(app), true);
  assert.equal(canRequestCommercialAd({ ...app, isFirstUse: true }), false);
  assert.equal(canRequestCommercialAd({ ...app, isLoadingScreen: false }), false);
  assert.equal(canRequestCommercialAd({ ...app, pathname: '/sondaggi' }), false);
  assert.equal(canRequestCommercialAd({ ...app, pathname: '/opinioni' }), false);
  assert.equal(canRequestCommercialAd({ ...app, isNativeApp: false }), false);
  assert.equal(canRequestCommercialAd({ ...app, nowMs: undefined }), false);
});

test('App Open is strictly at most once per rolling 24 hours', () => {
  assert.equal(canRequestCommercialAd({ ...app, lastShownAtMs: app.nowMs - MIN_APP_OPEN_INTERVAL_MS + 1 }), false);
  assert.equal(canRequestCommercialAd({ ...app, lastShownAtMs: app.nowMs - MIN_APP_OPEN_INTERVAL_MS }), true);
  assert.equal(canRequestCommercialAd({ ...app, lastShownAtMs: app.nowMs + 1 }), false);
  assert.equal(canRequestCommercialAd({ ...app, lastShownAtMs: Number.NaN }), false);
});
