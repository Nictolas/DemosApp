'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const notice = fs.readFileSync(path.join(root, 'client/src/components/WebAppUpdateNotice.tsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'client/src/App.tsx'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'client/src/main.tsx'), 'utf8');

test('web/PWA checks version of content-hashed main JS bundle on resume, not database', () => {
  assert.match(notice, /MAIN_BUNDLE_PATTERN/);
  assert.match(notice, /visibilitychange/);
  assert.match(notice, /pageshow/);
  assert.match(notice, /CHECK_INTERVAL_MS = 15 \* 60 \* 1000/);
  assert.match(notice, /fetch\(url\.toString\(\)/);
  assert.match(notice, /cache: "no-store"/);
  assert.match(notice, /credentials: "omit"/);
  assert.doesNotMatch(notice, /apiRequest|supabase|auth_token|Authorization/);
});

test('native builds skip web refresh and unsaved forms are protected by explicit action', () => {
  assert.match(notice, /Capacitor\?\.isNativePlatform/);
  assert.match(notice, /onClick=\{applyUpdate\}/);
  assert.match(notice, /onClick=\{\(\) => setDismissed\(true\)\}/);
  assert.match(notice, /__demos_ui/);
  assert.doesNotMatch(notice, /window\.location\.reload\(\)/);
  assert.match(app, /<WebAppUpdateNotice \/>/);
});

test('legacy worker is still retired; update check does not re-register it', () => {
  assert.match(sw, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.doesNotMatch(sw, /navigator\.serviceWorker\.register\(['"]\/sw\.js/);
});
