'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
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

test('probe refuses staging migration and all write-capable E2E flags before SQL',async()=>{
  // Staging's actual server and stagingBoot expose these names on the existing
  // functional-integration branch. The list must be reviewed if it changes.
  const keys=[
    'DEMOS_STAGING_AUTH_E2E',
    'DEMOS_STAGING_MUTATION_E2E',
    'DEMOS_STAGING_OPINION_NOTIFICATION_E2E',
    'DEMOS_STAGING_OPINION_PROPOSAL_E2E',
    'DEMOS_STAGING_PREFERENCE_COOLDOWN_E2E',
    'DEMOS_STAGING_POLITICAL_CONSENT_E2E',
    'DEMOS_STAGING_TRANSPARENCY_PODIUM_E2E',
    'DEMOS_STAGING_LOAD_E2E',
    'DEMOS_STAGING_ELECTORAL_PERIMETER_E2E'
  ];
  for(const mode of ['baseline','preflight','apply','e2e-seed']){
    const env=config({DEMOS_STAGING_MIGRATION_MODE:mode});
    assert.throws(()=>assertProcessTarget(env),
      /NO_GO_STAGING_ATTESTATION_GUARD_FAILED/,mode);
    let calls=0;
    const result=await attestInProcess({
      env,getPool:()=>{calls++;throw Error('MUST_NOT_CONNECT');},emit:()=>{}
    });
    assert.equal(result.recoveryReady,false);
    assert.equal(result.in_process_staging_session_observed,false);
    assert.equal(calls,0,'must not initialize a pool in migration mode '+mode);
  }
  for(const key of keys){
    const env=config({[key]:'true'});
    assert.throws(()=>assertProcessTarget(env),
      /NO_GO_STAGING_ATTESTATION_GUARD_FAILED/,key);
    let calls=0;
    const result=await attestInProcess({
      env,getPool:()=>{calls++;throw Error('MUST_NOT_CONNECT');},emit:()=>{}
    });
    assert.equal(result.recoveryReady,false);
    assert.equal(calls,0,'must not connect with E2E enabled '+key);
  }
  assert.doesNotThrow(()=>assertProcessTarget(
    config({DEMOS_STAGING_MIGRATION_MODE:'',DEMOS_STAGING_LOAD_E2E:'false'})
  ));
});

test('probe refuses all known staging background jobs before SQL',async()=>{
  const flags=[
    'ENABLE_DATA_RETENTION',
    'ENABLE_VIOLATION_MONITORING',
    'ENABLE_AUTOMATIC_BACKUP',
    'ENABLE_MINISTERO_SYNC',
    'ENABLE_CIVIC_PROCESS_SYNC',
    'ENABLE_POLITICAL_TERRITORY_RESOLVER',
    'ENABLE_ITALIAN_ELECTION_UNIT_SYNC',
    'ENABLE_VOTI_PARLAMENTO_SYNC',
    'ENABLE_OPENPOLIS_COSA_SUCCEDE_SYNC',
    'AXIOM_ARCHIVE_ENABLED'
  ];
  for(const key of flags) {
    const env=config({[key]:'true'});
    assert.throws(()=>assertProcessTarget(env),
      /NO_GO_STAGING_ATTESTATION_GUARD_FAILED/,key);
    let calls=0;
    const result=await attestInProcess({
      env,getPool:()=>{calls++;throw Error('MUST_NOT_CONNECT');},emit:()=>{}
    });
    assert.equal(calls,0,'no SQL while '+key+' is enabled');
    assert.equal(result.recoveryReady,false);
  }
  assert.doesNotThrow(()=>assertProcessTarget(
    config({ENABLE_DATA_RETENTION:'false',AXIOM_ARCHIVE_ENABLED:'false'})
  ));
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

test('web server never registers an in-process probe or exposes HTTP diagnostics',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
  assert.doesNotMatch(server,/attestInProcess|GDPR_RENDER_INPROCESS_ATTESTATION/);
  assert.equal(server.includes('gdprRenderInProcessStagingAttestation'),false);
});

test('web entrypoint forbids every probe marker BEFORE loading server or pool',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../index.js'),'utf8');
  assert.ok(src.indexOf("GDPR_RENDER_SQL_CLI_ONLY")<
    src.indexOf("require('./server')"));
  const cases=[
    {label:'disabled normal web boot',env:{},boots:1,throws:false},
    {label:'normal production web boot unaffected',
      env:{NODE_ENV:'production'},boots:1,throws:false},
    {label:'formerly allowed staging inprocess probe',env:config(),boots:0,throws:true},
    {label:'new isolated probe CLI marker',env:{
      GDPR_RENDER_SQL_CLI_ONLY:'demos-staging-isolated-cli-readonly-20261029'
    },boots:0,throws:true},
    {label:'both markers',env:{
      ...config(),GDPR_RENDER_SQL_CLI_ONLY:'demos-staging-isolated-cli-readonly-20261029'
    },boots:0,throws:true},
    {label:'empty old marker',env:{GDPR_RENDER_INPROCESS_ATTESTATION:''},
      boots:0,throws:true}
  ];
  for(const scenario of cases){
    let boots=0;
    const context={
      process:{env:scenario.env},
      require(id){
        if(id==='./server'){boots++;return {};}
        throw Error('UNEXPECTED_IMPORT');
      }
    };
    if(scenario.throws){
      assert.throws(()=>vm.runInNewContext(src,context,{timeout:1000}),
        /GDPR_RENDER_STAGING_WEB_PROBE_FORBIDDEN/,scenario.label);
    }else{
      assert.doesNotThrow(()=>vm.runInNewContext(src,context,{timeout:1000}),
        scenario.label);
    }
    assert.equal(boots,scenario.boots,scenario.label);
  }
});
