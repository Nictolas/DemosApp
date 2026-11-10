import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const layout = readFileSync(new URL('../src/components/RobustAppLayout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/robust-layout.css', import.meta.url), 'utf8');

test('long document routes get Android document scroll while fixed screens do not', () => {
  for (const path of ['/approfondimento','/sondaggi','/legal-documents','/privacy-policy','/audit-dashboard']) {
    assert.ok(layout.includes("'" + path + "'"), path);
  }
  assert.match(layout, /path\.startsWith\('\/monitoring-dashboard\/'\)/);
  assert.match(layout, /path\.startsWith\('\/sondaggi\/'\)/);
  assert.doesNotMatch(layout.match(/const ANDROID_SCROLL_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '', /'\/opinioni'|'\/rappresentanti'|'\/candidati'|'\/registrazione-nome'/);
  assert.match(layout, /androidScrollPage \? ' app-main--android-document-scroll'/);
});
test('Android scroll fix restores inner content height and excludes other platforms', () => {
  assert.match(css, /body\.android-device \.app-main\.app-main--android-document-scroll > \.app-main__inner\s*\{[^}]*overflow: visible;/);
  assert.match(css, /body\.android-device \.app-main\.app-main--android-document-scroll\s*\{[^}]*overflow-y: auto !important;/);
  assert.match(css, /html\.demos-mobile-layout body\.android-device \.app-main\.app-main--android-document-scroll \.min-h-screen/);
  assert.match(css, /\.app-main\.app-main--notifiche\s*\{[^}]*overflow-y: hidden !important;/);
});
