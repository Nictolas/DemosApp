'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '..', 'routes', 'fcm-tokens.js'), 'utf8');

test('FCM token route tolerates removal of legacy users.fcm_tokens column', () => {
  assert.match(source, /error\?\.code === '42703'/);
  assert.match(source, /SELECT 1 FROM public\.users WHERE id = \$1/);
  assert.match(source, /async function updateLegacyTokens/);
  assert.equal((source.match(/await updateLegacyTokens\(/g) || []).length, 3);
});

test('canonical user_devices storage remains authoritative for write and revoke', () => {
  assert.match(source, /INSERT INTO public\.user_devices/);
  assert.match(source, /is_active = TRUE/);
  assert.match(source, /async function deactivateUserDeviceToken/);
  assert.match(source, /SET is_active = FALSE/);
  assert.match(source, /UPDATE public\.user_devices/);
  assert.match(source, /btrim\(fcm_token\) = \$2/);
  assert.match(source, /btrim\(fcm_token\) <> \$2/);
});
test('versioned migration creates canonical user_devices schema idempotently', () => {
  const migration = fs.readFileSync(path.resolve(__dirname, '..', 'database', 'create-user-devices-table.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_devices/);
  assert.match(migration, /user_id UUID NOT NULL REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(migration, /fcm_token TEXT NOT NULL UNIQUE/);
  assert.match(migration, /is_active BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_user_devices_user_active/);
});
