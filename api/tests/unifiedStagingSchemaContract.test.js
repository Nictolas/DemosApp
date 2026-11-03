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


const p2Migration = fs.readFileSync(path.join(__dirname,'..','database','staging','ops_stg_001_p2_opinion_referendum_parliament_20261103.sql'),'utf8');
const p2Sql = p2Migration.replace(/^\s*--.*$/gm,'');
test('P2 legacy vote/opinion schema is additive, atomic and restricted to Demos-Staging', () => {
  assert.match(p2Sql,/^\s*BEGIN;[\s\S]*COMMIT;\s*$/i);
  assert.match(p2Sql,/md5\(db_identity::text\)='0cbb6ace68a9f11956904e2a37898ec8'/i);
  assert.equal((p2Sql.match(/CREATE TABLE public\./g)||[]).length,4);
  assert.equal((p2Sql.match(/CREATE SEQUENCE public\./g)||[]).length,1);
  assert.equal((p2Sql.match(/ADD CONSTRAINT/g)||[]).length,14);
  assert.doesNotMatch(p2Sql,/\b(TRUNCATE|DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+public\.)\b/i);
});
test('P2 protects all four empty tables and the sequence from direct clients', () => {
  for(const name of ['opinioni_domande','voti_referendum_abrogativi','notifiche_voti_parlamento','voti_camera']){
    assert.match(p2Sql,new RegExp('CREATE TABLE public\\."'+name+'"\\s*\\(','i'));
    assert.match(p2Sql,new RegExp('ALTER TABLE public\\."'+name+'"\\s+ENABLE ROW LEVEL SECURITY','i'));
  }
  assert.match(p2Sql,/REVOKE ALL ON[\s\S]*FROM PUBLIC, anon, authenticated;/i);
  assert.match(p2Sql,/REVOKE ALL ON SEQUENCE public\.voti_camera_id_seq FROM PUBLIC, anon, authenticated;/i);
});


const p3Migration=fs.readFileSync(path.join(__dirname,'..','database','staging',
  'ops_stg_001_p3_ballots_notifications_segnalazioni_20261103.sql'),'utf8');
const p3Sql=p3Migration.replace(/^\s*--.*$/gm,'');
test('P3 ballot, notification and incidents schema is staging-only, atomic and empty',()=>{
  assert.match(p3Sql,/^\s*BEGIN;[\s\S]*COMMIT;\s*$/i);
  assert.match(p3Sql,/md5\(db_identity::text\)='0cbb6ace68a9f11956904e2a37898ec8'/i);
  assert.match(p3Sql,/civic_push_delivery_guard WHERE id=1/i);
  assert.equal((p3Sql.match(/CREATE TABLE public\./g)||[]).length,7);
  assert.equal((p3Sql.match(/ADD CONSTRAINT/g)||[]).length,33);
  assert.equal((p3Sql.match(/ENABLE ROW LEVEL SECURITY/g)||[]).length,7);
  assert.doesNotMatch(p3Sql,/\b(TRUNCATE|DROP\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+public\.)\b/i);
});
test('P3 tables are all RLS-protected, private, and created before their FKs',()=>{
  const names=['civic_ballots','civic_ballot_positions','notifiche_avvistamenti',
    'notifiche_comunali','notifiche_voti_comuni',
    'political_opinion_notifications','segnalazioni'];
  for(const name of names){
    assert.match(p3Sql,new RegExp('CREATE TABLE public\\."'+name+'"\\s*\\(','i'));
    assert.match(p3Sql,new RegExp('ALTER TABLE public\\."'+name+'"\\s+ENABLE ROW LEVEL SECURITY','i'));
    assert.match(p3Sql,new RegExp("to_regclass\\('public\\."+name+"'\\) IS NOT NULL",'i'));
  }
  assert.ok(p3Sql.lastIndexOf('PRIMARY KEY')<p3Sql.indexOf('FOREIGN KEY'));
  assert.match(p3Sql,/REVOKE ALL ON[\s\S]*FROM PUBLIC, anon, authenticated;/i);
});

const p4CooldownSQL=fs.readFileSync(path.join(__dirname,'..','database','staging',
  'ops_stg_001_p4_preference_cooldowns_20261103.sql'),'utf8');
