'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {assertStagingTarget, evaluateSchema, REQUIRED_TABLES, run} = require('../scripts/unifiedStagingPreflight');

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
