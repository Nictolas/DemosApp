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
    ['notifiche', 'user_id'],
    ['active_sessions', 'user_id'],
    ['user_rights_requests', 'user_id'],
    ['data_processing_limits', 'user_id'],
    ['rate_limit_violations', 'user_id'],
    ['premium_requests', 'userid'],
    ['richieste_premium', 'utente_id'],
    ['richieste_grazia', 'utente_id'],
    ['segnalazioni', 'utente_id'],
    ['notifiche_avvistamenti', 'id_utente'],
    ['notifiche_voti_comuni', 'id_utente'],
    ['notifiche_voti_parlamento', 'id_utente'],
    ['grazia_requests', 'userid'],
    ['candidati', 'user_id'],
    ['mandate_program_snapshots', 'user_id'],
    ['political_programs', 'user_id'],
    ['political_candidacies', 'user_id'],
    ['political_mandates', 'user_id'],
    ['user_providers', 'user_id'],
    ['sessions', 'user_id']
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

  test('strict candidate FK and linked GDPR receipts do not block account deletion', async () => {
    await resetSchema();
    // Matches the production FK default NO ACTION on candidates.
    await pool.query(`ALTER TABLE candidati
      ADD CONSTRAINT candidates_user_fk FOREIGN KEY (user_id)
      REFERENCES users(id) ON DELETE NO ACTION`);
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
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM users WHERE id='u1'")).rows[0].n, 0);
    for (const table of ['candidati', 'political_programs', 'user_rights_requests', 'active_sessions']) {
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "${table}" WHERE payload='owned'`)).rows[0].n, 0, table);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "${table}" WHERE payload='other'`)).rows[0].n, 1, table);
    }
  });

  test('public civic items survive with author references cleared; other users are retained', async () => {
    await resetSchema();
    const nullableColumns = [
      ['eventi', 'creator_user_id'],
      ['eventi', 'approved_by_user_id'],
      ['eventi', 'election_lifecycle_closed_by_user_id'],
      ['referendum_abrogativi', 'userid'],
      ['iniziative_popolari', 'userid'],
      ['governo_attuale', 'user_id'],
      ['programmi', 'user_id_backup'],
      ['civic_process_reconciliation_candidates', 'reviewed_by_user_id'],
      ['civic_processes', 'realized_verified_by_user_id']
    ];
    const tables = new Map();
    for (const [table, column] of nullableColumns) {
      if (!tables.has(table)) tables.set(table, []);
      tables.get(table).push(column);
    }
    for (const [table, columns] of tables) {
      await pool.query(`CREATE TABLE "${table}" (
        id BIGSERIAL PRIMARY KEY,
        ${columns.map(col => `"${col}" TEXT NULL`).join(',')}
      )`);
      for (const col of columns) {
        await pool.query(`INSERT INTO "${table}" ("${col}") VALUES ('u1'), ('u2')`);
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const erased = await PrivacyErasureLedgerService.enforceAccountDeletion(client, 'u1');
      assert.equal(erased.userDeleted, 1);
      assert.equal(erased.rowsUnlinked >= nullableColumns.length, true);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    for (const [table, column] of nullableColumns) {
      const result = await pool.query(`SELECT
        count(*) FILTER (WHERE "${column}"='u1')::int AS old_refs,
        count(*) FILTER (WHERE "${column}"='u2')::int AS other_refs,
        count(*)::int AS kept_rows
        FROM "${table}"`);
      assert.equal(result.rows[0].old_refs, 0, `${table}.${column} leaked account id`);
      assert.equal(result.rows[0].other_refs, 1, `${table}.${column} changed another user`);
      assert.equal(result.rows[0].kept_rows, tables.get(table).length * 2);
    }
  });

  test('non-nullable public references fail closed and rollback all preceding deletions', async () => {
    await resetSchema();
    await pool.query(`CREATE TABLE eventi (
      id BIGSERIAL PRIMARY KEY, creator_user_id TEXT NOT NULL
    )`);
    await pool.query("INSERT INTO eventi(creator_user_id) VALUES ('u1'), ('u2')");
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      await assert.rejects(
        PrivacyErasureLedgerService.enforceAccountDeletion(client, 'u1'),
        (error) => error.code === 'GDPR_ERASURE_REFERENCE_NOT_NULLABLE'
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM users WHERE id='u1'")).rows[0].n, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM opinioni_risposte WHERE user_id='u1'")).rows[0].n, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM eventi WHERE creator_user_id='u1'")).rows[0].n, 1);
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

  test('account deletion diagnostics omit raw errors and post-erasure identifiers', () => {
    const route = fs.readFileSync(path.join(__dirname, '../routes/user/delete-account.js'), 'utf8');
    assert.match(route, /ACCOUNT_DELETION_COMPLETED/);
    assert.match(route, /errorCode:\s*'ACCOUNT_DELETION_FAILED'/);
    assert.doesNotMatch(route, /deletedUserId\s*:/);
    assert.doesNotMatch(route, /error\s*:\s*error\.message/);
    assert.doesNotMatch(route, /console\.error\([^;\n]*,\s*error\s*\)/);
  });

  test('deletion audit does not persist account ID on successful deletion in Axiom or SQL fallback', () => {
    const route = fs.readFileSync(path.join(__dirname, '../routes/user/delete-account.js'), 'utf8');
    const calls = route.match(/await AuditService\.logAction\(\{[\s\S]*?\}\);/g) || [];
    const byAction = new Map(calls.map((call) => {
      const action = call.match(/action:\s*'(ACCOUNT_DELETION_[A-Z]+)'/);
      const userId = call.match(/userId:\s*([^,\n]+)/);
      return [action?.[1], userId?.[1]?.trim()];
    }));
    assert.equal(byAction.size, 3);
    // The start event may survive a completed deletion at either audit provider.
    assert.equal(byAction.get('ACCOUNT_DELETION_STARTED'), 'null');
    assert.equal(byAction.get('ACCOUNT_DELETION_COMPLETED'), 'null');
    // An unsuccessful deletion still has a live account and can be investigated.
    assert.equal(byAction.get('ACCOUNT_DELETION_ERROR'), 'req.user?.id');
    const { buildAxiomAuditEvent } = require('../utils/axiomAuditEvent');
    assert.equal(buildAxiomAuditEvent({ user_id: null, action: 'ACCOUNT_DELETION_STARTED' }).user_id, null);
  });

  test.after(async () => {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.end();
  });
}


test('account deletion handles pool acquisition and rollback failures', async () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/user/delete-account.js'), 'utf8');
  for (const scenario of ['pool_init', 'connect', 'begin_and_rollback', 'success']) {
    let deleteHandler;
    let released = 0;
    const sql = [];
    const audit = [];
    const diagnostics = [];
    const client = {
      async query(statement) {
        sql.push(statement);
        if (scenario === 'begin_and_rollback' && (statement === 'BEGIN' || statement === 'ROLLBACK')) {
          throw new Error('synthetic database failure: do not disclose');
        }
        if (statement.startsWith('SELECT password_hash')) return { rows: [{ password_hash: null }] };
        return { rows: [], rowCount: 1 };
      },
      release() { released += 1; }
    };
    const router = {
      get() {},
      delete(_path, _auth, handler) { deleteHandler = handler; }
    };
    const mockedRequire = (name) => {
      if (name === 'express') return { Router: () => router };
      if (name === '../../middleware/auth') return { verifyToken() {} };
      if (name === '../../services/auditService') {
        return { logAction: async (entry) => { audit.push(entry); return null; } };
      }
      if (name === '../../config/database') {
        return {
          getPool() {
            if (scenario === 'pool_init') throw new Error('synthetic pool init failure: do not disclose');
            return {
              async connect() {
                if (scenario === 'connect') throw new Error('synthetic connect failure: do not disclose');
                return client;
              }
            };
          }
        };
      }
      if (name === 'bcryptjs') return { compare: async () => true };
      if (name === '../../services/privacyErasureLedgerService') {
        return {
          EVENT_TYPES: { ACCOUNT_DELETED: 'account_deleted' },
          recordEvent: async () => {},
          deleteByAnyColumn: async () => {},
          enforceAccountDeletion: async () => ({ userDeleted: 1 })
        };
      }
      throw new Error('Unexpected dependency in isolated deletion test: ' + name);
    };
    const isolatedModule = { exports: {} };
    new Function('require', 'module', 'console', 'process', routeSource)(
      mockedRequire,
      isolatedModule,
      { error: (...args) => diagnostics.push(args.join(' ')) },
      { env: { AXIOM_ENABLED: 'false' } }
    );
    assert.equal(typeof deleteHandler, 'function');
    const response = {
      code: 200,
      status(value) { this.code = value; return this; },
      json(value) { this.body = value; return this; }
    };
    await deleteHandler(
      { user: { id: 'synthetic-only-user' }, body: { confirmText: 'CANCELLA' } },
      response
    );
    if (scenario === 'success') {
      assert.equal(response.code, 200);
      assert.equal(response.body.success, true);
      assert.equal(released, 1);
      assert.ok(sql.includes('COMMIT'));
      assert.deepEqual(
        audit.filter(entry => entry.action !== 'ACCOUNT_DELETION_ERROR').map(entry => entry.userId),
        [null, null]
      );
    } else {
      assert.equal(response.code, 500, scenario);
      assert.equal(response.body.success, false);
      assert.equal(audit.length, 1);
      assert.equal(audit[0].action, 'ACCOUNT_DELETION_ERROR');
      assert.equal(audit[0].details.errorCode, 'ACCOUNT_DELETION_FAILED');
      assert.equal(released, scenario === 'begin_and_rollback' ? 1 : 0);
      if (scenario === 'begin_and_rollback') {
        assert.ok(sql.includes('ROLLBACK'));
        assert.ok(diagnostics.includes('ACCOUNT_DELETION_ROLLBACK_FAILED'));
      }
      assert.doesNotMatch(JSON.stringify(response.body) + diagnostics.join(' '), /do not disclose/);
      assert.ok(diagnostics.includes('ACCOUNT_DELETION_FAILED'));
    }
  }
});
