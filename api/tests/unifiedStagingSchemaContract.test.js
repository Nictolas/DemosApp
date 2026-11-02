'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'staging', 'ops_stg_001_missing_tables.sql'), 'utf8');
const sql = migration.replace(/^\s*--.*$/gm, '');

test('schema migration is additive and locked to the staging marker', () => {
  assert.match(sql, /md5\(db_identity::text\)\s*=\s*'0cbb6ace68a9f11956904e2a37898ec8'/i);
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

test('migration is all-or-nothing and covers ALL six target tables in preflight guard', () => {
  assert.match(sql, /^\s*BEGIN;\s*DO\s+\$\$/i);
  assert.match(sql, /COMMIT;\s*$/i);
  assert.equal((sql.match(/\bCOMMIT;/gi) || []).length, 1, 'Migration must have one commit');
  assert.equal((sql.match(/\bCREATE TABLE public\./gi) || []).length, 6);
  const guard = sql.match(/\bDO\s+\$\$[\s\S]*?\$\$;/i)?.[0];
  assert.ok(guard, 'Missing preflight DO guard');
  for (const table of [
    'eventi', 'programmi', 'civic_processes', 'civic_process_identifiers',
    'civic_process_source_records', 'civic_process_reconciliation_candidates'
  ]) {
    assert.ok(
      guard.includes("to_regclass('public." + table + "') IS NOT NULL"),
      'Refuse pre-existing table ' + table + ' before any DDL'
    );
  }
  assert.ok(
    sql.indexOf('COMMIT;') > sql.lastIndexOf('REVOKE ALL ON'),
    'Commit must follow RLS and privilege revocations'
  );
});

test('migration never silently bypasses bootstrap or operator GO', () => {
  // SQL cannot prove the Supabase project ref from its hostname alone;
  // an operator must attest the destination before executing the migration.
  assert.match(migration, /DO NOT RUN during shared staging bootstrap/);
  assert.match(migration, /explicit operator GO/);
  assert.match(migration, /MUST be verified externally/);
});


const p0Migration = fs.readFileSync(path.join(__dirname, '..','database','staging','ops_stg_001_p0_app_routes_20261103.sql'),'utf8');
const p0Sql = p0Migration.replace(/^\s*--.*$/gm,'');

test('P0 app tables migration is staging-identity-locked, atomic and additive',()=>{
  assert.match(p0Sql, /^\s*BEGIN;\s*DO\s+\$\$/i);
  assert.match(p0Sql, /md5\(db_identity::text\)\s*=\s*'0cbb6ace68a9f11956904e2a37898ec8'/i);
  assert.match(p0Sql, /COMMIT;\s*$/i);
  assert.equal((p0Sql.match(/CREATE TABLE public\./g)||[]).length,4);
  assert.doesNotMatch(p0Sql, /\b(TRUNCATE|DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+public\.)\b/i);
});

test('P0 app tables deny direct client access and start with RLS enabled',()=>{
  const names=['user_profile','notifiche_demos','iniziative_popolari','referendum_abrogativi'];
  for(const name of names){
    assert.match(p0Sql, new RegExp('CREATE TABLE public\\.'+name+'\\s*\\(', 'i'));
    assert.match(p0Sql, new RegExp('ALTER TABLE public\\.'+name+'\\s+ENABLE ROW LEVEL SECURITY', 'i'));
  }
  assert.match(p0Sql, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC,anon,authenticated/i);
});


const p1Migration=fs.readFileSync(path.join(__dirname,'..','database','staging','ops_stg_001_p1_routes_20261103.sql'),'utf8');
const p1Sql=p1Migration.replace(/^\s*--.*$/gm,'');
test('P1 route schema is atomic, staging-identity-locked and purely additive',()=>{
  assert.match(p1Sql,/^\s*BEGIN;[\s\S]*COMMIT;\s*$/i);
  assert.match(p1Sql,/md5\(db_identity::text\)='0cbb6ace68a9f11956904e2a37898ec8'/i);
  assert.equal((p1Sql.match(/CREATE TABLE public\./g)||[]).length,9);
  assert.equal((p1Sql.match(/CREATE SEQUENCE public\./g)||[]).length,2);
  assert.equal((p1Sql.match(/ADD CONSTRAINT/g)||[]).length,29);
  assert.doesNotMatch(p1Sql,/\b(TRUNCATE|DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+public\.)\b/i);
});
test('P1 route schema creates primary keys before foreign keys, with RLS and revocations',()=>{
  assert.ok(p1Sql.indexOf('ADD CONSTRAINT')<p1Sql.indexOf('FOREIGN KEY'));
  assert.ok(p1Sql.lastIndexOf('PRIMARY KEY')<p1Sql.indexOf('FOREIGN KEY'));
  for(const name of ['active_sessions','ice','comunicazioni','unita_elettorale','candidati',
    'political_candidacies','political_mandates','parlamento','votazioni_parlamento']) {
    assert.match(p1Sql,new RegExp('CREATE TABLE public\\."'+name+'"\\s*\\(','i'));
    assert.match(p1Sql,new RegExp('ALTER TABLE public\\."'+name+'"\\s+ENABLE ROW LEVEL SECURITY','i'));
  }
  assert.match(p1Sql,/REVOKE ALL ON[\s\S]*FROM PUBLIC, anon, authenticated;/i);
});
