'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('mobile layout boundary remains explicit and native Capacitor always uses mobile navigation', () => {
  const useMobile = read('client/src/hooks/use-mobile.tsx');
  const useMobileLayout = read('client/src/hooks/useMobileLayout.ts');
  assert.match(useMobile, /MOBILE_BREAKPOINT\s*=\s*768/);
  assert.match(useMobileLayout, /Capacitor\.isNativePlatform\(\)/);
  assert.match(useMobileLayout, /return true/);
});

test('RobustAppLayout renders mutually exclusive desktop header and mobile navbar', () => {
  const layout = read('client/src/components/RobustAppLayout.tsx');
  assert.match(layout, /showMobileNavbar\s*=\s*isMobileLayout\s*&&\s*showAppNav/);
  assert.match(layout, /showDesktopHeader\s*=\s*!isMobileLayout\s*&&\s*showAppNav/);
  assert.match(layout, /aria-label="Navigazione principale"/);
  assert.match(layout, /<DesktopAppHeader\s*\/>/);
  assert.match(layout, /<Navbar\s*\/>/);
});

test('mobile navbar occupies its own layout row instead of overlaying app content', () => {
  const css = read('client/src/robust-layout.css');
  assert.match(css, /\.demos-mobile-layout \.robust-app-layout__content\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto/);
  assert.match(css, /\.demos-mobile-layout \.robust-app-layout__content > \.app-navbar\s*\{[\s\S]*margin-top:\s*0/);
});

test('Android canonical override removes legacy fixed-height plus 56px clipping combination', () => {
  const css = read('client/src/css/android-navbar-fix.css');
  const marker = css.indexOf('CANONICAL ANDROID NAVBAR OVERRIDE');
  assert.ok(marker >= 0, 'canonical Android override must exist');
  const canonical = css.slice(marker);
  assert.match(canonical, /body\.android-device \.app-navbar\s*\{[\s\S]*height:\s*auto\s*!important/);
  assert.match(canonical, /body\.android-device \.app-navbar nav\.app-bottom-nav\s*\{[\s\S]*height:\s*auto\s*!important/);
  assert.match(canonical, /--app-navbar-bottom-gap:\s*min\(var\(--app-navbar-safe-bottom\), 14px\)/);
  assert.doesNotMatch(canonical, /max\(env\(safe-area-inset-bottom\),\s*56px\)/);
  assert.match(canonical, /min-height:\\s*calc\\(3\\.75rem \\+ var\\(--app-navbar-bottom-gap\\)\\)/);
  assert.match(canonical, /body\\.android-device \\.app-navbar \\.app-bottom-nav a\\s*\\{[\\s\\S]*min-height:\\s*44px/);
  assert.match(canonical, /align-items:\\s*center\\s*!important/);
  assert.doesNotMatch(canonical, /height:\\s*6rem\\s*!important/);
  assert.doesNotMatch(canonical, /padding-bottom:\\s*calc\\(1rem \\+ max/);
});

test('responsive audit matrix covers compact mobile, Android, landscape, tablet boundary and desktop', () => {
  const matrix = read('client/test-navbar-responsive-matrix.html');
  for (const fixture of [
    'small-web-320x568',
    'compact-android-360x640',
    'android-360x800',
    'iphone-web-390x844',
    'large-web-430x932',
    'landscape-android-667x375',
    'tablet-boundary-768x1024',
    'desktop-1024x768',
    'desktop-wide-1440x900',
  ]) {
    assert.match(matrix, new RegExp(fixture));
  }
  assert.match(matrix, /MATRIX PASS/);
});
