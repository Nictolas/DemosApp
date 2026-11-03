const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

// Exercise the actual sync implementation with isolated dependencies. No HTTP,
// database connection, user account or production credential is involved.
const source = readFileSync(require.resolve('../services/ministeroSync'), 'utf8');

function makeService({ poolQuery = async () => ({ rowCount: 0, rows: [] }), env = { NODE_ENV: 'production', DEBUG_MODE: 'true' } } = {}) {
  const messages = [];
  const info = [];
  let invalidations = 0;
  const capture = (...args) => messages.push(args);
  const modules = {
    '../middleware/auth': { pool: { query: poolQuery } },
    './centralizedLogger': {
      info: async (name, meta) => info.push({ name, meta }),
      error: async (name, meta) => info.push({ name, meta })
    },
    './ministeroPaginationSafety': {
      inspectMinisteroPage: () => {
        throw new Error('Pagination is not exercised by these logging privacy unit tests');
      }
    },
    './redisCache': { invalidateMinisteroIniziativeCache: async () => { invalidations++; } },
    '../utils/dateUtils': {},
    '../utils/iniziativeMinisteroMapper': {},
    './civicProcessRegistryService': {
      resolveProcessTypeFromSource: () => ({ id: 'referendum' }),
      getSignatureThreshold: () => 50000
    }
  };
  const sandbox = {
    module: { exports: {} },
    require: (id) => {
      assert.ok(Object.hasOwn(modules, id), `Unexpected dependency ${id}`);
      return modules[id];
    },
    console: { log: capture, error: capture, warn: capture },
    process: { env },
    global: {},
    Date,
    Math
  };
  vm.runInNewContext(source, sandbox, { filename: 'ministeroSync.js' });
  return { service: sandbox.module.exports, messages, info, getInvalidations: () => invalidations };
}

test('Ministero sync retains counters and diagnostic codes without per-record titles, IDs or exception text', async () => {
  const ctx = makeService();
  const items = [
    { id_ministero: 'PRIVATE-ID-CREATED', titolo: 'PRIVATE-TITLE-CREATED', action: 'created' },
    { id_ministero: 'PRIVATE-ID-UPDATED', titolo: 'PRIVATE-TITLE-UPDATED', action: 'updated' },
    { id_ministero: null, titolo: null, action: 'skipped' },
    { id_ministero: 'PRIVATE-ID-ERROR', titolo: 'PRIVATE-TITLE-ERROR', action: 'error' }
  ];
  ctx.service.fetchAllFromMinistero = async () => ({ content: items });
  ctx.service.extractFields = (record) => record;
  ctx.service.saveIniziativa = async (record) => {
    if (record.action === 'error') {
      const error = new Error('PRIVATE-EXCEPTION-TEXT');
      error.code = '23505';
      error.detail = 'PRIVATE-SQL-DETAIL';
      throw error;
    }
    return { action: record.action, id: record.id_ministero };
  };
  const results = await ctx.service.syncAll();
  assert.equal(results.created, 1);
  assert.equal(results.updated, 1);
  assert.equal(results.skipped, 1);
  assert.equal(results.errors, 1);
  assert.equal(ctx.getInvalidations(), 1, 'cache invalidation remains active');
  assert.equal(ctx.info.length, 1);
  assert.equal(ctx.info[0].meta.errors, 1);
  const output = JSON.stringify(ctx.messages);
  for (const forbidden of ['PRIVATE-ID', 'PRIVATE-TITLE', 'PRIVATE-EXCEPTION', 'PRIVATE-SQL-DETAIL']) {
    assert.ok(!output.includes(forbidden), `Log leaked ${forbidden}`);
  }
  assert.match(output, /23505/, 'allowlisted SQLSTATE still supports diagnosis');
  assert.match(output, /Sincronizzazione completata/, 'aggregate completion log remains');
});

test('Ministero save errors are rethrown without logging record content or raw SQL errors', async () => {
  const ctx = makeService({
    poolQuery: async () => {
      const error = new Error('PRIVATE-DATABASE-ERROR');
      error.code = '23505';
      error.detail = 'PRIVATE-SQL-DETAIL';
      throw error;
    }
  });
  ctx.service.extractFields = () => ({
    id_ministero: 'PRIVATE-ID', titolo: 'PRIVATE-TITLE', tipo: 'Referendum', stato: 'in_corso'
  });
  await assert.rejects(ctx.service.saveIniziativa({}), /PRIVATE-DATABASE-ERROR/);
  assert.equal(ctx.messages.length, 0, 'production DEBUG_MODE must not log sensitive fields');
});

test('Ministero sync does not echo untrusted diagnostic codes', async () => {
  const ctx = makeService();
  ctx.service.fetchAllFromMinistero = async () => ({ content: [{ titolo: 'PRIVATE-TITLE', id_ministero: 'PRIVATE-ID' }] });
  ctx.service.extractFields = (record) => record;
  ctx.service.saveIniziativa = async () => {
    const error = new Error('PRIVATE-EXCEPTION-TEXT');
    error.code = 'PRIVATE_NAME';
    throw error;
  };
  const result = await ctx.service.syncAll();
  assert.equal(result.errors, 1);
  const output = JSON.stringify(ctx.messages);
  assert.ok(!output.includes('PRIVATE_NAME'));
  assert.ok(!output.includes('PRIVATE-TITLE'));
  assert.match(output, /UNCLASSIFIED/);
});
