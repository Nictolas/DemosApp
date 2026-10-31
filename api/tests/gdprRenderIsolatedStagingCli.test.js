'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  assertIsolatedTarget,runIsolatedProbe,LOG_PREFIX,CLI_MARKER,
  catalogMatchesStagingRuntime,EXPECTED_SQL_ROLE
}=require('../scripts/attest-gdpr-render-staging-isolated');

const STAGING_REF='fkeayjzvtuvzesljhjbc';
const PROD_REF='wxnblcqoyjqxktwkcqok';
const URL='postgresql://synthetic_user.'+STAGING_REF+
  ':FAKE_SECRET@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';
const base=extras=>({
  RENDER:'true',
  RENDER_SERVICE_ID:'srv-db52l1g473hc739ld250',
  NODE_ENV:'production',
  GDPR_RENDER_INPROCESS_ATTESTATION:'demos-staging-inprocess-readonly-20261029',
  GDPR_WRITER_ATTESTATION:'demos-staging-readonly-20261027',
  GDPR_RENDER_SQL_CLI_ONLY:CLI_MARKER,
  DATABASE_URL:URL,
  ...extras
});
const row={
  current_role:'demos_staging_runtime',session_role:'demos_staging_runtime',
  role_setting:'none',database_name:'postgres',
  ledger_present:true,ledger_rls:true,ledger_force_rls:true,
  ledger_owner:false,ledger_insert_grant:true,ledger_select_grant:true,
  bypass_rls:false,public_grants_exist:false,
  public_column_grants_exist:false,api_roles_with_dml_grants:0
};

test('isolated CLI accepts only explicit staging target, Render identity and exact markers',()=>{
  assert.deepEqual(assertIsolatedTarget(base()),{
    service:'demos-functional-staging',project:'Demos-Staging'
  });
  for(const bad of [
    {RENDER_SERVICE_ID:'srv-d2gt3dodl3ps73fmereg'},
    {GDPR_RENDER_SQL_CLI_ONLY:undefined},
    {GDPR_RENDER_SQL_CLI_ONLY:'wrong'},
    {GDPR_RENDER_INPROCESS_ATTESTATION:undefined},
    {GDPR_WRITER_ATTESTATION:undefined},
    {RENDER:undefined},
    {NODE_ENV:'staging'},
    {DATABASE_URL:URL.replace(STAGING_REF,PROD_REF)},
    {DATABASE_URL:URL.replace('sslmode=require','sslmode=disable')},
    {DATABASE_URL:URL.replace('eu-central-1','us-east-1')},
    {DEMOS_STAGING_MIGRATION_MODE:'apply'},
    {DEMOS_STAGING_AUTH_E2E:'true'},
    {ENABLE_CIVIC_PROCESS_SYNC:'true'},
    {AXIOM_ARCHIVE_ENABLED:'true'}
  ])assert.throws(()=>assertIsolatedTarget(base(bad)),
    /NO_GO_ISOLATED_CLI_GUARD_FAILED/);
});

test('bad target refuses BEFORE importing database or starting any provider',async()=>{
  let load=0;
  const emitted=[];
  for(const bad of [
    {GDPR_RENDER_SQL_CLI_ONLY:undefined},
    {RENDER_SERVICE_ID:'srv-d2gt3dodl3ps73fmereg'},
    {DATABASE_URL:URL.replace(STAGING_REF,PROD_REF)},
    {DEMOS_STAGING_MIGRATION_MODE:'e2e-seed'},
    {DEMOS_STAGING_LOAD_E2E:'true'},
    {ENABLE_DATA_RETENTION:'true'}
  ]){
    const report=await runIsolatedProbe({
      env:base(bad),loadDatabase:()=>{load++;throw Error('MUST_NOT_IMPORT_DB');},
      emit:x=>emitted.push(x)
    });
    assert.equal(report.recoveryReady,false);
    assert.equal(report.isolated_cli_staging_session_observed,false);
    assert.equal(report.live_production_pool_verified,false);
  }
  assert.equal(load,0);
  assert.equal(emitted.length,6);
  assert.ok(emitted.every(x=>x.startsWith(LOG_PREFIX)));
  assert.doesNotMatch(emitted.join(''),/FAKE_SECRET|DATABASE_URL|MUST_NOT_IMPORT_DB/);
});

test('one CLI SQL SELECT observes role but never claims a running backend identity',async()=>{
  let loaded=0,gotPool=0,connected=0,queries=0,released=0,closed=0;
  const emitted=[];
  const report=await runIsolatedProbe({
    env:base(),emit:x=>emitted.push(x),
    loadDatabase(){
      loaded++;
      return {
        getPool(){
          gotPool++;
          return {async connect(){
            connected++;
            return {
              async query(config){
                queries++;
                assert.match(config.text,/current_user AS current_role/);
                assert.match(config.text,/session_user AS session_role/);
                assert.doesNotMatch(config.text,/FROM public\.privacy_erasure_ledger/);
                assert.equal(config.query_timeout,5000);
                return {rows:[row]};
              },
              release(){released++;}
            };
          }};
        },
        async closePool(){closed++;}
      };
    }
  });
  assert.deepEqual({loaded,gotPool,connected,queries,released,closed},{
    loaded:1,gotPool:1,connected:1,queries:1,released:1,closed:1
  });
  assert.equal(report.current_role,EXPECTED_SQL_ROLE);
  assert.equal(report.least_privilege_catalog_match,true);
  assert.equal(report.isolated_cli_staging_session_observed,true);
  assert.equal(report.in_process_staging_session_observed,false);
  assert.equal(report.sql_writer_attested,false);
  assert.equal(report.live_production_pool_verified,false);
  assert.equal(report.live_render_pool_verified,false);
  assert.equal(report.recoveryReady,false);
  assert.equal(report.execution,'ISOLATED_CLI_NOT_RUNNING_BACKEND');
  assert.equal(report.status,'READONLY_EXPECTED_STAGING_ROLE_NOT_RUNTIME');
  assert.equal(emitted.length,1);
  assert.doesNotMatch(emitted[0],/FAKE_SECRET|postgresql:\/\/|pooler.supabase.com/);
});


