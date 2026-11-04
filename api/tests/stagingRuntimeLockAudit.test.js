'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertRuntimeAuditAllowed,runIsolatedRuntimeLockAudit,APPROVAL}=
  require('../staging/runtime_staging_lock_audit');

const REF='fkeayjzvtuvzesljhjbc';
const HOST='aws-1-eu-central-1.pooler.supabase.com';
const safe=Object.freeze({
  NODE_ENV:'staging',DEMOS_UNIFIED_STAGING_MODE:'preflight',
  DEMOS_UNIFIED_STAGING_PREFLIGHT_GO:'APPROVED_READ_ONLY_PREFLIGHT',
  CIVIC_STAGING_RUNTIME_AUDIT_GO:APPROVAL,
  CIVIC_STAGING_SESSION_DATABASE_URL:
    'postgresql://demos_staging_runtime.'+REF+
    ':FAKE-CI-CREDENTIAL@'+HOST+':5432/postgres',
  CIVIC_PUSH_ENABLED:'false',CIVIC_NEW_INITIATIVE_EVENTS_ENABLED:'false',
  CIVIC_NEW_INITIATIVE_PUSH_ENABLED:'false',ENABLE_MINISTERO_SYNC:'false',
  ENABLE_CIVIC_PROCESS_SYNC:'false',DEMOS_STAGING_ANDROID_PUSH_E2E:'false',
  ALLOW_DEMOS_STAGING_MIGRATIONS:'false',
});

function fakePool({brokenLock=false,wrongIdentity=false}={}) {
  let connected=0,owner=null,closed=false,released=0,rollback=0;
  const clients=[];
  function newClient(i) {
    let appName='ci-mock',inTrans=false;
    const c={
      async query(sql,params=[]) {
        if(sql==='BEGIN READ ONLY'){inTrans=true;return {rows:[]};}
        if(sql==='ROLLBACK'){rollback++;inTrans=false;return {rows:[]};}
        if(sql.includes('current_user::text AS role_name') &&
            sql.includes('delivery_blocked')) {
          return {rows:[{
            role_name:wrongIdentity?'postgres':'demos_staging_runtime',
            database_name:'postgres',
            identity_hash:'0cbb6ace68a9f11956904e2a37898ec8',
            delivery_blocked:true,
          }]};
        }
        if(sql.includes('current_user::text AS role_name') && sql.includes('AS db')) {
          return {rows:[{role_name:'demos_staging_runtime',db:'postgres'}]};
        }
        if(sql.includes('pg_backend_pid() AS pid')) {
          return {rows:[{pid:1000+i,app_name:appName}]};
        }
        if(sql.includes("set_config('application_name'")) {
          appName=params[0];return {rows:[{applied:appName}]};
        }
        if(sql.includes('pg_try_advisory_lock')) {
          const acquired=brokenLock?true:owner===null||owner===i;
          if(acquired)owner=i;
          return {rows:[{acquired}]};
        }
        if(sql.includes('pg_advisory_unlock_all')) {
          if(owner===i)owner=null;return {rows:[]};
        }
        if(sql.includes('pg_advisory_unlock(')){
          const was=owner===i;if(was)owner=null;
          return {rows:[{released:was}]};
        }
        throw new Error('Unexpected query');
      },
      release(){released++;},
    };
    clients.push(c);return c;
  }
  return {options:{max:2}, async connect(){return newClient(connected++);},
    async end(){closed=true;},get finished(){return closed;},
    get releases(){return released;},get rollbacks(){return rollback;}};
}

test('accepts strictly pinned, disabled, approved preflight environment',()=>{
  assert.doesNotThrow(()=>assertRuntimeAuditAllowed(safe));
  const rejected=[
    {NODE_ENV:'production'},{DEMOS_UNIFIED_STAGING_MODE:'app'},
    {CIVIC_STAGING_RUNTIME_AUDIT_GO:'true'},
    {CIVIC_PUSH_ENABLED:'true'},{CIVIC_NEW_INITIATIVE_PUSH_ENABLED:'true'},
    {CIVIC_UNIFIED_STAGING_READY:'true'},
    {CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED:'true'},
    {DATABASE_URL:'postgres://production'},
    {CIVIC_STAGING_SESSION_DATABASE_URL:safe.CIVIC_STAGING_SESSION_DATABASE_URL.replace(':5432/',':6543/')},
    {CIVIC_STAGING_SESSION_DATABASE_URL:safe.CIVIC_STAGING_SESSION_DATABASE_URL.replace(REF,'wxnblcqoyjqxktwkcqok')},
    {CIVIC_STAGING_SESSION_DATABASE_URL:safe.CIVIC_STAGING_SESSION_DATABASE_URL.replace('demos_staging_runtime.','postgres.')},
  ];
  rejected.forEach(p=>assert.throws(()=>assertRuntimeAuditAllowed({...safe,...p})));
});

test('invalid environment opens no pool',async()=>{
  let called=0;
  await assert.rejects(runIsolatedRuntimeLockAudit({...safe,CIVIC_PUSH_ENABLED:'true'},{
    createPool:()=>{called++;throw new Error('must-not-connect');},
  }));
  assert.equal(called,0);
});

test('synthetic runtime role and both advisory sessions pass with lock release',async()=>{
  const pool=fakePool();let ssl;
  const pass=await runIsolatedRuntimeLockAudit(safe,{
    createPool:options=>{ssl=options.ssl;return pool;},
  });
  assert.equal(pass,true);
  assert.equal(ssl.rejectUnauthorized,true);
  assert.equal(pool.finished,true);
  assert.equal(pool.releases,3);
  assert.ok(pool.rollbacks>=9);
});

test('wrong authenticated role always fails before lock probing',async()=>{
  const pool=fakePool({wrongIdentity:true});
  await assert.rejects(runIsolatedRuntimeLockAudit(safe,{createPool:()=>pool}),
    /CIVIC_STAGING_SESSION_RUNTIME_IDENTITY_UNVERIFIED/);
  assert.equal(pool.finished,true);
  assert.equal(pool.releases,1);
});

test('broken advisory exclusion fails closed and disconnects both sessions',async()=>{
  const pool=fakePool({brokenLock:true});
  await assert.rejects(runIsolatedRuntimeLockAudit(safe,{createPool:()=>pool}),
    /STAGING_LOCK_NOT_EXCLUSIVE/);
  assert.equal(pool.finished,true);
  assert.equal(pool.releases,3);
});
