'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertCivicSessionLockCompatible } = require('../services/civicSessionLockSafety');

const sessionUrl = 'postgresql://postgres:ci-fake@aws-0-eu.pooler.supabase.com:5432/postgres';
const transactionalUrl = 'postgresql://postgres:ci-fake@aws-0-eu.pooler.supabase.com:6543/postgres';

test('session lock requires positive operator verification, even for a plausible session URL', () => {
  assert.throws(() => assertCivicSessionLockCompatible({
    databaseUrl: sessionUrl, manuallyVerified: false,
  }), /CIVIC_SESSION_LOCK_NOT_VERIFIED/);
  assert.equal(assertCivicSessionLockCompatible({
    databaseUrl: sessionUrl, manuallyVerified: true,
  }), true);
});

test('rejects 6543 Supavisor or other transaction-pooler endpoints with no override', () => {
  for (const databaseUrl of [
    transactionalUrl,
    'postgresql://postgres:pw@db.anywhere.test:6543/postgres',
    'postgresql://postgres:pw@db.project.supabase.co:6543/postgres',
    sessionUrl + '?pgbouncer=true',
    sessionUrl + '?pool_mode=transaction',
    sessionUrl + '?host=db.example.test',
    sessionUrl + '?hostaddr=198.51.100.12',
    sessionUrl + '?service=production',
    sessionUrl + '?options=-c%20search_path%3Dpublic',
    'postgresql://postgres:pw@aws-0-eu.pooler.supabase.com:6432/postgres',
  ]) {
    assert.throws(() => assertCivicSessionLockCompatible({
      databaseUrl, manuallyVerified: true,
    }), /CIVIC_SESSION_LOCK_UNSAFE_POOLER_MODE/);
  }
});

test('missing or invalid URLs reject before SQL and without exposing credentials', () => {
  for (const databaseUrl of [null, undefined, '', 'PRIVATE_DATABASE_PASSWORD',
    'https://user:password@db.example.test/postgres', 'postgresql://db.example.test/']) {
    assert.throws(() => assertCivicSessionLockCompatible({
      databaseUrl, manuallyVerified: true,
    }), error => error.message.startsWith('CIVIC_SESSION_LOCK_') &&
      !error.message.includes('password') &&
      !error.message.includes('PRIVATE_DATABASE_PASSWORD'));
  }
});

test('allowed direct and local session URLs are still subject to manual verification', () => {
  for (const databaseUrl of [
    'postgresql://postgres:ci-fake@db.project.supabase.co:5432/postgres',
    'postgresql://postgres:ci-fake@127.0.0.1:5432/civic_ci',
    'postgresql://postgres:ci-fake@postgres.example.test:5432/app_db',
  ]) {
    assert.equal(assertCivicSessionLockCompatible({
      databaseUrl, manuallyVerified: true,
    }), true);
  }
});

test('central session lock blocks unsafe pool mode before running SQL', async () => {
  const { acquireCivicPushDeliveryLock } = require('../services/civicPushDeliveryGuard');
  let queryCount = 0;
  const fakeDb = { query: async () => { queryCount++; return { rows: [] }; } };
  const oldUrl = process.env.DATABASE_URL;
  const oldFlag = process.env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED;
  try {
    process.env.DATABASE_URL = transactionalUrl;
    process.env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED = 'true';
    await assert.rejects(acquireCivicPushDeliveryLock(fakeDb),
      /CIVIC_SESSION_LOCK_UNSAFE_POOLER_MODE/);
    assert.equal(queryCount, 0);

    process.env.DATABASE_URL = sessionUrl;
    process.env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED = 'false';
    await assert.rejects(acquireCivicPushDeliveryLock(fakeDb),
      /CIVIC_SESSION_LOCK_NOT_VERIFIED/);
    assert.equal(queryCount, 0);

    process.env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED = 'true';
    await acquireCivicPushDeliveryLock(fakeDb);
    assert.equal(queryCount, 1);
  } finally {
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    if (oldFlag === undefined) delete process.env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED;
    else process.env.CIVIC_SESSION_LOCK_CONNECTION_VERIFIED = oldFlag;
  }
});
