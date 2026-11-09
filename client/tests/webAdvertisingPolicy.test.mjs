import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../src/lib/web-advertising-policy.ts');
const ts = createRequire(new URL('../package.json', import.meta.url))('typescript');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
runInNewContext(compiled, { module, exports: module.exports });

const {
  WEB_ADS_ENABLED_BY_DEFAULT,
  WEB_ADSENSE_ALLOWED_PUBLIC_ROUTES,
  classifyWebAdSurface,
  canRequestWebAdSenseBanner,
  couldEnablePwaVignetteAfterReview,
} = module.exports;

const allowed = {
  native: false,
  standaloneDisplayMode: false,
  standaloneIos: false,
  desktopViewport: true,
  enabled: true,
  siteApproved: true,
  cmpCertified: true,
  liveCmpDecisionAllowsAds: true,
  nonPersonalizedAdsOnly: true,
  pathname: '/scopri-demos',
  clientId: 'ca-pub-1234567890123456',
  adSlot: '1234567890',
};

test('web ad system is disabled by default; only a public information route is allowlisted', () => {
  assert.equal(WEB_ADS_ENABLED_BY_DEFAULT, false);
  assert.equal(WEB_ADSENSE_ALLOWED_PUBLIC_ROUTES.length, 1);
  assert.equal(WEB_ADSENSE_ALLOWED_PUBLIC_ROUTES[0], '/scopri-demos');
  assert.equal(canRequestWebAdSenseBanner(allowed), true);
});

test('every individual provider and CMP gate fails closed', () => {
  for (const key of [
    'enabled', 'siteApproved', 'cmpCertified',
    'liveCmpDecisionAllowsAds', 'nonPersonalizedAdsOnly',
  ]) {
    assert.equal(canRequestWebAdSenseBanner({ ...allowed, [key]: false }), false, key);
    assert.equal(canRequestWebAdSenseBanner({ ...allowed, [key]: undefined }), false, key);
  }
});

test('rejects invalid or missing publisher ID, ad slot and unapproved routes', () => {
  for (const clientId of ['', 'pub-1234567890123456', 'ca-pub-1234', 'ca-pub-1234567890123456?x=1']) {
    assert.equal(canRequestWebAdSenseBanner({ ...allowed, clientId }), false, clientId);
  }
  for (const adSlot of ['', '123', '12345678901', '123456789x']) {
    assert.equal(canRequestWebAdSenseBanner({ ...allowed, adSlot }), false, adSlot);
  }
  for (const pathname of [
    '/', '/auth', '/profilo', '/opinioni', '/firme',
    '/gestisci/grazia', '/impostazioni', '/scopri-demos?unsafe=1',
  ]) {
    assert.equal(canRequestWebAdSenseBanner({ ...allowed, pathname }), false, pathname);
    assert.equal(couldEnablePwaVignetteAfterReview({
      ...allowed, standaloneIos: true, pathname,
    }), false, pathname);
  }
});

test('installed iOS/Android PWA is not confused with desktop, even on a wide screen', () => {
  assert.equal(classifyWebAdSurface(allowed), 'desktop-browser');
  assert.equal(classifyWebAdSurface({ ...allowed, desktopViewport: false }), 'mobile-browser');
  assert.equal(classifyWebAdSurface({ ...allowed, standaloneIos: true }), 'installed-pwa');
  assert.equal(classifyWebAdSurface({ ...allowed, standaloneDisplayMode: true }), 'installed-pwa');
  assert.equal(classifyWebAdSurface({ ...allowed, native: true, standaloneIos: true }), 'native-app');
  assert.equal(canRequestWebAdSenseBanner({ ...allowed, standaloneIos: true }), false);
  assert.equal(canRequestWebAdSenseBanner({ ...allowed, standaloneDisplayMode: true }), false);
  assert.equal(canRequestWebAdSenseBanner({ ...allowed, native: true }), false);
  assert.equal(canRequestWebAdSenseBanner({ ...allowed, desktopViewport: false }), true);
});

test('fullscreen PWA vignette is planning-only and subject to the same privacy gates', () => {
  const pwa = { ...allowed, standaloneIos: true };
  assert.equal(couldEnablePwaVignetteAfterReview(pwa), true);
  assert.equal(canRequestWebAdSenseBanner(pwa), false);
  assert.equal(couldEnablePwaVignetteAfterReview({
    ...pwa, liveCmpDecisionAllowsAds: false,
  }), false);
  assert.equal(couldEnablePwaVignetteAfterReview({
    ...pwa, native: true,
  }), false);
  assert.equal(couldEnablePwaVignetteAfterReview(allowed), false);
});

test('actual manual banner is mounted only on public discover page and defaults to no requests', () => {
  const banner = read('../src/components/WebAdSenseBanner.tsx');
  const discover = read('../src/pages/ScopriDemos.tsx');
  const html = read('../index.html');
  assert.match(discover, /import \{ WebAdSenseBanner \}/);
  assert.match(discover, /<WebAdSenseBanner \/>/);
  assert.match(banner, /WEB_ADS_ENABLED_BY_DEFAULT === false/);
  assert.match(banner, /VITE_DEMOS_WEB_ADS_ENABLED === 'true'/);
  assert.match(banner, /VITE_DEMOS_ADSENSE_SITE_APPROVED === 'true'/);
  assert.match(banner, /VITE_DEMOS_WEB_ADS_CMP_CERTIFIED === 'true'/);
  assert.match(banner, /VITE_DEMOS_WEB_ADS_AUTO_ADS_DISABLED === 'true'/);
  assert.match(banner, /__demosWebAdsConsentBridge\?\.canServeNonPersonalizedAds/);
  assert.match(banner, /canRequestWebAdSenseBanner\(/);
  assert.match(banner, /Capacitor\.isNativePlatform\(\)/);
  assert.match(banner, /if \(!allowed\) return null/);
  assert.match(banner, /requestNonPersonalizedAds = 1/);
  assert.match(banner, /script\.src = 'https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client='/);
  assert.doesNotMatch(html, /adsbygoogle\.js/);
  assert.doesNotMatch(banner + source, /userId|birthYear|politicalOpinions|votoUtente|comuneResidenza/i);
});
