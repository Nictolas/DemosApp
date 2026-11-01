'use strict';

const crypto = require('node:crypto');

// This is NOT the connection URL or a client-visible token. The marker is a
// random UUID installed once by the civic migration. Never log or return it.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function assertCivicDatabaseIdentity(db, {
  expectedId = process.env.CIVIC_RUNTIME_DATABASE_ID,
} = {}) {
  if (typeof expectedId !== 'string' || !UUID.test(expectedId)) {
    throw new Error('CIVIC_DATABASE_IDENTITY_NOT_CONFIGURED');
  }
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('CIVIC_DATABASE_CONNECTION_REQUIRED');
  }

  let result;
  try {
    result = await db.query(
      'SELECT db_identity::text AS db_identity FROM civic_runtime_identity WHERE id = 1'
    );
  } catch {
    throw new Error('CIVIC_DATABASE_IDENTITY_UNAVAILABLE');
  }

  const actual = result?.rows?.[0]?.db_identity;
  const expected = expectedId.toLowerCase();
  if (result?.rows?.length !== 1 || typeof actual !== 'string' || !UUID.test(actual)) {
    throw new Error('CIVIC_DATABASE_IDENTITY_MISMATCH');
  }
  const a = Buffer.from(actual.toLowerCase());
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('CIVIC_DATABASE_IDENTITY_MISMATCH');
  }
  return true;
}

module.exports = { assertCivicDatabaseIdentity };
