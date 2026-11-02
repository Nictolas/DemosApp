'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'staging', 'ops_stg_001_missing_tables.sql'), 'utf8');
const sql = migration.replace(/^\s*--.*$/gm, '');

test('schema migration is additive and locked to the staging marker', () => {
  assert.match(sql, /to_regclass\('public\.civic_runtime_identity'\)\s+IS NULL/i);
  assert.doesNotMatch(sql, /\b(TRUNCATE|DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+[a-z_]+)\b/i);
});

test('schema migration creates six internal tables and enables RLS on each', () => {
  const names = ['eventi', 'programmi', 'civic_processes', 'civic_process_identifiers',
    'civic_process_source_records', 'civic_process_reconciliation_candidates'];
  for (const name of names) {
    assert.match(sql, new RegExp('CREATE TABLE public\\.' + name + '\\s*\\(', 'i'));
    assert.match(sql, new RegExp('ALTER TABLE public\\.' + name + '\\s+ENABLE ROW LEVEL SECURITY', 'i'));
  }
  assert.equal((sql.match(/CREATE TABLE public\./g) || []).length, 6);
});

test('schema migration denies direct anonymous client access', () => {
  assert.match(sql, /REVOKE ALL ON public\.eventi,[\s\S]*FROM PUBLIC, anon, authenticated/i);
});

test('bootstrap liveness is distinct from readiness', () => {
  const {createBootstrapServer} = require('../staging/unified_staging_bootstrap');
  assert.equal(typeof createBootstrapServer, 'function');
  const source = fs.readFileSync(path.join(__dirname, '..', 'staging', 'unified_staging_bootstrap.js'), 'utf8');
  assert.match(source, /ready_for_app_tests: false/);
  assert.match(source, /503/);
});
