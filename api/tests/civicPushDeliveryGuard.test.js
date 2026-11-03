'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readCivicDeliveryBarrier, blockCivicDeliveryOnRevocationFailure } = require('../services/civicPushDeliveryGuard');

function db({ guard = [{ blocked: false }], inactive = [{ unsafe: false }], failAt = 0 } = {}) {
  const calls = [];
  return { calls, async query(sql) {
    calls.push(String(sql));
    if (failAt === calls.length) throw new Error('SYNTHETIC_DATABASE_OUTAGE');
    return { rows: calls.length === 1 ? guard : inactive };
  } };
}

test('delivery guard permits sends only with unblocked guard and no inactive devices', async () => {
  const pool = db();
  assert.deepEqual(await readCivicDeliveryBarrier(pool), { blocked: false, reason: 'CIVIC_DELIVERY_GUARD_BLOCKED' });
  assert.equal(pool.calls.length, 2);
  assert.match(pool.calls[1], /user_devices/);
  assert.match(pool.calls[1], /u\.status/);
});

test('blocked or missing guard never queries recipients', async () => {
  for (const guard of [[], [{ blocked: true }], [{ blocked: null }]]) {
    const pool = db({ guard });
    assert.equal((await readCivicDeliveryBarrier(pool)).blocked, true);
    assert.equal(pool.calls.length, 1);
  }
});

test('inactive, unknown or ambiguous device status fails closed', async () => {
  for (const inactive of [[], [{ unsafe: true }], [{ unsafe: null }], [{ unsafe: false }, { unsafe: false }]]) {
    const pool = db({ inactive });
    assert.equal((await readCivicDeliveryBarrier(pool)).blocked, true);
  }
});

test('database failures cannot be converted to a delivery approval', async () => {
  for (const failAt of [1, 2]) {
    await assert.rejects(readCivicDeliveryBarrier(db({ failAt })), /SYNTHETIC_DATABASE_OUTAGE/);
  }
});

test('uncertain revocation globally blocks delivery; missing guard row is an error', async () => {
  const calls = [];
  const client = { async query(sql) { calls.push(sql); return { rows: [{ id: 1 }] }; } };
  await blockCivicDeliveryOnRevocationFailure(client);
  assert.match(calls[0], /SET blocked = TRUE/);
  assert.match(calls[0], /REVOCATION_UNCERTAIN/);
  await assert.rejects(blockCivicDeliveryOnRevocationFailure({ query: async () => ({ rows: [] }) }), /CIVIC_DELIVERY_GUARD_NOT_INITIALIZED/);
});

test('advisory unlock failure is never silently treated as a successful push mutation', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../services/civicPushDeliveryGuard.js'), 'utf8');
  const lockScope = source.slice(source.indexOf('async function withCivicPushDeliveryLock('), source.indexOf('\nmodule.exports'));
  assert.match(lockScope, /await releaseCivicPushDeliveryLock\(client\)/);
  assert.match(lockScope, /catch\s*\{\s*discard = true;[\s\S]*?throw new Error\('CIVIC_DELIVERY_LOCK_RELEASE_FAILED'\)/);
  assert.match(lockScope, /client\.release\(discard\)/);
});

test('malformed database query results never authorize topic delivery', async () => {
  for (const malformed of [null, undefined, {}, { rows: null }, { rows: [null] }, { rows: 'invalid' }]) {
    const guardDb = { async query() { return malformed; } };
    assert.equal((await readCivicDeliveryBarrier(guardDb)).blocked, true);
    const inactiveDb = { calls: 0, async query() {
      this.calls += 1;
      return this.calls === 1 ? { rows: [{ blocked: false }] } : malformed;
    } };
    assert.equal((await readCivicDeliveryBarrier(inactiveDb)).blocked, true);
  }
});
