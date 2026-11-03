'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {assertStagingTarget, evaluateSchema, REQUIRED_TABLES, CIVIC_PRIVATE_TABLES,
  CIVIC_RUNTIME_COLUMNS, evaluateCivicProtection, evaluateAllPublicStagingTables,
  evaluatePublicSequenceProtection, evaluatePublicViewExposure,
  evaluatePublicRoutineExposure, evaluateCivicRuntimeColumns,
  evaluateBlockedGuard, evaluateStagingIdentity, evaluatePreflightRole,
  evaluatePreflightWriteGrants, STAGING_IDENTITY_HASH, run} = require('../scripts/unifiedStagingPreflight');

const env = {NODE_ENV: 'staging', DEMOS_UNIFIED_STAGING_MODE: 'preflight'};
const st = 'fkeayjzvtuvzesljhjbc';
test('accepts staging direct or 5432 session pooler without connection overrides', () => {
  const direct = assertStagingTarget('postgresql://demos_staging_preflight:dummy@db.'+st+'.supabase.co:5432/postgres',env);
  assert.equal(direct.target, 'Demos-Staging');
  const pooled = assertStagingTarget('postgresql://demos_staging_preflight.'+st+':dummy@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',env);
  assert.equal(pooled.target,'Demos-Staging');
});
test('rejects production and alternate or legacy Render staging', () => {
  const prod='wxnblcqoyjqxktwkcqok';
  for(const url of [
    'postgresql://demos_staging_preflight:dummy@db.'+prod+'.supabase.co:5432/postgres',
    'postgresql://demos_staging_preflight.'+prod+':dummy@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    'postgresql://demos_staging_preflight:dummy@dpg-db4id8id0e5s73cfb0cg-a:5432/demos_civic_staging_db',
    'postgresql://demos_staging_preflight:dummy@db.'+st+'.supabase.co:5432/other',
    'postgresql://demos_staging_preflight.'+st+':dummy@localhost:6543/postgres',
    'postgresql://demos_staging_preflight.'+st+':dummy@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    'postgresql://demos_staging_preflight:dummy@db.'+st+'.supabase.co:6543/postgres'
  ]) assert.throws(()=>assertStagingTarget(url,env));
});
test('refuses absent explicit staging mode and missing connection', () => {
  const url='postgresql://demos_staging_preflight:dummy@db.'+st+'.supabase.co:5432/postgres';
  assert.throws(()=>assertStagingTarget(url,{NODE_ENV:'production', DEMOS_UNIFIED_STAGING_MODE:'preflight'}));
  assert.throws(()=>assertStagingTarget(url,{NODE_ENV:'staging'}));
  assert.throws(()=>assertStagingTarget('',env));
});
test('drops SSL URL overrides and rejects driver host, port and pool mode overrides', () => {
  const url='postgresql://demos_staging_preflight.'+st+':dummy@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=disable&sslrootcert=fake';
  const checked=assertStagingTarget(url,env);
  assert.equal(new URL(checked.sanitizedConnectionString).searchParams.toString(),'');
  const base='postgresql://demos_staging_preflight.'+st+':dummy@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?';
  for(const arg of [
    'host=db.production.example', 'hostaddr=198.51.100.10', 'service=production',
    'port=6543', 'user=postgres.prod', 'dbname=production', 'options=-c%20search_path%3Dpublic',
    'pool_mode=transaction', 'poolmode=transaction', 'pgbouncer=true',
    'pgbouncer=false', 'target_session_attrs=read-write',
    'application_name=untrusted', 'sslmode=verify-full&host=unexpected.example'
  ]) {
    assert.throws(() => assertStagingTarget(base+arg,env), /Unsafe staging connection options/);
  }
});
test('missing application tables means NOT READY, never silently ready', () => {
  const sample=evaluateSchema(['users','user_consents','opinioni_risposte']);
  assert.equal(sample.ready,false);
  assert.ok(sample.missing.includes('eventi'));
  assert.ok(sample.missing.includes('programmi'));
  assert.deepEqual(evaluateSchema(REQUIRED_TABLES),{ready:true,presentCount:REQUIRED_TABLES.length,requiredCount:REQUIRED_TABLES.length,missing:[]});
});

