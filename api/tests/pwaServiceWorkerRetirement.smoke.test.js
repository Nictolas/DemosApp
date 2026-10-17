'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const main = fs.readFileSync(path.join(root, 'client/src/main.tsx'), 'utf8');
const legacyWorker = fs.readFileSync(path.join(root, 'client/public/sw.js'), 'utf8');
const fcmWorker = fs.readFileSync(path.join(root, 'client/public/firebase-messaging-sw.js'), 'utf8');

test('legacy PWA worker retires instead of caching app shell', () => {
  assert.match(legacyWorker, /self\.skipWaiting\(\)/);
  assert.match(legacyWorker, /self\.registration\.unregister\(\)/);
  assert.match(legacyWorker, /caches\.delete\(name\)/);
  assert.doesNotMatch(legacyWorker, /addEventListener\(['"]fetch['"]/);
  assert.doesNotMatch(legacyWorker, /caches\.match\(/);
});

test('web startup clears only legacy DEMOS caches and preserves FCM worker', () => {
  assert.match(main, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(main, /pathname === "\/sw\.js"/);
  assert.match(main, /registration\.unregister\(\)/);
  assert.match(main, /\^demos-v/);
  assert.doesNotMatch(main, /navigator\.serviceWorker\.register\(['"]\/sw\.js/);
  assert.match(fcmWorker, /firebase/i);
});
