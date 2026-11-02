'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {assertStagingTarget, evaluateSchema, REQUIRED_TABLES, CIVIC_PRIVATE_TABLES,
  CIVIC_RUNTIME_COLUMNS, evaluateCivicProtection, evaluateCivicRuntimeColumns,
  evaluateBlockedGuard, run} = require('../scripts/unifiedStagingPreflight');

const env = {NODE_ENV: 'staging', DEMOS_UNIFIED_STAGING_MODE: 'preflight'};
const st = 'fkeayjzvtuvzesljhjbc';
test('accepts only configured staging project direct hostname or pooler identity', () => {
  const direct = assertStagingTarget('postgresql://postgres:dummy@db.'+st+'.supabase.co:5432/postgres',env);
  assert.equal(direct.target, 'Demos-Staging');
  const pooled = assertStagingTarget('postgresql://postgres.'+st+':dummy@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true',env);
  assert.equal(pooled.target,'Demos-Staging');
});
test('rejects production and alternate or legacy Render staging', () => {
  const prod='wxnblcqoyjqxktwkcqok';
  for(const url of [
    'postgresql://postgres:dummy@db.'+prod+'.supabase.co:5432/postgres',
    'postgresql://postgres.'+prod+':dummy@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    'postgresql://postgres:dummy@dpg-db4id8id0e5s73cfb0cg-a:5432/demos_civic_staging_db',
    'postgresql://postgres:dummy@db.'+st+'.supabase.co:5432/other',
    'postgresql://postgres.'+st+':dummy@localhost:6543/postgres'
  ]) assert.throws(()=>assertStagingTarget(url,env));
});
test('refuses absent explicit staging mode and missing connection', () => {
  const url='postgresql://postgres:dummy@db.'+st+'.supabase.co:5432/postgres';
  assert.throws(()=>assertStagingTarget(url,{NODE_ENV:'production', DEMOS_UNIFIED_STAGING_MODE:'preflight'}));
  assert.throws(()=>assertStagingTarget(url,{NODE_ENV:'staging'}));
  assert.throws(()=>assertStagingTarget('',env));
});
test('drops URL SSL overrides and keeps remaining pooler parameters', () => {
  const url='postgresql://postgres.'+st+':dummy@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=disable&pgbouncer=true';
  const checked=assertStagingTarget(url,env);
  assert.equal(new URL(checked.sanitizedConnectionString).searchParams.has('sslmode'),false);
  assert.equal(new URL(checked.sanitizedConnectionString).searchParams.get('pgbouncer'),'true');
});
test('missing application tables means NOT READY, never silently ready', () => {
  const sample=evaluateSchema(['users','user_consents','opinioni_risposte']);
  assert.equal(sample.ready,false);
  assert.ok(sample.missing.includes('eventi'));
  assert.ok(sample.missing.includes('programmi'));
  assert.deepEqual(evaluateSchema(REQUIRED_TABLES),{ready:true,presentCount:9,requiredCount:9,missing:[]});
});

test('preflight is disabled before an explicit staging GO; never connects by default', async () => {
  const fakeUrl = 'postgresql://postgres:synthetic@db.' + st + '.supabase.co:5432/postgres';
  await assert.rejects(
    run({...env, DATABASE_URL: fakeUrl}),
    /preflight not authorized while bootstrap is incomplete/
  );
  await assert.rejects(
    run({...env, DATABASE_URL: fakeUrl, DEMOS_UNIFIED_STAGING_PREFLIGHT_GO: 'true'}),
    /preflight not authorized while bootstrap is incomplete/
  );
  await assert.rejects(
    run({...env, DATABASE_URL: 'postgresql://postgres:synthetic@localhost:5432/postgres',
      DEMOS_UNIFIED_STAGING_PREFLIGHT_GO: 'APPROVED_READ_ONLY_PREFLIGHT'}),
    /Refusing non-staging Supabase project or endpoint/
  );
});

test('five private civic tables require RLS and zero direct client grants', () => {
  const rows = CIVIC_PRIVATE_TABLES.map(table_name => ({
    table_name, rls_enabled: true, anon_can_access: false, authenticated_can_access: false
  }));
  assert.equal(evaluateCivicProtection(rows).ready, true);
  assert.equal(evaluateCivicProtection(rows.slice(1)).ready, false);
  for (const unsafe of [
    {rls_enabled:false}, {anon_can_access:true}, {authenticated_can_access:true},
    {authenticated_can_access:undefined}
  ]) {
    assert.equal(evaluateCivicProtection([{...rows[0],...unsafe},...rows.slice(1)]).ready, false);
  }
});

test('civic runtime schema requires 18 typed columns and opt-in defaults OFF', () => {
  const rows = CIVIC_RUNTIME_COLUMNS.map(([table_name,column_name,udt_name,defaultValue]) => ({
    table_name,column_name,udt_name,
    is_nullable: table_name === 'users' && column_name === 'status' ? 'YES' : 'NO',
    column_default: defaultValue || null
  }));
  assert.equal(evaluateCivicRuntimeColumns(rows).ready, true);
  const failureCases = [
    rows.slice(1),
    rows.map((r,i) => i===1 ? {...r,udt_name:'int4'} : r),
    rows.map((r,i) => i===2 ? {...r,is_nullable:'YES'} : r),
    rows.map(r => r.table_name === 'notifiche_preferenze' && r.column_name === 'eci'
      ? {...r,column_default:'true'} : r),
    rows.map(r => r.table_name === 'civic_push_delivery_guard' && r.column_name === 'blocked'
      ? {...r,column_default:'false'} : r)
  ];
  for(const example of failureCases) assert.equal(evaluateCivicRuntimeColumns(example).ready,false);
});

test('staging delivery guard must have exactly one blocked row', () => {
  assert.equal(evaluateBlockedGuard([{blocked:true}]),true);
  for(const rows of [[],[{blocked:false}],[{blocked:null}],[{blocked:true},{blocked:true}]]) {
    assert.equal(evaluateBlockedGuard(rows),false);
  }
});
