const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const PrivacyErasureLedgerService = require('../services/privacyErasureLedgerService');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const isLocalTestDatabase = Boolean(
  testDatabaseUrl && /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(testDatabaseUrl)
);

if (!isLocalTestDatabase) {
  test('account deletion integration requires an isolated local PostgreSQL database', {
    skip: 'Set TEST_DATABASE_URL to a localhost-only disposable PostgreSQL database'
  }, () => {});
} else {
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 4 });

  const linkedTables = [
    ['opinioni_risposte', 'user_id'],
    ['voti_elezioni', 'user_id'],
    ['voti_capo_stato', '"userId"'],
    ['voti_ice', 'utente_id'],
    ['voti_referendum_abrogativi', 'userid'],
    ['voti_amnistia', 'userid'],
    ['voti_grazia', 'userid'],
    ['voti_iniziative_popolari', 'userid'],
    ['voti_ministri', 'user_id'],
    ['voti_opinioni_proposte', 'utente_id'],
    ['voti_primo_ministro', 'userid'],
    ['voti_difesa', 'userid'],
    ['voti_economia', 'userid'],
    ['voti_esteri', 'userid'],
    ['voti_giustizia', 'userid'],
    ['voti_interno', 'userid'],
    ['voti_istruzione', 'userid'],
    ['voti_lavoro', 'userid'],
    ['voti_salute', 'userid'],
    ['voti_trasporti', 'userid'],
    ['voti_ambiente', 'userid'],
    ['voti_ambiente_sicurezza_energetica', 'userid'],
    ['voti_cultura', 'userid'],
    ['voti_sport', 'userid'],
    ['consenso_governo', 'userid'],
    ['consenso_capo_stato', 'userid'],
    ['candidature_elezioni', 'user_id'],
    ['notifiche', 'user_id']
  ];

  const resetSchema = async () => {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)`);
    await pool.query(`
      CREATE TABLE identity_verifications (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT UNIQUE,
        person_key TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL DEFAULT 'CIE'
      )
    `);

    for (const [table, column] of linkedTables) {
      await pool.query(`CREATE TABLE "${table}" (id BIGSERIAL PRIMARY KEY, ${column} TEXT, payload TEXT)`);
    }

    await pool.query(`INSERT INTO users (id, email) VALUES ('u1', 'one@test'), ('u2', 'two@test')`);
    await pool.query(`
      INSERT INTO identity_verifications (user_id, person_key)
      VALUES ('u1', 'same-person-key'), ('u2', 'other-person-key')
    `);
    for (const [table, column] of linkedTables) {
      await pool.query(
        `INSERT INTO "${table}" (${column}, payload) VALUES ($1, 'owned'), ($2, 'other')`,
        ['u1', 'u2']
      );
    }
  };

  test('account deletion removes all known user votes/opinions across historical ID column variants', async () => {
    await resetSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await PrivacyErasureLedgerService.enforceAccountDeletion(client, 'u1');
      assert.equal(result.userDeleted, 1);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const deletedUser = await pool.query(`SELECT 1 FROM users WHERE id = 'u1'`);
    assert.equal(deletedUser.rowCount, 0);
    const otherUser = await pool.query(`SELECT 1 FROM users WHERE id = 'u2'`);
    assert.equal(otherUser.rowCount, 1);

    for (const [table, column] of linkedTables) {
      const owned = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}" WHERE ${column} = 'u1'`);
      const other = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}" WHERE ${column} = 'u2'`);
      assert.equal(owned.rows[0].count, 0, `${table} still contains u1 data`);
      assert.equal(other.rows[0].count, 1, `${table} removed another user's data`);
    }
  });

  test('RP-05 deletes the detached CIE anti-duplication key so the same person may register again', async () => {
    await resetSchema();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await PrivacyErasureLedgerService.enforceAccountDeletion(client, 'u1');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const oldIdentity = await pool.query(`SELECT * FROM identity_verifications WHERE user_id = 'u1'`);
    assert.equal(oldIdentity.rowCount, 0);

    await pool.query(`INSERT INTO users (id, email) VALUES ('u3', 'three@test')`);
    const recreated = await pool.query(
      `INSERT INTO identity_verifications (user_id, person_key)
       VALUES ('u3', 'same-person-key') RETURNING user_id, person_key`
    );
    assert.deepEqual(recreated.rows[0], { user_id: 'u3', person_key: 'same-person-key' });
  });

  test('canonical delete-account route delegates to schema-aware enforcement instead of hardcoded vote columns', () => {
    const route = fs.readFileSync(path.join(__dirname, '../routes/user/delete-account.js'), 'utf8');
    assert.match(route, /PrivacyErasureLedgerService\.enforceAccountDeletion\(client, userId\)/);
    assert.doesNotMatch(route, /DELETE FROM voti_[a-z0-9_]+ WHERE user_id = \$1/i);
    assert.doesNotMatch(route, /UPDATE identity_verifications[\s\S]*detached_at/i);
  });

  test.after(async () => {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.end();
  });
}
