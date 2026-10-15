const VERSION='v0.37';
function buildBoundaryAuditHealth(status={},audit=[]) {
 if(!status||status.mode!=='shadow') return Object.freeze({version:VERSION,level:'gray',available:false,invalidCount:0,authorized:false,executable:false,actionRunnerAvailable:false});
 const items=Array.isArray(audit)?audit:[]; const invalidCount=items.filter(x=>x&&x.validationOk===false).length;
 return Object.freeze({version:VERSION,level:invalidCount>0?'orange':'green',available:true,invalidCount,authorized:false,executable:false,actionRunnerAvailable:false});
}
module.exports={VERSION,buildBoundaryAuditHealth};