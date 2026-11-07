'use strict';

// T-55: read-only runtime identity check. No advisory locks, Firebase,
// account rows, credentials, URLs, IPs or backend PIDs are logged or returned.
// Running a SELECT via the correct-looking pooler URL does not prove that the
// authenticated PostgreSQL user and database are the intended staging pair.
const EXPECTED_RUNTIME_ROLE = 'demos_staging_runtime';
const EXPECTED_STAGING_HASH = '0cbb6ace68a9f11956904e2a37898ec8';

async function verifyCivicStagingRuntimeIdentity(pool) {
  let client;
  let discard = false;
  let inTransaction = false;
  try {
    if (!pool || typeof pool.connect !== 'function') throw new Error('pool missing');
    client = await pool.connect();
    await client.query('BEGIN READ ONLY');
    inTransaction = true;
    const result = await client.query(`
      SELECT current_user::text AS role_name,
             current_database()::text AS database_name,
             md5(i.db_identity::text) AS identity_hash,
             g.blocked AS delivery_blocked
      FROM public.civic_runtime_identity i
      JOIN public.civic_push_delivery_guard g ON g.id = 1
      WHERE i.id = 1
    `);
    const row = result?.rows?.length === 1 ? result.rows[0] : null;
    if (!row || row.role_name !== EXPECTED_RUNTIME_ROLE ||
        row.database_name !== 'postgres' ||
        row.identity_hash !== EXPECTED_STAGING_HASH ||
        row.delivery_blocked !== true) {
      throw new Error('unverified runtime identity');
    }
    await client.query('ROLLBACK');
    inTransaction = false;
    // Deliberately do not return or log identity/hash, host, username or URL.
    return true;
  } catch {
    discard = true;
    if (client && inTransaction) {
      try { await client.query('ROLLBACK'); } catch { /* connection may be lost */ }
    }
    throw new Error('CIVIC_STAGING_SESSION_RUNTIME_IDENTITY_UNVERIFIED');
  } finally {
    if (client) {
      try { client.release(discard); } catch { /* never leak provider details */ }
    }
  }
}

module.exports = { verifyCivicStagingRuntimeIdentity };
