'use strict';
// CI: no database network access, secrets, or production modifications.
const test = require('node:test');
const assert = require('node:assert/strict');

test('legacy privacy routes use a lazy alias of the canonical TLS pool', async () => {
  const canonicalPath = require.resolve('../config/database');
  const legacyPath = require.resolve('../config/db');
  const oldCanonical = require.cache[canonicalPath];
  const oldLegacy = require.cache[legacyPath];
  const requests = [];
  let getPoolCalls = 0;
  const connection = { release() {} };
  const mockPool = {
    async query(...args) {
      requests.push(args);
      return {rows:[{ synthetic: true }]};
    },
    async connect() {
      return connection;
    }
  };
  try {
    // Stub the canonical singleton before importing the compatibility route.
    require.cache[canonicalPath] = {
      id: canonicalPath, filename: canonicalPath, loaded: true,
      exports: {
        getPool() { getPoolCalls++; return mockPool; }
      }
    };
    delete require.cache[legacyPath];
    const db = require('../config/db');
    assert.equal(getPoolCalls, 0, 'import must not open a second pool');
    assert.equal(typeof db.pool.query, 'function');
    assert.equal(typeof db.pool.connect, 'function');
    assert.equal(typeof db.query, 'function', 'privacy-settings uses db.query');

    assert.deepEqual(await db.pool.query('SELECT $1::integer AS synthetic', [1]),
      {rows:[{synthetic:true}]});
    assert.deepEqual(await db.query('SELECT $1::integer AS synthetic', [2]),
      {rows:[{synthetic:true}]});
    assert.equal(await db.pool.connect(), connection);
    assert.equal(getPoolCalls, 3);
    assert.deepEqual(requests.map(args => args[1]), [[1],[2]]);
    assert.equal(Object.prototype.hasOwnProperty.call(db.pool,'end'), false,
      'legacy route must not own or close the singleton');
  } finally {
    delete require.cache[legacyPath];
    if (oldLegacy) require.cache[legacyPath] = oldLegacy;
    if (oldCanonical) require.cache[canonicalPath] = oldCanonical;
    else delete require.cache[canonicalPath];
  }
});

test('real canonical pool keeps Supabase CA verification despite URL sslmode override', () => {
  const canonicalPath = require.resolve('../config/database');
  const oldCanonical = require.cache[canonicalPath];
  const previous = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL =
      'postgresql://synthetic:not-a-secret@db.example.supabase.co:5432/postgres' +
      '?sslmode=disable&sslaccept=accept_invalid_certs&pgbouncer=true';
    delete require.cache[canonicalPath];
    const {poolConfig} = require('../config/database');
    assert.equal(poolConfig.ssl.rejectUnauthorized, true,
      'real Supabase certificates must be verified');
    assert.ok(typeof poolConfig.ssl.ca === 'string' && poolConfig.ssl.ca.length > 100);
    assert.ok(!poolConfig.connectionString.includes('sslmode='));
    assert.ok(!poolConfig.connectionString.includes('sslaccept='));
    assert.ok(poolConfig.connectionString.includes('pgbouncer=true'));
    // We DO NOT call getPool(): this test makes zero network connections.
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    delete require.cache[canonicalPath];
    if (oldCanonical) require.cache[canonicalPath] = oldCanonical;
  }
});
