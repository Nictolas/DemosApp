const test=require('node:test');const assert=require('node:assert/strict');const {buildApprovalConsistencyAlerts}=require('../security-agent/securityApprovalConsistencyAlertPolicy');
test('consistent store emits no alert',()=>{const r=buildApprovalConsistencyAlerts({ok:true,issues:[]});assert.equal(r.activeCount,0);assert.equal(r.highestPriority,null);});
test('counter mismatch is P1',()=>{const r=buildApprovalConsistencyAlerts({ok:false,issues:['PENDING_COUNTER_MISMATCH']});assert.equal(r.highestPriority,'P1');assert.equal(r.alerts[0].code,'APPROVAL_PENDING_COUNTER_MISMATCH');});
test('audit limit is P2',()=>{const r=buildApprovalConsistencyAlerts({ok:false,issues:['AUDIT_LIMIT_EXCEEDED']});assert.equal(r.highestPriority,'P2');});
test('unknown inconsistency fails closed as P1',()=>{const r=buildApprovalConsistencyAlerts({ok:false,issues:['NEW_UNKNOWN']});assert.equal(r.highestPriority,'P1');assert.equal(r.alerts[0].code,'APPROVAL_CONSISTENCY_UNKNOWN');});
test('duplicate issues are deduplicated',()=>{const r=buildApprovalConsistencyAlerts({ok:false,issues:['COUNTER_INVALID','COUNTER_INVALID']});assert.equal(r.activeCount,1);});
test('alerts never become executable',()=>{const r=buildApprovalConsistencyAlerts({ok:false,issues:['DUPLICATE_APPROVAL_ID']});assert.equal(r.executable,false);assert.equal(r.alerts[0].executable,false);});
