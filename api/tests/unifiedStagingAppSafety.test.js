'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  assertStagingAppCanary,shouldMountDevApiSurface,DISABLED_FLAGS,FORBIDDEN_CREDENTIALS
}=require('../staging/unified_staging_app_safety');

const REF='fkeayjzvtuvzesljhjbc';
const HOST='aws-1-eu-central-1.pooler.supabase.com';
const fakePassword='TEST_CANARY_ONLY_ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ds='postgresql://demos_staging_runtime.'+REF+':'+fakePassword+
  '@'+HOST+':5432/postgres';
const safe=Object.freeze({
  NODE_ENV:'staging',DEMOS_UNIFIED_STAGING_MODE:'app_canary',
  DEMOS_STAGING_APP_CANARY_GO:'I_APPROVE_STAGING_APP_CANARY',
  CIVIC_UNIFIED_STAGING_READY:'true',CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED:'true',
  CIVIC_STAGING_PROJECT_REF:REF,CIVIC_STAGING_EXPECTED_POOLER_HOST:HOST,
  CIVIC_STAGING_SESSION_DATABASE_URL:fakePassword,
  ALLOW_DEV_API_SURFACE:'false',PERFORMANCE_MONITOR_ENABLED:'false',
});

test('non-staging environments preserve existing routing decisions',()=>{
  assert.equal(assertStagingAppCanary({NODE_ENV:'production'}).active,false);
  assert.equal(shouldMountDevApiSurface({NODE_ENV:'production'}),false);
  assert.equal(shouldMountDevApiSurface({NODE_ENV:'production',ALLOW_DEV_API_SURFACE:'true'}),true);
  assert.equal(shouldMountDevApiSurface({NODE_ENV:'development'}),true);
});
test('staging requires explicit canary GO and session-locked synthetic target',()=>{
  for(const env of [
    {...safe,DEMOS_UNIFIED_STAGING_MODE:'preflight'},
    {...safe,DEMOS_UNIFIED_STAGING_MODE:'bootstrap'},
    {...safe,DEMOS_STAGING_APP_CANARY_GO:undefined},
    {...safe,CIVIC_UNIFIED_STAGING_READY:'false'},
    {...safe,CIVIC_UNIFIED_STAGING_TESTS_AUTHORIZED:undefined},
    {...safe,CIVIC_STAGING_PROJECT_REF:'wxnblcqoyjqxktwkcqok'},
    {...safe,CIVIC_STAGING_EXPECTED_POOLER_HOST:'aws-2-eu-central-1.pooler.supabase.com'},
    {...safe,CIVIC_STAGING_SESSION_DATABASE_URL:'no'},
    {...safe,CIVIC_STAGING_SESSION_DATABASE_URL:undefined},
    {...safe,CIVIC_STAGING_SESSION_DATABASE_URL:ds.replace(HOST,'db.wxnblcqoyjqxktwkcqok.supabase.co')},
    {...safe,DATABASE_URL:'postgresql://prod_user:prod_password@db.wxnblcqoyjqxktwkcqok.supabase.co:5432/postgres'},
  ]) assert.throws(()=>assertStagingAppCanary(env),/STAGING_APP_CANARY_/);
  assert.equal(shouldMountDevApiSurface({...safe,ALLOW_DEV_API_SURFACE:'true'}),false);
});
test('canary handles only existing password-only or exact stage DSN',()=>{
  assert.equal(assertStagingAppCanary(safe).connectionString,ds);
  assert.equal(assertStagingAppCanary({...safe,DATABASE_URL:ds}).active,true);
  assert.equal(assertStagingAppCanary({...safe,CIVIC_STAGING_SESSION_DATABASE_URL:ds}).connectionString,ds);
});
test('reject every active background, network or public debug switch',()=>{
  for(const flag of DISABLED_FLAGS) {
    assert.throws(()=>assertStagingAppCanary({...safe,[flag]:'true'}),
      /STAGING_APP_CANARY_SIDE_EFFECTS_FORBIDDEN/,flag);
    assert.throws(()=>assertStagingAppCanary({...safe,[flag]:'ON'}),
      /STAGING_APP_CANARY_SIDE_EFFECTS_FORBIDDEN/,flag);
  }
  assert.throws(()=>assertStagingAppCanary({...safe,ALLOW_DEV_API_SURFACE:'true'}),
    /SIDE_EFFECTS_FORBIDDEN/);
  assert.throws(()=>assertStagingAppCanary({...safe,PERFORMANCE_MONITOR_ENABLED:'true'}),
    /SIDE_EFFECTS_FORBIDDEN/);
});
test('reject every unrelated secret/provider credential',()=>{
  for(const flag of FORBIDDEN_CREDENTIALS) {
    assert.throws(()=>assertStagingAppCanary({...safe,[flag]:'dummy'}),
      /STAGING_APP_CANARY_PROVIDER_CREDENTIALS_FORBIDDEN/,flag);
  }
});
test('no provider secrets are included in failure messages',()=>{
  const secret='REAL_SECRET_SHOULD_NEVER_LEAK';
  assert.throws(()=>assertStagingAppCanary({...safe,DATABASE_URL:secret}),e=>{
    assert.equal(e.message.includes(secret),false);return true;
  });
});
