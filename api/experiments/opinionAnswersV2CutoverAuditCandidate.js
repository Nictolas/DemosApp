'use strict';

/**
 * RESEARCH ONLY — pre-release dry-run audit for hybrid opinion answers.
 *
 * This is NOT a deploy gate integrated with Render, GitHub branch protection,
 * Android or Supabase. It consumes caller-provided evidence, never reads
 * political answer rows, changes DB schema, or authorizes a release.
 *
 * Passing synthetic CI tests is NOT evidence that real GDPR/B2 restore,
 * longitudinal statistical privacy, Android or runtime middleware work.
 */
const historicalManifest=require('./opinionAnswersV2HistoricalManifest.json');
const {assertLegacySchemaInventory,validateLegacyIds}=
  require('./opinionAnswersV2BackfillCandidate');

const DEPENDENCIES=Object.freeze([
  Object.freeze({pr:384,key:'catalogInCode'}),
  Object.freeze({pr:464,key:'answerCache'}),
  Object.freeze({pr:374,key:'gdprRestore'})
]);
const REQUIRED_INTEGRATION=Object.freeze([
  'runtimeApiCompatibility',
  'postLockPoliticalConsent',
  'adminAuthorization',
  'realGdprB2RestoreWithExternalLedger',
  'androidBackwardCompatibility',
  'publicStatsLongitudinalPrivacyReview',
  'losslessRollbackAndNoStaleCache'
]);
const VERSION=/^[a-f0-9]{40}$/;
const OPINION_ID=/^[a-z][a-z0-9_]{0,62}$/;
function blocker(code,detail){
  return Object.freeze({code,detail});
}
function isObject(value){
  return value!==null && typeof value==='object' && !Array.isArray(value);
}
function verifyCatalog(catalogIds,history){
  if(!Array.isArray(catalogIds) || !catalogIds.length){
    throw new TypeError('Published opinion catalog required');
  }
  const published=new Set();
  for(const id of catalogIds){
    if(typeof id!=='string'||!OPINION_ID.test(id)||published.has(id)){
      throw new TypeError('Invalid/duplicate published opinion ID');
    }
    published.add(id);
  }
  // Every original column must remain in the immutable *historical*
  // manifest even when the published catalog later archives its question.
  const historic=new Set(history);
  return {
    publishedCount:published.size,
    historicalPublished:[...published].filter(id=>historic.has(id)).length,
    overflowPublished:[...published].filter(id=>!historic.has(id)).length
  };
}

function auditHybridCutoverReadiness({
  schemaColumns,catalogIds,
  historicalIds=historicalManifest.historicalIds,
  dependencyStatuses={},
  integrationChecks={},
  integrationCommit
}={}){
  const blockers=[];
  // An edited "immutable" ID manifest is a non-recoverable cutover risk.
  let historicalValid=false;
  try{
    const ids=validateLegacyIds(historicalIds);
    historicalValid=ids.length===historicalManifest.historicalIds.length &&
      ids.every((id,i)=>id===historicalManifest.historicalIds[i]);
  }catch(_e){
    historicalValid=false;
  }
  if(!historicalValid){
    blockers.push(blocker('IMMUTABLE_HISTORY_MISMATCH',
      '94 historical SQL IDs must exactly match frozen PR #384 manifest'));
  }
  let catalog=null;
  try{
    catalog=verifyCatalog(catalogIds,historicalManifest.historicalIds);
  }catch(_e){
    blockers.push(blocker('PUBLISHED_CATALOG_INVALID',
      'Catalog IDs must be unique, valid and loaded from versioned code'));
  }
  // Caller must supply fresh information_schema metadata from a
  // read-only preflight immediately before an authorized change.
  // The audit intentionally never performs any SQL itself.
  let schemaVerified=false,hasOverflow=false;
  try{
    const metadata=schemaColumns;
    if(!Array.isArray(metadata))throw Error('Metadata missing');
    assertLegacySchemaInventory(
      historicalManifest.historicalIds,metadata
    );
    schemaVerified=true;
    hasOverflow=metadata.some(row=>
      row.column_name==='answers_extra'&&row.data_type==='jsonb');
  }catch(_e){
    blockers.push(blocker('LIVE_SCHEMA_UNVERIFIED',
      'Read-only live schema preflight must confirm all 94 TEXT columns and service types'));
  }
  if(schemaVerified&&!hasOverflow){
    blockers.push(blocker('FUTURE_JSONB_COLUMN_NOT_PRESENT',
      'Future authorized single answers_extra JSONB DDL not applied'));
  }

  for(const {pr,key} of DEPENDENCIES){
    const x=isObject(dependencyStatuses)?dependencyStatuses[key]:null;
    if(!x||x.number!==pr||x.merged!==true||
      typeof x.integratedSha!=='string'||!VERSION.test(x.integratedSha)){
      blockers.push(blocker('REQUIRED_PR_NOT_INTEGRATED_'+pr,
        'PR #'+pr+' must be merged, retested and verified in target integration commit'));
    }
  }

  const hasCommit=typeof integrationCommit==='string'&&
    VERSION.test(integrationCommit);
  if(!hasCommit){
    blockers.push(blocker('INTEGRATION_COMMIT_NOT_PINNED',
      'Pin the exact integration target commit after merging coordinated PRs'));
  }

  for(const key of REQUIRED_INTEGRATION){
    const evidence=isObject(integrationChecks)?integrationChecks[key]:null;
    // This validates a report shape, not the authenticity of its contents.
    // A real release needs *independent* verification of every evidence
    // item; this function can never authorize the release on its own.
    const shapeCorrect=hasCommit && isObject(evidence) &&
      evidence.status==='pass'&&evidence.commit===integrationCommit&&
      typeof evidence.evidenceUrl==='string'&&
      /^https:\/\/[^ ]{4,2048}$/.test(evidence.evidenceUrl)&&
      typeof evidence.reviewedBy==='string'&&!!evidence.reviewedBy.trim();
    if(!shapeCorrect){
      blockers.push(blocker('MISSING_INDEPENDENT_EVIDENCE_'+key,
        'Need independent, commit-bound runtime/operational verification: '+key));
    }
  }

  blockers.push(blocker('MANUAL_RELEASE_AUTHORIZATION_REQUIRED',
    'This research-only audit never grants merge, production DDL or deployment permission'));
  return Object.freeze({
    mode:'dry-run',releaseAuthorized:false,
    mechanicallyReady:!blockers.some(x=>
      x.code!=='MANUAL_RELEASE_AUTHORIZATION_REQUIRED'),
    historicalIdsRequired:historicalManifest.historicalIds.length,
    schemaVerified,overflowColumnPresent:hasOverflow,catalog,
    requiredDependencies:DEPENDENCIES.map(x=>x.pr),
    blockers:Object.freeze(blockers)
  });
}
module.exports={
  DEPENDENCIES,REQUIRED_INTEGRATION,verifyCatalog,
  auditHybridCutoverReadiness
};
