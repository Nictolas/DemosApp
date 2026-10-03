const APPROVAL_CONSISTENCY_ALERT_VERSION='v0.31';
const ISSUE_PRIORITY=Object.freeze({
  DUPLICATE_APPROVAL_ID:'P1',
  PENDING_COUNTER_MISMATCH:'P1',
  COUNTER_INVALID:'P1',
  RECORD_LIMIT_EXCEEDED:'P1',
  AUDIT_LIMIT_EXCEEDED:'P2'
});
function buildApprovalConsistencyAlerts(consistency={}) {
  if (consistency.ok === true) return Object.freeze({version:APPROVAL_CONSISTENCY_ALERT_VERSION,highestPriority:null,activeCount:0,alerts:Object.freeze([]),executable:false});
  const source=Array.isArray(consistency.issues)?consistency.issues:['CONSISTENCY_UNKNOWN'];
  const seen=new Set(); const alerts=[];
  for(const raw of source){
    const code=Object.prototype.hasOwnProperty.call(ISSUE_PRIORITY,raw)?raw:'CONSISTENCY_UNKNOWN';
    if(seen.has(code)) continue; seen.add(code);
    alerts.push(Object.freeze({priority:ISSUE_PRIORITY[code]||'P1',code:'APPROVAL_'+code,scope:'approvals',executable:false}));
  }
  alerts.sort((a,b)=>Number(a.priority.slice(1))-Number(b.priority.slice(1))||a.code.localeCompare(b.code));
  return Object.freeze({version:APPROVAL_CONSISTENCY_ALERT_VERSION,highestPriority:alerts[0]?.priority||null,activeCount:alerts.length,alerts:Object.freeze(alerts),executable:false});
}
module.exports={APPROVAL_CONSISTENCY_ALERT_VERSION,buildApprovalConsistencyAlerts};