test('preflight is disabled before an explicit staging GO; never connects by default', async () => {
  const fakeUrl = 'postgresql://demos_staging_preflight:synthetic@db.' + st + '.supabase.co:5432/postgres';
  await assert.rejects(
    run({...env, STAGING_PREFLIGHT_DATABASE_URL: fakeUrl}),
    /preflight not authorized while bootstrap is incomplete/
  );
  await assert.rejects(
    run({...env, STAGING_PREFLIGHT_DATABASE_URL: fakeUrl, DEMOS_UNIFIED_STAGING_PREFLIGHT_GO: 'true'}),
    /preflight not authorized while bootstrap is incomplete/
  );
  await assert.rejects(
    run({...env, STAGING_PREFLIGHT_DATABASE_URL: 'postgresql://demos_staging_preflight:synthetic@localhost:5432/postgres',
      DEMOS_UNIFIED_STAGING_PREFLIGHT_GO: 'APPROVED_READ_ONLY_PREFLIGHT'}),
    /Refusing non-session Supabase staging endpoint/
  );
});

test('core staging private tables require RLS and zero direct client grants', () => {
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

test('global public staging audit fails closed for every newly added table', () => {
  const clean = [
    ...CIVIC_PRIVATE_TABLES.map(table_name => ({
      table_name, rls_enabled:true, anon_can_access:false, authenticated_can_access:false
    })),
    {table_name:'new_future_route_table',rls_enabled:true,
      anon_can_access:false,authenticated_can_access:false}
  ];
  const good = evaluateAllPublicStagingTables(clean);
  assert.equal(good.ready,true);
  assert.equal(good.checkedCount,clean.length);
  assert.deepEqual(good.unsafe,[]);
  for (const changed of [
    {rls_enabled:false}, {rls_enabled:null},
    {anon_can_access:true}, {authenticated_can_access:true},
    {anon_can_access:undefined}, {authenticated_can_access:null}
  ]) {
    const rows = clean.map((row,i)=>i===clean.length-1?{...row,...changed}:row);
    const result = evaluateAllPublicStagingTables(rows);
    assert.equal(result.ready,false);
    assert.deepEqual(result.unsafe,['new_future_route_table']);
  }
  assert.equal(evaluateAllPublicStagingTables([]).ready,false);
  assert.equal(evaluateAllPublicStagingTables(null).ready,false);
  assert.equal(evaluateAllPublicStagingTables([{
    table_name:'unlisted',rls_enabled:false,anon_can_access:false,authenticated_can_access:false
  }]).ready,false);
});

test('public sequence grants to anon or authenticated prevent staging GO', () => {
  assert.deepEqual(evaluatePublicSequenceProtection([]), {ready:true,checkedCount:0,unsafe:[]});
  const safe=[{sequence_name:'safe_seq',anon_can_access:false,authenticated_can_access:false}];
  assert.equal(evaluatePublicSequenceProtection(safe).ready,true);
  for(const bad of [
    {...safe[0],anon_can_access:true},
    {...safe[0],authenticated_can_access:true},
    {...safe[0],anon_can_access:null},
    {...safe[0],sequence_name:undefined}
  ]) assert.equal(evaluatePublicSequenceProtection([bad]).ready,false);
  assert.equal(evaluatePublicSequenceProtection(null).ready,false);
  const fs=require('node:fs'),path=require('node:path');
  const src=fs.readFileSync(path.join(__dirname,'..','scripts','unifiedStagingPreflight.js'),'utf8');
  assert.match(src,/has_sequence_privilege\('anon'/);
  assert.match(src,/has_sequence_privilege\('authenticated'/);
  assert.match(src,/publicSequenceProtection\.ready/);
});

test('preflight reads pg_catalog for ALL public tables without an allowlist filter', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src=fs.readFileSync(path.join(__dirname,'..','scripts','unifiedStagingPreflight.js'),'utf8');
  assert.match(src,/const allPublicTables = evaluateAllPublicStagingTables\(protectionRows.rows\)/);
  assert.match(src,/allPublicTables.ready/);
  const query=src.match(/const protectionRows = await client.query\(\s*`([\s\S]*?)`/);
  assert.ok(query,'Expected global privilege metadata query');
  assert.match(query[1],/pg_catalog.pg_class/);
  assert.doesNotMatch(query[1],/c.relname\s*=\s*ANY/);
  assert.match(src,/BEGIN READ ONLY/);
  assert.match(src,/DEMOS_UNIFIED_STAGING_PREFLIGHT_GO/);
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


test('read-only preflight additionally verifies actual database identity, not only host', () => {
  assert.equal(evaluateStagingIdentity([{identity_hash:STAGING_IDENTITY_HASH}]),true);
  assert.equal(evaluateStagingIdentity([{identity_hash:'00000000000000000000000000000000'}]),false);
  assert.equal(evaluateStagingIdentity([]),false);
  assert.equal(evaluateStagingIdentity([{identity_hash:STAGING_IDENTITY_HASH},{identity_hash:STAGING_IDENTITY_HASH}]),false);
});

test('preflight requires every protected P0/P1 route table, not only bootstrap baseline', () => {
  for(const name of ['user_profile','notifiche_demos','active_sessions','political_candidacies',
    'political_mandates','unita_elettorale','parlamento','votazioni_parlamento']) {
    assert.equal(REQUIRED_TABLES.includes(name),true);
    assert.equal(CIVIC_PRIVATE_TABLES.includes(name),true);
    assert.equal(evaluateSchema(REQUIRED_TABLES.filter(x => x !== name)).ready,false);
  }
});

test('dedicated preflight credentials never reuse the application DATABASE_URL', async()=>{
  await assert.rejects(
    run({...env, DATABASE_URL:'postgresql://postgres:ignored@db.'+st+'.supabase.co:5432/postgres',
      DEMOS_UNIFIED_STAGING_PREFLIGHT_GO:'APPROVED_READ_ONLY_PREFLIGHT'}),
    /DATABASE_URL is missing/
  );
});

test('preflight rejects privileged, inherited or writable PostgreSQL role capabilities', () => {
  const leastPrivilege = {
    username: 'demos_staging_preflight', read_only: 'on',
    rolcanlogin: true, rolsuper: false, rolbypassrls: false,
    rolcreatedb: false, rolcreaterole: false, rolinherit: false,
    has_role_memberships: false,
    can_create_schema: false, can_create_database: false
  };
  assert.equal(evaluatePreflightRole([leastPrivilege]), true);
  assert.equal(evaluatePreflightRole([]), false);
  assert.equal(evaluatePreflightRole([leastPrivilege, leastPrivilege]), false);
  for (const [key, bad] of [
    ['username','postgres'], ['read_only','off'], ['rolcanlogin',false],
    ['rolsuper',true], ['rolbypassrls',true], ['rolcreatedb',true],
    ['rolcreaterole',true], ['rolinherit',true],
    ['has_role_memberships',true], ['has_role_memberships',undefined],
    ['can_create_schema',true], ['can_create_database',true]
  ]) assert.equal(evaluatePreflightRole([{...leastPrivilege, [key]: bad}]),false,key);
});
test('NOINHERIT cannot mask SET ROLE membership in PostgreSQL 16+ (fail closed)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname,'..','scripts','unifiedStagingPreflight.js'),'utf8');
  assert.match(src,/pg_catalog\.pg_auth_members/);
  assert.match(src,/m\.member = r\.oid/);
  assert.match(src,/AS has_role_memberships/);
  assert.match(src,/r\.has_role_memberships === false/);
  const base = {
    username:'demos_staging_preflight', read_only:'on',
    rolcanlogin:true, rolsuper:false, rolbypassrls:false, rolcreatedb:false,
    rolcreaterole:false, rolinherit:false, has_role_memberships:false,
    can_create_schema:false,can_create_database:false
  };
  assert.equal(evaluatePreflightRole([base]), true);
  assert.equal(evaluatePreflightRole([{...base,has_role_memberships:true}]),false);
});

test('preflight covers column-level, sequence and public-client privileges', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts','unifiedStagingPreflight.js'), 'utf8');
  const write = src.match(/const writeCheck = await client\.query\(\s*`([\s\S]*?)`/);
  assert.ok(write, 'preflight write-grant query not found');
  assert.match(write[1], /has_table_privilege\(current_user/);
  assert.match(write[1], /has_any_column_privilege\(current_user/);
  assert.match(write[1], /'INSERT,UPDATE,REFERENCES'/);
  assert.match(write[1], /has_sequence_privilege\(current_user/);
  assert.match(write[1], /'USAGE,UPDATE'/);
  assert.match(write[1], /c\.relkind = 'S'/);
  const publicAudit = src.match(/const protectionRows = await client\.query\(\s*`([\s\S]*?)`/);
  assert.ok(publicAudit, 'public table protection query not found');
  assert.match(publicAudit[1], /has_any_column_privilege\('anon'/);
  assert.match(publicAudit[1], /has_any_column_privilege\('authenticated'/);
  assert.equal(evaluatePreflightWriteGrants([{table_name:'sequence_1',can_write:true}]),false);
  assert.equal(evaluatePreflightWriteGrants([{table_name:'sequence_1',can_write:false}]),true);
});

test('preflight refuses any public table write grant, even a single one', () => {
  assert.equal(evaluatePreflightWriteGrants([{table_name:'users',can_write:false}]),true);
  for(const bad of [
    [], [{table_name:'users',can_write:true}],
    [{table_name:'users',can_write:false},{table_name:'eventi',can_write:true}],
    [{table_name:'users',can_write:null}],
    [{table_name:'',can_write:false}]
  ]) assert.equal(evaluatePreflightWriteGrants(bad),false);
});

test('P2 legacy opinion, referendum and parliamentary tables are mandatory and private', () => {
  for (const name of ['opinioni_domande','voti_referendum_abrogativi','notifiche_voti_parlamento','voti_camera']) {
    assert.equal(REQUIRED_TABLES.includes(name), true, 'required: '+name);
    assert.equal(CIVIC_PRIVATE_TABLES.includes(name), true, 'private: '+name);
    const subset = REQUIRED_TABLES.filter(x => x !== name);
    assert.equal(evaluateSchema(subset).ready, false, 'missing table must block: '+name);
  }
});

test('P3 notifications, incidents and real referendum ballot tables are required and private', () => {
  for (const name of [
    'civic_ballots', 'civic_ballot_positions', 'notifiche_avvistamenti',
    'notifiche_comunali', 'notifiche_voti_comuni',
    'political_opinion_notifications', 'segnalazioni'
  ]) {
    assert.ok(REQUIRED_TABLES.includes(name), 'schema missing required '+name);
    assert.ok(CIVIC_PRIVATE_TABLES.includes(name), 'public protection missing '+name);
    assert.equal(evaluateSchema(REQUIRED_TABLES.filter(x => x !== name)).ready, false,
      'omitting '+name+' must keep the preflight fail-closed');
  }
});

test('P4 preference cooldown table is mandatory and private', () => {
  const name='preference_change_cooldowns';
  assert.ok(REQUIRED_TABLES.includes(name));
  assert.ok(CIVIC_PRIVATE_TABLES.includes(name));
  assert.equal(evaluateSchema(REQUIRED_TABLES.filter(x => x!==name)).ready,false);
});

test('P5 aggregate-only referendum forecast snapshots are mandatory and private', () => {
  const name='civic_ballot_forecast_snapshots';
  assert.ok(REQUIRED_TABLES.includes(name));
  assert.ok(CIVIC_PRIVATE_TABLES.includes(name));
  assert.equal(evaluateSchema(REQUIRED_TABLES.filter(x => x!==name)).ready,false);
});


test('views, materialized views and foreign tables never bypass direct client audit', () => {
  const safe = [{object_name:'private_view',relkind:'v',
    anon_can_access:false,authenticated_can_access:false}];
  assert.equal(evaluatePublicViewExposure([]).ready,true);
  assert.equal(evaluatePublicViewExposure(safe).ready,true);
  for(const relkind of ['v','m','f']) {
    for(const field of ['anon_can_access','authenticated_can_access']) {
      assert.equal(evaluatePublicViewExposure([{...safe[0],relkind,[field]:true}]).ready,false);
      assert.equal(evaluatePublicViewExposure([{...safe[0],relkind,[field]:undefined}]).ready,false);
    }
  }
  assert.equal(evaluatePublicViewExposure(null).ready,false);
  assert.equal(evaluatePublicViewExposure([{...safe[0],relkind:'r'}]).ready,false);
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'..','scripts','unifiedStagingPreflight.js'),'utf8');
  assert.match(source,/const publicViewRows = await client\.query/);
  assert.match(source,/c\.relkind IN \('v','m','f'\)/);
  assert.match(source,/publicViewExposure\.ready/);
});

test('PostgreSQL public RPC functions are denied EXECUTE even with table RLS', () => {
  const safe = [{routine_name:'private_rpc()',security_definer:true,
    anon_can_execute:false,authenticated_can_execute:false}];
  assert.equal(evaluatePublicRoutineExposure([]).ready,true);
  assert.equal(evaluatePublicRoutineExposure(safe).ready,true);
  for(const field of ['anon_can_execute','authenticated_can_execute']) {
    assert.equal(evaluatePublicRoutineExposure([{...safe[0],[field]:true}]).ready,false);
    assert.equal(evaluatePublicRoutineExposure([{...safe[0],[field]:null}]).ready,false);
  }
  assert.equal(evaluatePublicRoutineExposure(null).ready,false);
  assert.equal(evaluatePublicRoutineExposure([{...safe[0],routine_name:''}]).ready,false);
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'..','scripts','unifiedStagingPreflight.js'),'utf8');
  assert.match(source,/const publicRoutineRows = await client\.query/);
  assert.match(source,/has_function_privilege\('anon'/);
  assert.match(source,/has_function_privilege\('authenticated'/);
  assert.match(source,/publicRoutineExposure\.ready/);
});
