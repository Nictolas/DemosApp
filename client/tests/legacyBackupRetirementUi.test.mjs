'use strict';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const file = readFileSync(new URL('../src/pages/BackupDashboard.tsx', import.meta.url), 'utf8');

test('legacy backup page makes zero requests and exposes no deprecated actions', () => {
  assert.doesNotMatch(file, /\bapiRequest\b|\bfetch\s*\(|\baxios\b|useEffect\s*\(/);
  assert.doesNotMatch(file, /\/admin\/backup\/(list|stats|config|verify|restore|job)/);
  assert.doesNotMatch(file, /\bhandleAction\b|onClick\s*=|Ripristina\s*<\/Button>/);
});

test('page communicates retirement and unresolved recovery gate', () => {
  assert.match(file, /Backup applicativo legacy ritirato/);
  assert.match(file, /Ripristino non ancora certificato/);
  assert.match(file, /database, del registro GDPR e della conservazione B2/);
});
