'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectRuntimeGdprLedgerRole}=require('../scripts/gdpr-ledger-runtime-role-preflight');

function pool(row) {
  let calls=0, released=0;
  return {
    stats:()=>({calls,released}),
    async connect() { return {
      async query(sql) {
        calls++;
        assert.match(sql,/^\s*SELECT\s/i);
        assert.match(sql,/FROM pg_catalog\.pg_class c/);
        assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|COPY)\s+(?:INTO|TABLE|FROM|public)/i);
        return {rows:row?[row]:[]};
      },
      release(){released++;}
    }; }
  };
}
const owner={
  rls_enabled:true,rls_forced:false,role_is_owner:true,
  role_bypasses_rls:false,has_select_grant:true,has_insert_grant:true,
  policy_count:0,outbox_installed:false
};

test('ledger owner with grants is only ready for manual review, never GO',async()=>{
  const p=pool(owner);const result=await inspectRuntimeGdprLedgerRole(p);
  assert.equal(result.verdict,'MANUAL_INDEPENDENT_REVIEW_REQUIRED');
  assert.equal(result.providerProjectVerified,false);
  assert.equal(result.externalLedgerComplete,false);
  assert.equal(result.isolationVerified,false);
  assert.deepEqual(p.stats(),{calls:1,released:1});
  const serialized=JSON.stringify(result);
  for(const secret of ['current_user','session_user','DATABASE_URL','password'])
    assert.equal(serialized.includes(secret),false);
});
test('non-owner with grants but no policy is denied, not misclassified as writable',async()=>{
  const p=pool({...owner,role_is_owner:false});
  assert.equal((await inspectRuntimeGdprLedgerRole(p)).verdict,'NO_GO_RLS_DEFAULT_DENY');
  assert.deepEqual(p.stats(),{calls:1,released:1});
});
test('FORCE RLS denies owner when no matching policy and no bypass',async()=>{
  const p=pool({...owner,rls_forced:true});
  assert.equal((await inspectRuntimeGdprLedgerRole(p)).verdict,'NO_GO_RLS_DEFAULT_DENY');
});
test('missing privilege, missing relation and disabled RLS are fail-closed',async()=>{
  assert.equal((await inspectRuntimeGdprLedgerRole(pool(null))).verdict,'NO_GO_LEDGER_MISSING');
  assert.equal((await inspectRuntimeGdprLedgerRole(pool({...owner,has_insert_grant:false}))).verdict,'NO_GO_INSUFFICIENT_SQL_GRANTS');
  assert.equal((await inspectRuntimeGdprLedgerRole(pool({...owner,rls_enabled:false}))).verdict,'NO_GO_RLS_DISABLED');
});
test('unknown catalog formats cannot imply readiness and always release connections',async()=>{
  const p=pool({...owner,policy_count:'0'});
  assert.equal((await inspectRuntimeGdprLedgerRole(p)).verdict,'NO_GO_UNRELIABLE_CATALOG_RESULT');
  assert.deepEqual(p.stats(),{calls:1,released:1});
  let freed=false;const broken={async connect(){return {async query(){throw Error('connection string secret');},release(){freed=true;}};}};
  await assert.rejects(inspectRuntimeGdprLedgerRole(broken),/connection string secret/);
  assert.equal(freed,true);
});
test('the preflight is not registered as HTTP handler or scheduled job',async()=>{
  const loaded=require('../scripts/gdpr-ledger-runtime-role-preflight');
  assert.deepEqual(Object.keys(loaded),['inspectRuntimeGdprLedgerRole']);
});
