const VERSION='v0.40';
function unavailableConsistency(){return Object.freeze({available:false,ok:false,issueCount:1,issues:Object.freeze(['CONSISTENCY_UNAVAILABLE']),executable:false});}
function readApprovalConsistency(gate){
 if(!gate||typeof gate.consistency!=='function') return unavailableConsistency();
 try{const raw=gate.consistency();const issues=Array.isArray(raw?.issues)?[...new Set(raw.issues.map(x=>String(x).slice(0,64)))]:[];return Object.freeze({available:true,ok:raw?.ok===true,issueCount:issues.length,issues:Object.freeze(issues),executable:false});}
 catch(_e){return Object.freeze({available:true,ok:false,issueCount:1,issues:Object.freeze(['CONSISTENCY_READ_FAILED']),executable:false});}
}
function approvalHealth(consistency){return Object.freeze({version:VERSION,level:!consistency.available?'gray':consistency.ok?'green':'orange',available:consistency.available===true,issueCount:consistency.issueCount||0,executable:false,actionRunnerAvailable:false});}
module.exports={VERSION,readApprovalConsistency,approvalHealth};