'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  attestInProcess,assertProcessTarget,LOG_PREFIX,STAGING_SERVICE_ID
}=require('../services/gdprRenderInProcessStagingAttestation');

const REF='fkeayjzvtuvzesljhjbc';
const PROD='wxnblcqoyjqxktwkcqok';
const STAGING_URL='postgresql://staging_operator.SUPABASE_REF:FAKE_SECRET@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require'
  .replace('SUPABASE_REF',REF);
const config=(overrides={})=>({
  NODE_ENV:'production',
  RENDER:'true',
  RENDER_SERVICE_ID:STAGING_SERVICE_ID,
  GDPR_RENDER_INPROCESS_ATTESTATION:'demos-staging-inprocess-readonly-20261029',
  GDPR_WRITER_ATTESTATION:'demos-staging-readonly-20261027',
  DATABASE_URL:STAGING_URL,
  ...overrides
});
const validRow={
  current_role:'synthetic_staging_writer',
  session_role:'synthetic_staging_writer',
  role_setting:'none',
  database_name:'postgres',
  ledger_present:true,ledger_rls:true,ledger_force_rls:false,
  ledger_owner:true,ledger_insert_grant:true,ledger_select_grant:true,
  bypass_rls:false,public_grants_exist:false,
  public_column_grants_exist:false,api_roles_with_dml_grants:0
};

test('only exact Render functional-staging service with verified staging target passes',()=>{
  assert.deepEqual(assertProcessTarget(config()),{
    service:'demos-functional-staging',project:'Demos-Staging'
  });
  const wrong=[
    {RENDER_SERVICE_ID:'srv-d2gt3dodl3ps73fmereg'},
    {RENDER_SERVICE_ID:'srv-dbeeca5g1s2s73fb7pd0'},
    {NODE_ENV:'test'},
    {RENDER:'false'},
    {GDPR_RENDER_INPROCESS_ATTESTATION:''},
    {GDPR_WRITER_ATTESTATION:''},
    {DATABASE_URL:STAGING_URL.replace(REF,PROD)},
    {DATABASE_URL:STAGING_URL.replace('sslmode=require','sslmode=disable')},
    {DATABASE_URL:STAGING_URL.replace('pooler.supabase.com','attacker.invalid')},
    {DATABASE_URL:undefined},
  ];
  for(const value of wrong) assert.throws(
    ()=>assertProcessTarget(config(value)),/NO_GO_STAGING_ATTESTATION_GUARD_FAILED/
  );
});

test('production or malformed guard does not obtain pool, connect or query',async()=>{
  const logs=[];
  for(const bad of [
    {RENDER_SERVICE_ID:'srv-d2gt3dodl3ps73fmereg'},
    {DATABASE_URL:STAGING_URL.replace(REF,PROD)},
    {NODE_ENV:'development'},
    {GDPR_WRITER_ATTESTATION:undefined},
    {RENDER:undefined}
  ]){
    const report=await attestInProcess({
      env:config(bad),
      getPool:()=>{throw Error('MUST_NOT_IMPORT_OR_CONNECT_TO_SQL');},
      emit:x=>logs.push(x)
    });
    assert.equal(report.in_process_staging_session_observed,false);
    assert.equal(report.recoveryReady,false);
  }
  assert.equal(logs.length,5);
  assert.ok(logs.every(x=>x.startsWith(LOG_PREFIX)));
  assert.ok(logs.every(x=>!x.includes('FAKE_SECRET')));
});

test('valid staging identity is read via one session from the injected same-process pool',async()=>{
  let pools=0,connects=0,queries=0,releases=0;
  const log=[];
  const report=await attestInProcess({
    env:config(),
    getPool(){
      pools++;
      return {async connect(){
        connects++;
        return {
          async query(q){
            queries++;
            assert.equal(q.rowMode,'object');
            assert.equal(q.query_timeout,5000);
            assert.match(q.text,/current_user AS current_role/);
            assert.match(q.text,/session_user AS session_role/);
            assert.match(q.text,/FROM pg_catalog.pg_class/);
            assert.doesNotMatch(q.text,/FROM public.privacy_erasure_ledger/);
            return {rows:[validRow]};
          },
          release(){releases++;}
        };
      }};
    },
    emit:x=>log.push(x)
  });
  assert.deepEqual({pools,connects,queries,releases},{pools:1,connects:1,queries:1,releases:1});
  assert.equal(report.in_process_staging_session_observed,true);
  assert.equal(report.sql_writer_attested,true);
  assert.equal(report.live_production_pool_verified,false);
  assert.equal(report.live_render_pool_verified,false);
  assert.equal(report.recoveryReady,false);
  assert.equal(report.scope,'ONE_CANONICAL_POOL_SESSION_NOT_ALL_CONNECTIONS');
  assert.equal(report.status,'READONLY_IDENTITY_ONLY_NOT_RELEASE_GO');
  assert.equal(log.length,1);
  assert.ok(log[0].startsWith(LOG_PREFIX));
  assert.doesNotMatch(log[0],/FAKE_SECRET|postgresql:\/\/|pooler.supabase.com/);
});

test('absent ledger still reports bounded single staging identity without GO',async()=>{
  let releaseCount=0;
  const rows=[{current_role:'synthetic_staging_reader',session_role:'synthetic_staging_reader',database_name:'postgres',ledger_present:false}];
  const report=await attestInProcess({
    env:config(),
    getPool:()=>({connect:async()=>({query:async()=>({rows}),release:()=>releaseCount++})}),
    emit:()=>{}
  });
  assert.equal(releaseCount,1);
  assert.equal(report.sql_writer_attested,true);
  assert.equal(report.ledger_present,false);
  assert.equal(report.status,'NO_GO_MISSING_LEDGER');
  assert.equal(report.recoveryReady,false);
});

test('SQL failure never leaks error message or database URI; client always released',async()=>{
  let releaseCount=0;
  const output=[];
  const report=await attestInProcess({
    env:config(),
    getPool:()=>({connect:async()=>({
      query:async()=>{throw Error('DATABASE_URL '+STAGING_URL+' fake-user-secret');},
      release:()=>releaseCount++
    })}),
    emit:x=>output.push(x)
  });
  assert.equal(releaseCount,1);
  assert.equal(report.status,'NO_GO_STAGING_ATTESTATION_NOT_PROVEN');
  assert.equal(report.in_process_staging_session_observed,false);
  assert.equal(report.recoveryReady,false);
  assert.equal(output.length,1);
  assert.doesNotMatch(output[0],/FAKE_SECRET|DATABASE_URL|fake-user-secret|pooler/);
});

test('server startup is opt-in and injects its OWN canonical pool, never an HTTP endpoint',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
  assert.match(server,/if \(process\.env\.GDPR_RENDER_INPROCESS_ATTESTATION !== undefined\)/);
  assert.match(server,/require\('\.\/services\/gdprRenderInProcessStagingAttestation'\)/);
  assert.match(server,/getPool: \(\) => require\('\.\/config\/database'\)\.getPool\(\)/);
  assert.doesNotMatch(server,/app\.use\([^\n]*gdprRenderInProcessStagingAttestation/);
});