test('P4 cooldown timestamp schema is staging-only, private and additive',()=>{
  assert.match(p4CooldownSQL,/md5\(db_identity::text\)='0cbb6ace68a9f11956904e2a37898ec8'/);
  assert.match(p4CooldownSQL,/CREATE TABLE public.preference_change_cooldowns/);
  assert.match(p4CooldownSQL,/PRIMARY KEY \(user_id, scope\)/);
  assert.match(p4CooldownSQL,/ALTER TABLE public.preference_change_cooldowns ENABLE ROW LEVEL SECURITY/);
  assert.match(p4CooldownSQL,/REVOKE ALL ON public.preference_change_cooldowns FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(p4CooldownSQL,/\b(?:INSERT INTO|DELETE FROM|TRUNCATE|DROP TABLE|UPDATE public\.)\b/i);
});

const p5SnapshotsSql=fs.readFileSync(path.join(__dirname,'..','database','staging',
  'ops_stg_001_p5_forecast_snapshots_20261103.sql'),'utf8');
test('P5 referendum snapshot table is additive, staging-only, aggregate and private',()=>{
  assert.match(p5SnapshotsSql,/^\s*BEGIN;[\s\S]*COMMIT;\s*$/m);
  assert.match(p5SnapshotsSql,/md5\(db_identity::text\)='0cbb6ace68a9f11956904e2a37898ec8'/);
  assert.match(p5SnapshotsSql,/civic_push_delivery_guard/);
  assert.equal((p5SnapshotsSql.match(/ADD CONSTRAINT/g)||[]).length,7);
  assert.match(p5SnapshotsSql,/FOREIGN KEY \(civic_ballot_id\) REFERENCES public\.civic_ballots\(id\)/);
  assert.match(p5SnapshotsSql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(p5SnapshotsSql,/REVOKE ALL ON public\.civic_ballot_forecast_snapshots[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(p5SnapshotsSql,/\buser_id\s+(?:uuid|text)\b/i);
  assert.doesNotMatch(p5SnapshotsSql,/\b(?:INSERT INTO|DELETE FROM|TRUNCATE|DROP TABLE|UPDATE public\.)\b/i);
});

const p5FixtureAclSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'staging',
  'ops_stg_001_p5_synthetic_snapshot_acl_20261103.sql'), 'utf8');
const {MIN_PUBLIC_RESPONSES} = require('../services/referendumForecastSnapshotService');
test('P5 synthetic runtime ACL preserves the ten-response publication limit', () => {
  assert.equal(MIN_PUBLIC_RESPONSES, 10);
  assert.match(p5FixtureAclSql, /P5_SNAPSHOT_ACL_APPROVAL_REQUIRED/);
  assert.match(p5FixtureAclSql, /P5_SNAPSHOT_ACL_WRONG_DATABASE/);
  assert.match(p5FixtureAclSql, /P5_SNAPSHOT_ACL_DELIVERY_UNBLOCKED/);
  assert.match(p5FixtureAclSql, /P5_SNAPSHOT_ACL_P3_NOT_APPROVED/);
  const activeAclSql = p5FixtureAclSql.replace(/^\\s*--.*$/gm, '');
  // SELECT, INSERT and both UPDATE USING/WITH CHECK must enforce >=10.
  assert.equal((activeAclSql.match(/total_responses >= 10/g) || []).length, 4);
  assert.match(p5FixtureAclSql, /GRANT UPDATE \(total_responses,yes_count,no_count,abstain_count,updated_at\)/);
  assert.doesNotMatch(p5FixtureAclSql, /GRANT UPDATE \(.*is_frozen/);
  assert.doesNotMatch(p5FixtureAclSql, /GRANT (?:ALL|DELETE|TRUNCATE) ON public.civic_ballot_forecast_snapshots/);
  assert.match(p5FixtureAclSql, /CREATE POLICY p5_staging_synthetic_snapshot_update/);
});

test('P5 snapshot capture suppresses two-user fixture results without writing', async () => {
  const {captureReferendumForecastSnapshots} = require('../services/referendumForecastSnapshotService');
  const statements = [];
  const pool = {query: async (statement) => {
    statements.push(statement);
    return {rows: [{
      civic_ballot_id: '00000000-0000-4000-8000-00000000b001',
      opens_at: '2026-11-06T00:00:00Z',
      total_responses: 2, yes_count: 1, no_count: 1, abstain_count: 0,
    }]};
  }};
  const result = await captureReferendumForecastSnapshots({
    pool, now: new Date('2026-11-03T00:00:00Z'),
  });
  assert.equal(result.fetched, 1);
  assert.equal(result.suppressed, 1);
  assert.equal(result.captured, 0);
  assert.equal(result.errors.length, 0);
  assert.equal(statements.length, 1, 'Small fixture counts must not be saved');
});

test('P5 aggregate service writes only at ten responses; frozen snapshots stay immutable', async () => {
  const {captureReferendumForecastSnapshots} = require('../services/referendumForecastSnapshotService');
  for (const frozen of [false, true]) {
    const queries = [];
    const now = new Date('2026-11-03T00:00:00Z');
    const pool = {query: async (sql, args) => {
      queries.push({sql,args});
      if (sql.includes('FROM civic_ballots cb')) {
        return {rows: [{
          civic_ballot_id: '00000000-0000-4000-8000-00000000b001',
          opens_at: frozen ? '2026-11-02T00:00:00Z' : '2026-11-04T00:00:00Z',
          total_responses: 10, yes_count: 6, no_count: 3, abstain_count: 1,
        }]};
      }
      return {rowCount: 1};
    }};
    const result = await captureReferendumForecastSnapshots({pool,now});
    assert.equal(result.captured,1);
    assert.equal(result.suppressed,0);
    assert.equal(queries.length,2);
    assert.match(queries[1].sql, frozen ? /DO NOTHING/ :
      /WHERE civic_ballot_forecast_snapshots.is_frozen = FALSE/);
    assert.equal(queries[1].args[2],10);
    assert.deepEqual(queries[1].args.slice(3),[6,3,1]);
  }
});
