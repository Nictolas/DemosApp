'use strict';

const { assertCivicSessionLockCompatible } = require('./civicSessionLockSafety');

/**
 * Negative-only, read-only PostgreSQL session affinity preflight.
 *
 * pg_backend_pid() can expose an unsafe transaction pooler if a checked-out
 * pg client switches backend between queries, or two simultaneously held
 * clients share a backend. Stable readings are NOT evidence of session
 * affinity and never authorize enabling civic pushes.
 *
 * No advisory locks, transactions, data reads or FCM calls. PIDs, URLs and
 * account information are never returned or logged.
 */
async function probeCivicSessionAffinity(pool, {
  apply = false,
  confirmed = false,
  environment = '',
  databaseUrl = process.env.DATABASE_URL,
  rounds = 6,
} = {}) {
  if (!apply) {
    return {
      dryRun: true,
      result: 'NOT_TESTED',
      compatible: false,
      operatorReviewRequired: true,
    };
  }
  if (confirmed !== true || environment !== 'staging') {
    throw new Error('CIVIC_SESSION_PROBE_STAGING_CONFIRMATION_REQUIRED');
  }
  if (!Number.isSafeInteger(rounds) || rounds < 2 || rounds > 20) {
    throw new RangeError('CIVIC_SESSION_PROBE_ROUNDS_INVALID');
  }

  // The explicit command confirmation is only permission to *observe*.
  // It is not approval of the session-mode connection for actual pushes.
  assertCivicSessionLockCompatible({
    databaseUrl,
    manuallyVerified: true,
  });
  if (!pool || typeof pool.connect !== 'function') {
    throw new TypeError('CIVIC_SESSION_PROBE_POOL_REQUIRED');
  }
  if (pool.options && Number(pool.options.max) < 2) {
    throw new Error('CIVIC_SESSION_PROBE_REQUIRES_TWO_CONNECTIONS');
  }

  const connections = [];
  let discard = false;
  try {
    connections.push(await pool.connect());
    connections.push(await pool.connect());

    const seen = [null, null];
    let mismatch = false;
    for (let round = 0; round < rounds; round++) {
      for (let index = 0; index < 2; index++) {
        const query = await connections[index].query(
          'SELECT pg_backend_pid()::text AS pid'
        );
        const pid = query?.rows?.[0]?.pid;
        if (query?.rows?.length !== 1 ||
          typeof pid !== 'string' || !/^[0-9]+$/.test(pid)) {
          throw new Error('CIVIC_SESSION_PROBE_UNREADABLE');
        }
        if (seen[index] && seen[index] !== pid) mismatch = true;
        seen[index] = pid;
      }
      if (seen[0] === seen[1]) mismatch = true;
    }

    return {
      dryRun: false,
      result: mismatch ? 'UNSAFE_AFFINITY_OBSERVED' : 'INCONCLUSIVE',
      compatible: false,
      operatorReviewRequired: true,
    };
  } catch {
    discard = true;
    throw new Error('CIVIC_SESSION_PROBE_UNAVAILABLE');
  } finally {
    for (const conn of connections) {
      // A failed query can leave connection state unknown; discard it.
      try { conn.release(discard); } catch { /* do not expose client error */ }
    }
  }
}

module.exports = { probeCivicSessionAffinity };
