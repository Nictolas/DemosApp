'use strict';

/**
 * RESEARCH ONLY — guard against political-answer disclosure by differences
 * between two consecutive PUBLIC national/regional snapshot versions.
 *
 * Example: v1 shows 10 favorable respondents; v2 shows 10 favorable and
 * 1 contrary. Publishing both reveals the only new contrary response.
 * A minimum 10 TOTAL participants per snapshot does not prevent that.
 *
 * This module NEVER authorizes a NEW public release. It only decides
 * whether the previously reviewed/approved version could be reused.
 * Authenticity, historical publication ledger, approval, older client
 * caches, demographics, provincial/municipal slices and visibility of
 * past versions require external review, not provided here.
 */
const {
  isMintedPublication
}=require('./opinionAnswersV2PublishedSnapshotCandidate');
const {REGIONI_DB_TO_FRONTEND}=require('../utils/regioniUtils');
const REGION_CODES=Object.keys(REGIONI_DB_TO_FRONTEND);

function report(code,{reuseExisting=false,details=[]}={}){
  return Object.freeze({
    mode:'research-fail-closed',
    action:reuseExisting?'REUSE_PREVIOUS_VERSION':'BLOCK_NEW_PUBLICATION',
    releaseAuthorized:false,
    // This only describes technical reuse: it does NOT prove that the
    // previous publication had independent GDPR/privacy approval.
    requiresIndependentReview:!reuseExisting,
    canReusePreviouslyApprovedVersion:reuseExisting,
    blockers:Object.freeze(details.length?details.slice():[code])
  });
}
function sameSurface(a,b){
  // Factory builds deterministically ordered, frozen public payloads.
  // Compare only what was or would be released, not unfiltered SQL rows.
  return JSON.stringify(a)===JSON.stringify(b);
}
function evaluateLongitudinalOpinionPublication({previous=null,proposed}={}){
  if(!isMintedPublication(proposed)){
    return report('PROPOSED_SNAPSHOT_NOT_VERIFIED');
  }
  if(previous===null){
    // A first public release may contain a positive category with fewer
    // than 10 answers; a snapshot threshold on group total is not
    // sufficient authorization to publish it.
    return report('FIRST_RELEASE_REQUIRES_INDEPENDENT_PRIVACY_REVIEW');
  }
  if(!isMintedPublication(previous)){
    return report('PREVIOUS_SNAPSHOT_NOT_VERIFIED');
  }
  if(previous.opinionId!==proposed.opinionId){
    return report('OPINION_ID_CHANGED');
  }
  const publicDiffs=[];
  if(!sameSurface(previous.national,proposed.national)){
    publicDiffs.push('NATIONAL_PUBLIC_COUNTS_OR_SUPPRESSION_CHANGED');
  }
  for(const code of REGION_CODES){
    if(!sameSurface(previous.regionsByCode[code],
      proposed.regionsByCode[code])){
      // Do not include values or source data in audit errors.
      publicDiffs.push('REGIONAL_PUBLIC_COUNTS_OR_SUPPRESSION_CHANGED');
      break;
    }
  }
  if(publicDiffs.length){
    if(previous.version===proposed.version){
      publicDiffs.unshift('SAME_VERSION_REUSED_FOR_DIFFERENT_RESULTS');
    }
    // A small time delta may reveal one respondent even when BOTH
    // versions individually pass the static k=10 threshold.
    return report('TEMPORAL_DIFFERENCING_RISK',{details:publicDiffs});
  }
  // Counts and all regional visibility decisions are identical.
  // Do not mint a needless new version: keep serving the previously
  // independently approved immutable envelope. In a real deployment
  // previous must be validated against an external append-only ledger.
  return report('NO_PUBLIC_CHANGE',{reuseExisting:true});
}
module.exports={evaluateLongitudinalOpinionPublication};
