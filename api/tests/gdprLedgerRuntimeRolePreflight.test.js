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
  assert.deepEqual(Object.keys(loaded).sort(),
    ['inspectRuntimeGdprLedgerRole','runOperatorRolePreflight'].sort());
});

const {runOperatorRolePreflight} = require('../scripts/gdpr-ledger-runtime-role-preflight');
function capturedWriter() {
 const output=[],errors=[];
 return {output,errors,writeOut:v=>output.push(v),writeErr:v=>errors.push(v)};
}
function disposablePool(row=owner,{onQuery=null,onEnd=null}={}) {
 let reads=0,closed=0,released=0;
 return {
  stats:()=>({reads,closed,released}),
  async connect() { return {
   async query(sql) {
    reads++; assert.match(sql,/^\s*SELECT\s/i);
    if(onQuery)throw onQuery;
    return {rows:[row]};
   },
   release(){released++;}
  };},
  async end(){closed++;if(onEnd)throw onEnd;}
 };
}
test('standalone CLI is inert without explicit opt-in and never creates a connection',async()=>{
 const c=capturedWriter();let started=0;
 const code=await runOperatorRolePreflight({
  env:{},createPool:()=>{started++;throw Error('unexpected DB connection');},...c
 });
 assert.equal(code,2);assert.equal(started,0);
 assert.equal(c.output.length,0);
 assert.deepEqual(c.errors,['GDPR_SQL_ROLE_PREFLIGHT_NOT_AUTHORIZED\n']);
});
test('standalone CLI prints only redacted verdict and terminates with nonzero manual-review exit',async()=>{
 const c=capturedWriter(),p=disposablePool();
 const code=await runOperatorRolePreflight({
  env:{DEMOS_GDPR_ROLE_PREFLIGHT_READONLY:'acknowledged'},createPool:()=>p,...c
 });
 assert.equal(code,2);
 assert.deepEqual(c.errors,[]);
 assert.equal(c.output.length,1);
 assert.equal(JSON.parse(c.output[0]).verdict,'MANUAL_INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(c.output[0].includes('DATABASE_URL'),false);
 assert.deepEqual(p.stats(),{reads:1,closed:1,released:1});
});
test('standalone CLI returns explicit NO_GO status without provider sensitive identifiers',async()=>{
 const c=capturedWriter(),p=disposablePool({...owner,role_is_owner:false});
 const code=await runOperatorRolePreflight({
  env:{DEMOS_GDPR_ROLE_PREFLIGHT_READONLY:'acknowledged'},createPool:()=>p,...c
 });
 assert.equal(code,1);
 assert.equal(JSON.parse(c.output[0]).verdict,'NO_GO_RLS_DEFAULT_DENY');
 assert.deepEqual(p.stats(),{reads:1,closed:1,released:1});
});
test('database SQL and pool close failures are sanitized with no partial success',async()=>{
 const secret='postgres://highly-sensitive-db-password@internal-host/prod';
 for(const opts of [{onQuery:Error(secret)},{onEnd:Error(secret)}]) {
  const c=capturedWriter(),p=disposablePool(owner,opts);
  const code=await runOperatorRolePreflight({
   env:{DEMOS_GDPR_ROLE_PREFLIGHT_READONLY:'acknowledged'},createPool:()=>p,...c
  });
  assert.equal(code,1);
  assert.deepEqual(c.errors,['GDPR_SQL_ROLE_PREFLIGHT_FAILED\n']);
  assert.deepEqual(c.output,[]);
  assert.equal(JSON.stringify(c).includes(secret),false);
  assert.equal(p.stats().closed,1);
 }
});
test('pool factory failures never echo connection details',async()=>{
 const c=capturedWriter();
 const code=await runOperatorRolePreflight({
  env:{DEMOS_GDPR_ROLE_PREFLIGHT_READONLY:'acknowledged'},
  createPool:()=>{throw Error('host=db-prod.internal password=secret');},...c
 });
 assert.equal(code,1);
 assert.deepEqual(c.errors,['GDPR_SQL_ROLE_PREFLIGHT_FAILED\n']);
 assert.deepEqual(c.output,[]);
});
