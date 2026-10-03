const {evaluateIdentityActivityCutoverReadiness}=require('./identityActivityCutoverReadiness');
const {persistMigrationEvidence}=require('./identityLifecycleMigrationEvidence');
const recordLiveMigrationEvidence=async(client,{migrationVersion,now=new Date()})=>{
 const readiness=await evaluateIdentityActivityCutoverReadiness(client);
 const evidence={migrationVersion,schemaReady:readiness.schemaReady===true,backfillReady:readiness.backfillReady===true,missingAccounts:Number(readiness.missingAccounts??-1),laggingAccounts:Number(readiness.laggingAccounts??-1),observedAt:new Date(now).toISOString()};
 if(evidence.missingAccounts<0||evidence.laggingAccounts<0)throw new Error('Complete live parity required before durable evidence');
 const persisted=await persistMigrationEvidence(client,evidence);
 return{evidence,...persisted};
};
module.exports={recordLiveMigrationEvidence};
