'use strict';

/**
 * RESEARCH ONLY — dry-run non-destructive APPLICATION rollback planning.
 *
 * Rollback must NEVER drop answers_extra. Doing so destroys newly recorded
 * Art. 9 political opinions, including archived ones and their provenance
 * during GDPR portability. The old backend can ignore the extra column.
 *
 * Inputs are ASSERTIONS by a caller, not verified deploy-system evidence.
 * The returned plan NEVER authorizes production traffic or issues SQL.
 */
const manifest=require('./opinionAnswersV2HistoricalManifest.json');
const {validateLegacyIds}=require('./opinionAnswersV2BackfillCandidate');
const ID=/^[a-z][a-z0-9_]{0,62}$/;

function planNonDestructiveHybridRollback({
  activePublishedIds,
  historicalIds=manifest.historicalIds,
  ingressPaused=false,
  inFlightWritesDrained=false,
  cacheInvalidationConfirmed=false,
  externalGdprRestoreGateConfirmed=false
}={}){
  const blockers=[];
  let ids;
  try{
    ids=validateLegacyIds(historicalIds);
    if(ids.length!==manifest.historicalIds.length ||
      ids.some((id,index)=>id!==manifest.historicalIds[index])){
      throw Error('historical catalog altered');
    }
  }catch(_error){
    blockers.push('HISTORICAL_94_COLUMN_MANIFEST_CHANGED');
  }
  let futureActive=[];
  if(!Array.isArray(activePublishedIds)||!activePublishedIds.length||
      activePublishedIds.length>512||
      activePublishedIds.some(id=>typeof id!=='string'||!ID.test(id))||
      new Set(activePublishedIds).size!==activePublishedIds.length){
    blockers.push('ACTIVE_CATALOG_NOT_VERIFIED');
  }else{
    const historic=new Set(manifest.historicalIds);
    futureActive=activePublishedIds.filter(id=>!historic.has(id));
    if(futureActive.length){
      blockers.push('FUTURE_OPINIONS_MUST_BE_UNPUBLISHED_BEFORE_OLD_API');
    }
  }
  if(ingressPaused!==true)blockers.push('INGRESS_NOT_PAUSED');
  if(inFlightWritesDrained!==true)blockers.push('IN_FLIGHT_WRITES_NOT_DRAINED');
  if(cacheInvalidationConfirmed!==true)blockers.push('OLD_CLIENT_CACHE_NOT_INVALIDATED');
  if(externalGdprRestoreGateConfirmed!==true){
    blockers.push('EXTERNAL_GDPR_GATE_NOT_VERIFIED');
  }

  return Object.freeze({
    mode:'research-dry-run',
    // Even when mechanically safe, explicit approval and verified
    // infrastructure orchestration remain necessary.
    rollbackAuthorized:false,
    mechanicallyCompatible:blockers.length===0,
    historicalColumnsRetained:manifest.historicalIds.length,
    preserveColumn:'answers_extra',
    preserveHistoricalSources:true,
    // No DROP / TRUNCATE / DELETE / UPDATE appears in this rollback plan.
    rollbackDatabaseStatements:Object.freeze([]),
    futureActiveCount:futureActive.length,
    blockers:Object.freeze(blockers)
  });
}
module.exports={planNonDestructiveHybridRollback};
