'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('responsive audit mounts the real main-screen React components', () => {
  const audit = read('client/src/audit/MainScreensResponsiveAudit.tsx');
  for (const pageImport of [
    '@/pages/Preferiti',
    '@/pages/Opinioni',
    '@/pages/Eventi',
    '@/pages/Menu',
    '@/pages/Impostazioni',
    '@/pages/Profilo',
  ]) {
    assert.match(audit, new RegExp(pageImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(audit, /horizontal-document-overflow/);
  assert.match(audit, /horizontal-main-overflow/);
  assert.match(audit, /interactive-\$\{index \+ 1\}-horizontal-clip/);
});

test('responsive audit cannot contact production or staging APIs', () => {
  const audit = read('client/src/audit/MainScreensResponsiveAudit.tsx');
  assert.match(audit, /window\.fetch\s*=\s*async/);
  assert.match(audit, /Audit-only fallback|return jsonResponse\(\{ success: true, data: \[\], count: 0 \}\)/);
  assert.doesNotMatch(audit, /demos-c7k0\.onrender\.com/);
  assert.doesNotMatch(audit, /demos-functional-staging\.onrender\.com/);
});

test('responsive matrix covers six main screens across compact, Android, iPhone-sized and landscape viewports', () => {
  const matrix = read('client/test-main-screens-responsive-matrix.html');
  for (const screen of ['preferiti','opinioni','eventi','menu','impostazioni','profilo']) {
    assert.match(matrix, new RegExp(`['\"]${screen}['\"]`));
  }
  for (const fixture of [
    'small-web-320x568',
    'compact-android-360x640',
    'android-360x800',
    'iphone-web-390x844',
    'large-web-430x932',
    'landscape-android-667x375',
  ]) {
    assert.match(matrix, new RegExp(fixture));
  }
  assert.match(matrix, /MATRIX PASS/);
});

test('stress fixtures include long event and profile content', () => {
  const audit = read('client/src/audit/MainScreensResponsiveAudit.tsx');
  assert.match(audit, /Manifestazione nazionale per democrazia partecipativa e trasparenza istituzionale/);
  assert.match(audit, /Alessandromassimiliano/);
  assert.match(audit, /Responsività-Democratica/);
});
