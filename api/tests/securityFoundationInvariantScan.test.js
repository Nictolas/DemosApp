const test=require('node:test');const assert=require('node:assert/strict');
const {securityCenterRouteContract}=require('../security-agent/securityCenterRouteContract');
const {policyStatus}=require('../security-agent/securityPolicyEngine');
const {boundaryValidationStatus}=require('../security-agent/securityExecutionBoundaryValidator');
const {SecurityApprovalGate}=require('../security-agent/securityApprovalGate');
function closed(x,label){assert.equal(x.authorized ?? false,false,`${label}.authorized`);assert.equal(x.executable ?? false,false,`${label}.executable`);assert.equal(x.actionRunnerAvailable ?? false,false,`${label}.actionRunnerAvailable`);if(Object.hasOwn(x,'executionEnabled'))assert.equal(x.executionEnabled,false,`${label}.executionEnabled`)}
test('all public security execution/status contracts remain fail-closed',()=>{closed(securityCenterRouteContract(),'routes');closed(policyStatus(),'policy');closed(boundaryValidationStatus(),'boundary');closed(new SecurityApprovalGate().status(),'approval');});
test('Security Center contract remains GET-only and admin-only',()=>{const c=securityCenterRouteContract();assert.equal(c.adminOnly,true);assert.equal(c.readOnly,true);assert.ok(c.methods.length>0);assert.ok(c.methods.every(m=>m==='GET'));});
