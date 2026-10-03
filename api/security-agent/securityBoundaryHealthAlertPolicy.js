const VERSION='v0.39';
function buildBoundaryHealthAlerts(health={}) {
 const alerts=[];
 if(!health||health.available!==true||health.level==='gray') alerts.push({priority:'P2',code:'BOUNDARY_AUDIT_UNAVAILABLE',scope:'execution_boundary',executable:false});
 else if(health.level==='orange') alerts.push({priority:'P1',code:'BOUNDARY_VALIDATION_FAILURES',scope:'execution_boundary',executable:false});
 else if(health.level!=='green') alerts.push({priority:'P1',code:'BOUNDARY_HEALTH_UNKNOWN',scope:'execution_boundary',executable:false});
 return Object.freeze({version:VERSION,highestPriority:alerts[0]?.priority||null,activeCount:alerts.length,alerts:Object.freeze(alerts.map(Object.freeze)),authorized:false,executable:false,actionRunnerAvailable:false});
}
module.exports={VERSION,buildBoundaryHealthAlerts};