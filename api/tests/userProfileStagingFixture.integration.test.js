'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const pgTest = process.env.PROFILE_READ_PG_INTEGRATION === '1' ? test : test.skip;
const databasePath = path.join(__dirname, '..', 'database');

pgTest('PostgreSQL 17: private synthetic staging fixture has parity, isolation, and repeatable rollback', async () => {
  const db = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
  });
  await db.connect();
  try {
    // Only test-container PostgreSQL lacks the standard Supabase API roles.
    // This local test never connects to production or Supabase staging.
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await db.query(`DO $role$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
          CREATE ROLE ${role} NOLOGIN;
        END IF;
      END $role$;`);
    }
    const fixture = fs.readFileSync(path.join(databasePath, 'qa-user-profile-staging-isolated.sql'), 'utf8');
    const rollbackTest = fs.readFileSync(path.join(databasePath, 'qa-user-profile-staging-backfill-rollback-test.sql'), 'utf8');
    await db.query(fixture);
    await db.query(fixture); // Reapplying must not create duplicate rows.
    const territoryFixture = fs.readFileSync(path.join(databasePath, 'qa-user-profile-territory-trigger-fixture.sql'), 'utf8');
    const territoryCutoverTest = fs.readFileSync(path.join(databasePath, 'qa-user-profile-territory-cutover-rollback-test.sql'), 'utf8');
    await db.query(territoryFixture);
    await db.query(territoryCutoverTest); // Test trigger ownership switch, NULL, authority and DDL rollback.
    const territoryState = (await db.query(`SELECT COUNT(*)::integer AS rows FROM qa_user_profile_20261028.user_political_territories`)).rows[0];
    assert.equal(territoryState.rows, 0, 'all synthetic territory writes were rolled back');
    const before = (await db.query(`SELECT
      (SELECT COUNT(*)::integer FROM qa_user_profile_20261028.users) AS users,
      (SELECT COUNT(*)::integer FROM qa_user_profile_20261028.user_profile) AS profiles,
      (SELECT COUNT(*)::integer FROM qa_user_profile_20261028.users u
        LEFT JOIN qa_user_profile_20261028.user_profile p ON p.user_id = u.id
        WHERE p.user_id IS NULL) AS missing`)).rows[0];
    assert.deepEqual(before, { users: 8, profiles: 7, missing: 1 });
    await db.query(rollbackTest); // All write paths run within rollback-only subtransaction.
    const after = (await db.query(`SELECT
      (SELECT COUNT(*)::integer FROM qa_user_profile_20261028.users) AS users,
      (SELECT COUNT(*)::integer FROM qa_user_profile_20261028.user_profile) AS profiles,
      (SELECT COUNT(*)::integer FROM qa_user_profile_20261028.users u
        LEFT JOIN qa_user_profile_20261028.user_profile p ON p.user_id = u.id
        WHERE p.user_id IS NULL) AS missing,
      (SELECT comune_residenza FROM qa_user_profile_20261028.users
        WHERE id='00000000-0000-4000-8000-000000000101') AS original_municipality`)).rows[0];
    assert.deepEqual(after, { ...before, original_municipality: 'Pisa' });
    const isolation = (await db.query(`SELECT
      has_schema_privilege('anon', 'qa_user_profile_20261028', 'USAGE') AS anon,
      has_schema_privilege('authenticated', 'qa_user_profile_20261028', 'USAGE') AS authenticated,
      has_schema_privilege('service_role', 'qa_user_profile_20261028', 'USAGE') AS service_role`)).rows[0];
    assert.deepEqual(isolation, { anon: false, authenticated: false, service_role: false });
    const parity = (await db.query(`SELECT COUNT(*)::integer AS mismatched
      FROM qa_user_profile_20261028.users u
      LEFT JOIN qa_user_profile_20261028.user_profile p ON p.user_id=u.id
      WHERE u.id IN ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000103')
        AND COALESCE(p.comune_residenza,u.comune_residenza) IS DISTINCT FROM u.comune_residenza`)).rows[0];
    assert.equal(parity.mismatched, 0);
  } finally {
    await db.end();
  }
});