test('wrong, privileged and broader-than-expected catalog roles never pass',async()=>{
  assert.equal(catalogMatchesStagingRuntime(row),true);
  for(const partial of [
    {current_role:'postgres',session_role:'postgres',bypass_rls:true,ledger_owner:true},
    {current_role:'supabase_admin',session_role:'supabase_admin',bypass_rls:true},
    {current_role:'demos_staging_b2_worker',session_role:'demos_staging_b2_worker',
      ledger_insert_grant:false},
    {session_role:'postgres'},
    {bypass_rls:true},
    {ledger_force_rls:false},
    {ledger_owner:true},
    {ledger_insert_grant:false},
    {ledger_select_grant:false},
    {public_grants_exist:true},
    {public_column_grants_exist:true},
    {api_roles_with_dml_grants:1},
    {ledger_present:false},
    {database_name:'another_database'}
  ]){
    const state={...row,...partial};
    assert.equal(catalogMatchesStagingRuntime(state),false,
      JSON.stringify(partial));
    const report=await runIsolatedProbe({
      env:base(),emit:()=>{},
      loadDatabase:()=>({
        getPool:()=>({connect:async()=>({
          query:async()=>({rows:[state]}),
          release:()=>{}
        })}),
        closePool:async()=>{}
      })
    });
    assert.equal(report.least_privilege_catalog_match,false);
    assert.equal(report.recoveryReady,false);
    assert.equal(report.live_render_pool_verified,false);
    assert.match(report.status,/^NO_GO/);
  }
});

test('missing ledger never produces a positive eligibility/readiness status',async()=>{
  let closed=0,released=0;
  const report=await runIsolatedProbe({
    env:base(),emit:()=>{},
    loadDatabase:()=>({
      getPool:()=>({connect:async()=>({
        query:async()=>({rows:[{
          current_role:'synthetic_reader',session_role:'synthetic_reader',
          database_name:'postgres',ledger_present:false
        }]}),
        release:()=>{released++;}
      })}),
      closePool:async()=>{closed++;}
    })
  });
  assert.equal(released,1);
  assert.equal(closed,1);
  assert.equal(report.status,'NO_GO_ISOLATED_CLI_SQL_NOT_ATTESTED');
  assert.equal(report.isolated_cli_staging_session_observed,true);
  assert.equal(report.in_process_staging_session_observed,false);
  assert.equal(report.recoveryReady,false);
});

test('SQL errors and malformed modules return sanitized report, close pool',async()=>{
  let released=0,closed=0;
  const emitted=[];
  const error=Error('DATABASE_URL '+URL+' PRIVATE_TOKEN_SHOULD_NEVER_PRINT');
  const r=await runIsolatedProbe({
    env:base(),
    loadDatabase:()=>({
      getPool:()=>({connect:async()=>({
        query:async()=>{throw error;},release:()=>released++
      })}),
      closePool:async()=>{closed++;}
    }),
    emit:x=>emitted.push(x)
  });
  assert.equal(released,1);
  assert.equal(closed,1);
  assert.equal(r.recoveryReady,false);
  assert.equal(r.status,'NO_GO_ISOLATED_CLI_SQL_NOT_ATTESTED');
  assert.equal(emitted.length,1);
  assert.doesNotMatch(emitted[0],/PRIVATE_TOKEN|FAKE_SECRET|DATABASE_URL|pooler/);
});

test('one-shot CLI source never starts HTTP, app, Firebase, jobs, or staging migrations',()=>{
  const cli=fs.readFileSync(path.resolve(__dirname,
    '../scripts/attest-gdpr-render-staging-isolated.js'),'utf8');
  const entry=fs.readFileSync(path.resolve(__dirname,'../index.js'),'utf8');
  const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
  assert.doesNotMatch(cli,/require\(['"]\.\.\/app|require\(['"]\.\.\/server|require\(['"]\.\.\/services\/firebaseAdmin/);
  assert.doesNotMatch(cli,/\.listen\(|createServer\(|stagingMigrate|runStagingBootGate/);
  assert.match(cli,/loadDatabase:\(\)=>require\('\.\.\/config\/database'\)/);
  assert.match(cli,/if\(require\.main===module\)/);
  assert.match(entry,/GDPR_RENDER_STAGING_WEB_PROBE_FORBIDDEN/);
  assert.doesNotMatch(server,/attestInProcess|GDPR_RENDER_INPROCESS_ATTESTATION/);
});
