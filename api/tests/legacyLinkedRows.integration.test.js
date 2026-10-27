const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const Erasure = require('../services/privacyErasureLedgerService');

const uri = process.env.TEST_DATABASE_URL || '';
if (!uri.endsWith('@localhost:5432/privacy_synthetic')) {
  test('fixture requires local database', {skip: true}, () => {});
} else {
  test('cleanup handles restrictive linked notifications with isolated fixtures', async () => {
    const pool = new Pool({connectionString: uri});
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query('CREATE TABLE users(id text primary key)');
      for (const [table,col] of [['notifiche_demos','id_utente'],['notifiche_comunali','id_utente'],['programmi','utente_id'],['political_selections','user_id']]) {
        await pool.query(`CREATE TABLE "${table}"(id serial primary key, "${col}" text REFERENCES users(id) ON DELETE RESTRICT)`);
      }
      await pool.query("INSERT INTO users(id) VALUES('fixture1'),('fixture2')");
      for (const [table,col] of [['notifiche_demos','id_utente'],['notifiche_comunali','id_utente'],['programmi','utente_id'],['political_selections','user_id']]) {
        await pool.query(`INSERT INTO "${table}"("${col}") VALUES('fixture1'),('fixture2')`);
      }
      // Explicit fixture provisioning models a preinstalled production ledger.
      // GDPR events must never create public tables mid-request.
      await Erasure.ensureTable(pool);
      const protection = await pool.query(`
        SELECT relrowsecurity AS rls
        FROM pg_catalog.pg_class
        WHERE oid = 'public.privacy_erasure_ledger'::regclass
      `);
      assert.equal(protection.rows[0].rls,true);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await Erasure.recordEvent(client,{userId:'fixture1',eventType:'account_deleted',details:{source:'synthetic'}});
        const result = await Erasure.enforceAccountDeletion(client,'fixture1');
        assert.equal(result.userDeleted,1);
        await client.query('COMMIT');
      } catch(e) {await client.query('ROLLBACK');throw e;} finally {client.release();}
      const users = await pool.query('SELECT id FROM users');
      assert.deepEqual(users.rows,[{id:'fixture2'}]);
      for (const [table,col] of [['notifiche_demos','id_utente'],['notifiche_comunali','id_utente'],['programmi','utente_id'],['political_selections','user_id']]) {
        const r = await pool.query(`SELECT "${col}" AS uid FROM "${table}"`);
        assert.deepEqual(r.rows,[{uid:'fixture2'}]);
      }
    } finally {await pool.end();}
  });
}
