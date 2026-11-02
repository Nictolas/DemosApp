import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const privacy = read('../src/pages/PrivacyPolicy.tsx');
const cookies = read('../src/pages/CookiePolicy.tsx');
const gradle = read('../android/app/build.gradle');
const releaseManifest = read('../android/app/src/main/AndroidManifest.xml');

test('legal copy labels AdMob as planned rather than already live', () => {
  assert.match(privacy, /10\.1 Pubblicità nell'app Android: integrazione prevista, non ancora attiva/);
  assert.match(privacy, /Nelle versioni[\s\S]*?SDK AdMob e UMP non sono inclusi/);
  assert.match(cookies, /3\.2 Identificatori e strumenti pubblicitari Android \(non ancora attivi\)/);
  assert.match(cookies, /sito web DEMOS/);
  assert.match(gradle, /release\s*\{[\s\S]*?DEMOS_APP_OPEN_ADS_ENABLED', 'false'/);
  assert.doesNotMatch(releaseManifest, /com\.google\.android\.gms\.ads\.APPLICATION_ID/);
});

test('non-personalized ads are not falsely described as zero-data collection', () => {
  assert.match(privacy, /annunci non personalizzati/);
  assert.match(privacy, /non significa che gli[\s\S]*?annunci siano privi di trattamento/);
  assert.match(privacy, /indirizzo IP/);
  assert.match(privacy, /informazioni diagnostiche/);
  assert.match(privacy, /identificatori del dispositivo/);
  assert.match(privacy, /nessun trasferimento intenzionale delle scelte civiche/i);
  assert.match(privacy, /Google Mobile Ads/);
  assert.match(privacy, /play-data-disclosure/);
});

test('public explanation separates political consent from UMP advertising choices', () => {
  assert.match(privacy, /accettare, negare il consenso o gestire le opzioni/);
  assert.match(privacy, /Rifiutare il consenso pubblicitario non impedisce di usare DEMOS/);
  assert.match(privacy, /interesse legittimo/);
  assert.match(cookies, /separata[\s\S]*?opinioni politiche/);
  assert.match(cookies, /localStorage e sessionStorage non sono cookie HTTP,[\s\S]*?non dal nome della tecnologia/);
  assert.doesNotMatch(cookies, /non sono soggetti\s+alla direttiva ePrivacy/);
});

test('real AdMob production IDs are not embedded in public disclosures', () => {
  assert.doesNotMatch(privacy + cookies, /ca-app-pub-7488681940015678/);
});

test('app-ads.txt declares only the existing verified-format Google publisher seller', () => {
  const webSellers = read('../public/ads.txt').trim();
  const appSellers = read('../public/app-ads.txt').trim();
  assert.match(appSellers, /^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0$/);
  assert.equal(appSellers, webSellers);
  assert.equal(appSellers.split(/\r?\n/).length, 1, 'no undeclared ad sellers');
});
