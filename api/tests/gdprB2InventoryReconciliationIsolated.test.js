'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {normalizeEvent,keyFor} = require('../services/privacyErasureB2Journal');
const {reconcileInventories} = require('../services/privacyErasureB2Reconciliation');
const A='00000000-0000-4000-8000-000000000951';
const B='00000000-0000-4000-8000-000000000952';
function event(event_key=A) {
  return {event_key,subject_user_id:'synthetic-subject',
    event_type:'political_consent_revoked',
    occurred_at:'2026-10-30T12:34:56.123456Z',details:{synthetic:true}};
}
function receipt(e) {
  const normalized=normalizeEvent(e);
  return {event_key:e.event_key,key:keyFor(normalized),
    sha256:crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex'),
    versionId:'synthetic-immutable-version',
    retentionUntil:'2027-10-30T12:34:56.123Z'};
}
const run=(events,receipts)=>reconcileInventories({ledgerEvents:events,archivedReceipts:receipts});
const error=(code,events,receipts)=>assert.throws(()=>run(events,receipts),e=>e.code===code);
test('matched synthetic inventories never imply completeness or recovery readiness',()=>{
  assert.deepEqual(run([event(A),event(B)],[receipt(event(B)),receipt(event(A))]),{
    comparedEvents:2,matchedReceipts:2,complete:false,independent:false,recoveryReady:false
  });
});
test('both empty inventories cannot attest completeness',()=>{
  assert.deepEqual(run([],[]),{comparedEvents:0,matchedReceipts:0,complete:false,independent:false,recoveryReady:false});
});
test('missing receipt fails closed',()=>error('GDPR_B2_RECONCILIATION_MISSING_RECEIPT',[event(A),event(B)],[receipt(event(A))]));
test('extra receipt fails closed',()=>error('GDPR_B2_RECONCILIATION_ORPHAN_RECEIPT',[event(A)],[receipt(event(A)),receipt(event(B))]));
test('duplicate ledger event fails closed',()=>error('GDPR_B2_RECONCILIATION_DUPLICATE_LEDGER_EVENT',[event(A),event(A)],[receipt(event(A))]));
test('duplicate receipt fails closed',()=>error('GDPR_B2_RECONCILIATION_DUPLICATE_RECEIPT',[event(A)],[receipt(event(A)),receipt(event(A))]));
test('mismatched event hash fails closed',()=>error('GDPR_B2_RECONCILIATION_MISMATCH',[event(A)],[{...receipt(event(A)),sha256:'0'.repeat(64)}]));
test('mismatched archive key fails closed',()=>error('GDPR_B2_RECONCILIATION_MISMATCH',[event(A)],[{...receipt(event(A)),key:'synthetic-other-path'}]));
test('missing immutable version fails closed',()=>error('GDPR_B2_RECONCILIATION_INVALID_RECEIPT',[event(A)],[{...receipt(event(A)),versionId:''}]));
test('malformed retention evidence fails closed',()=>error('GDPR_B2_RECONCILIATION_INVALID_RECEIPT',[event(A)],[{...receipt(event(A)),retentionUntil:'invalid'}]));
test('invalid ledger event fails closed',()=>error('GDPR_B2_RECONCILIATION_INVALID_LEDGER_EVENT',[{...event(A),event_key:'not-a-uuid'}],[receipt(event(A))]));
test('non-array inventory fails closed',()=>assert.throws(()=>reconcileInventories({ledgerEvents:{},archivedReceipts:[]}),e=>e.code==='GDPR_B2_RECONCILIATION_INVALID_INVENTORY'));
