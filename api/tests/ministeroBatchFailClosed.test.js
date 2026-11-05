'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness({failedIds = [], incompleteIds = []} = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../services/ministeroSync.js'), 'utf8');
  const queries = [];
  const observations = {completed: 0, cacheInvalidations: 0, errors: 0};
  const pool = {async query(sql) {
    queries.push(sql);
    return {rowCount: 0, rows: []};
  }};
  const mocks = {
    '../middleware/auth': {pool},
    './ministeroPaginationSafety': {inspectMinisteroPage: () => {throw new Error('NO_NETWORK');}},
    './centralizedLogger': {
      info: async () => {observations.completed++;},
      error: async () => {observations.errors++;},
    },
    './redisCache': {invalidateMinisteroIniziativeCache: async () => {observations.cacheInvalidations++;}},
    '../utils/dateUtils': {normalizeMinisteroDate: () => null, resolveIniziativaDataFine: () => null},
    '../utils/iniziativeMinisteroMapper': {resolveFirmaUrl: () => null},
    './civicProcessRegistryService': {
      resolveProcessTypeFromSource: () => ({id:'it.popular_law_initiative',family:'popular_initiative'}),
      getSignatureThreshold: () => 50000,
    },
  };
  const module = {exports: {}};
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: name => {if (!(name in mocks)) throw Error('UNEXPECTED_IMPORT'); return mocks[name];},
    process: {env: {NODE_ENV: 'test'}}, global: {},
    console: {log(){}, warn(){}, error(){}},
    Date, URLSearchParams,
  }, {filename: 'ministeroSync.js',timeout:1500});
  const service = module.exports;
  service.fetchAllFromMinistero = async () => ({content: [
    {id: 101, titolo: 'Official A'}, {id: 102, titolo: 'Official B'},
  ]});
  service.extractFields = row => ({
    id_ministero: incompleteIds.includes(row.id) ? null : String(row.id),
    titolo: incompleteIds.includes(row.id) ? '' : row.titolo,
  });
  service.saveIniziativa = async row => {
    if (failedIds.includes(row.id)) throw new Error('SYNTHETIC_ROW_FAILURE');
    return {action: 'created'};
  };
  return {service,queries,observations};
}

test('one failed source row rejects the entire sync and never marks readiness',async () => {
  const {service,queries,observations} = harness({failedIds: [102]});
  await assert.rejects(service.syncAll(), /MINISTERO_SYNC_PARTIAL_FAILURE/);
  assert.equal(observations.completed, 0);
  assert.equal(observations.cacheInvalidations, 0);
  assert.equal(observations.errors, 1);
  assert.equal(queries.length, 0, 'no downstream backfills after partial failure');
});

test('skipped malformed official rows also fail closed',async () => {
  const {service,queries,observations} = harness({incompleteIds: [101]});
  await assert.rejects(service.syncAll(), /MINISTERO_SYNC_PARTIAL_FAILURE/);
  assert.equal(observations.completed, 0);
  assert.equal(observations.cacheInvalidations, 0);
  assert.equal(queries.length, 0);
});

test('complete synthetic source still reports success and invalidates cache',async () => {
  const {service,queries,observations} = harness();
  const result = await service.syncAll();
  assert.equal(result.created, 2);
  assert.equal(result.errors, 0);
  assert.equal(result.skipped, 0);
  assert.equal(observations.completed, 1);
  assert.equal(observations.cacheInvalidations, 1);
  assert.equal(queries.length, 3, 'only existing backfill calls');
});
