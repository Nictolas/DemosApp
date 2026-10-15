const VERSION='v0.42';
const ROUTES=Object.freeze(['/overview','/incidents','/health','/notifications','/ai-analyses','/ai-orchestrator','/ai-policy','/approvals','/boundary-audit']);
const METHODS=Object.freeze(['GET']);
function securityCenterRouteContract(){return Object.freeze({version:VERSION,methods:METHODS,routes:ROUTES,adminOnly:true,readOnly:true,authorized:false,executable:false,actionRunnerAvailable:false});}
module.exports={VERSION,ROUTES,METHODS,securityCenterRouteContract};