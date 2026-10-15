const test=require('node:test');const assert=require('node:assert/strict');const {buildExecutionBoundary}=require('../security-agent/securityExecutionBoundary');
const approved={approvalId:'apr_1_1',action:'propose_rate_limit',priority:'P1',state:'approved'};
test('approved proposal creates non executable boundary',()=>{const b=buildExecutionBoundary(approved,{now:()=>new Date('2026-10-03T18:00:00Z')});assert.equal(b.authorized,false);assert.equal(b.executable,false);assert.equal(b.actionRunnerAvailable,false);});
test('pending proposal is rejected',()=>assert.throws(()=>buildExecutionBoundary({...approved,state:'pending'}),/BOUNDARY_APPROVAL_REQUIRED/));
test('rejected proposal is rejected',()=>assert.throws(()=>buildExecutionBoundary({...approved,state:'rejected'}),/BOUNDARY_APPROVAL_REQUIRED/));
test('unknown action is rejected',()=>assert.throws(()=>buildExecutionBoundary({...approved,action:'execute_shell'}),/BOUNDARY_ACTION_NOT_ALLOWED/));
test('boundary is time bounded',()=>{const b=buildExecutionBoundary(approved,{now:()=>new Date('2026-10-03T18:00:00Z'),ttlMs:60000});assert.equal(b.expiresAt,'2026-10-03T18:01:00.000Z');});
test('idempotency key is deterministic',()=>{const a=buildExecutionBoundary(approved);const b=buildExecutionBoundary(approved);assert.equal(a.idempotencyKey,b.idempotencyKey);});
test('arbitrary approval payload is excluded',()=>{const b=buildExecutionBoundary({...approved,rawLog:'SECRET',userId:'USER'});assert.doesNotMatch(JSON.stringify(b),/SECRET|USER/);});
