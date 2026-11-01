'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IMPORTANT_TABLES, ROLE_SQL, TABLE_SQL, assess, inspectPool } = require('../scripts/attest-db-writer-role');

const role = (extra = {}) => ({
  current_role: 'demos_runtime',
  session_role: 'demos_runtime',
  current_bypassrls: false,
  session_bypassrls: false,
  current_superuser: false,
  ...extra
});
const tables = () => IMPORTANT_TABLES.map(table_name => ({
  table_name,
  rls_enabled: true,
  force_rls: true,
  current_role_is_owner: false,
  can_select: true,
  can_insert: false,
  can_update: false,
  can_delete: false
}));

test('only read-only metadata/catalog queries are used', () => {
  assert.match(ROLE_SQL, /current_user/);
  assert.match(ROLE_SQL, /session_user/);
  assert.match(ROLE_SQL, /rolbypassrls/);
  assert.match(TABLE_SQL, /pg_class/);
  assert.match(TABLE_SQL, /pg_namespace/);
  assert.match(TABLE_SQL, /relforcerowsecurity/);
  assert.doesNotMatch(ROLE_SQL + TABLE_SQL, /\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE|COPY\s+\w+)\b/i);
});

test('privileged current/session roles fail closed even if RLS is enabled', () => {
  for (const value of [
    role({ current_bypassrls: true }),
    role({ session_bypassrls: true }),
    role({ current_superuser: true })
  ]) assert.equal(assess(value, tables()).gate, 'NO_GO_PRIVILEGED_ROLE');
});

test('table owner without FORCE RLS fails closed', () => {
  const a = tables();
  a[0].current_role_is_owner = true;
  a[0].force_rls = false;
  assert.equal(assess(role(), a).gate, 'NO_GO_OWNER_BYPASS');
});

test('missing RLS or missing table never grants approval', () => {
  const a = tables();
  a[0].rls_enabled = false;
  assert.equal(assess(role(), a).gate, 'NO_GO_RLS_OFF');
  assert.equal(assess(role(), tables().slice(1)).gate, 'INCOMPLETE_SCHEMA');
});

test('safe role metadata cannot be mistaken for release approval', () => {
  const result = assess(role(), tables());
  assert.equal(result.gate, 'ROLE_METADATA_OK_E2E_STILL_REQUIRED');
  assert.equal(result.examinedTables, IMPORTANT_TABLES.length);
  assert.equal(result.tablePrivileges[0].delete, false);
  assert.ok(!JSON.stringify(result).includes('postgresql://'));
});

test('queries share one connection and rollback even on SQL failure', async () => {
  const queries = [];
  let released = false;
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql === ROLE_SQL) return { rows: [role()] };
      if (sql === TABLE_SQL) return { rows: tables() };
      return { rows: [] };
    },
    release() { released = true; }
  };
  const result = await inspectPool({ async connect() { return client; } });
  assert.equal(result.gate, 'ROLE_METADATA_OK_E2E_STILL_REQUIRED');
  assert.deepEqual(queries.map(q => q.sql), ['BEGIN TRANSACTION READ ONLY', ROLE_SQL, TABLE_SQL, 'ROLLBACK']);
  assert.deepEqual(queries[2].params, [IMPORTANT_TABLES]);
  assert.ok(released);

  queries.length = 0;
  released = false;
  const failure = {
    ...client,
    async query(sql) {
      queries.push({ sql });
      if (sql === ROLE_SQL) throw new Error('private-DSN-sentinel');
      return { rows: [] };
    }
  };
  await assert.rejects(inspectPool({ async connect() { return failure; } }), /private-DSN-sentinel/);
  assert.deepEqual(queries.map(q => q.sql), ['BEGIN TRANSACTION READ ONLY', ROLE_SQL, 'ROLLBACK']);
  assert.ok(released);
});

test('import never connects to a database', () => {
  assert.equal(typeof inspectPool, 'function');
  assert.equal(typeof assess, 'function');
});


const { classifyLegacyPool, attestConfiguredPools } = require('../scripts/attest-db-writer-role');

test('legacy independent pool with unsafe or unknown TLS never opens a connection', async () => {
  let touched = 0;
  let closedCentral = 0;
  let closedLegacy = 0;
  const centralPool = { async end() { closedCentral++; } };
  const legacyPool = {
    options: { ssl: { rejectUnauthorized: false } },
    async connect() { touched++; throw new Error('legacy pool should not connect'); },
    async end() { closedLegacy++; }
  };
  const rows = [];
  const result = await attestConfiguredPools({
    centralPool,
    legacyPool,
    inspect: async (pool) => {
      assert.equal(pool, centralPool);
      return { gate: 'ROLE_METADATA_OK_E2E_STILL_REQUIRED' };
    },
    emit: row => rows.push(row)
  });
  assert.equal(result.anyNoGo, true);
  assert.equal(touched, 0);
  assert.equal(closedCentral, 1);
  assert.equal(closedLegacy, 1);
  assert.equal(rows[1].gate, 'NO_GO_LEGACY_TLS_UNVERIFIED');
});

test('PR #375 frozen lazy facade is not connected or closed by the probe', async () => {
  let facadeConnected = 0;
  const facade = Object.freeze({
    query() { throw new Error('not an independent Pool'); },
    connect() { facadeConnected++; throw new Error('unexpected shared pool initialization'); }
  });
  assert.equal(classifyLegacyPool(facade).mode, 'canonical-facade');
  const central = { async end() { this.closed = true; }, closed: false };
  const records = [];
  const result = await attestConfiguredPools({
    centralPool: central, legacyPool: facade,
    inspect: async pool => { assert.equal(pool, central); return { gate: 'ROLE_METADATA_OK_E2E_STILL_REQUIRED' }; },
    emit: item => records.push(item)
  });
  assert.equal(result.anyNoGo, true); // Requires code review and E2E.
  assert.equal(facadeConnected, 0);
  assert.equal(central.closed, true);
  assert.equal(records[1].mode, 'canonical-facade');
  assert.equal(records[1].gate, 'INCOMPLETE_FACADE_CODE_REVIEW_REQUIRED');
});

test('independent verified-TLS pool is inspected and both owned pools are closed', async () => {
  const closed = [];
  const central = { async end() { closed.push('central'); } };
  const legacy = {
    options: { ssl: { rejectUnauthorized: true } },
    connect() {},
    async end() { closed.push('legacy'); }
  };
  const visited = [];
  const result = await attestConfiguredPools({
    centralPool: central, legacyPool: legacy,
    inspect: async pool => {
      visited.push(pool === central ? 'central' : 'legacy');
      return { gate: 'ROLE_METADATA_OK_E2E_STILL_REQUIRED' };
    }
  });
  assert.equal(result.anyNoGo, false);
  assert.deepEqual(visited, ['central','legacy']);
  assert.deepEqual(closed.sort(), ['central','legacy']);
});

test('audit failure still closes only owned pools', async () => {
  let closed = 0;
  const central = { async end() { closed++; } };
  const facade = Object.freeze({ query(){}, connect(){} });
  await assert.rejects(
    attestConfiguredPools({
      centralPool: central, legacyPool: facade,
      inspect: async () => { throw new Error('injected private failure'); }
    }),
    /injected private failure/
  );
  assert.equal(closed, 1);
});
