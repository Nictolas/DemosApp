'use strict';

/**
 * RESEARCH ONLY — hybrid layout GDPR export/deletion and backup replay.
 * In the hybrid design ALL political answers (94 TEXT fields, future
 * answers_extra JSONB, fonti_opinioni JSONB) live in one legacy table.
 * This module is NOT imported by production routes and MUST NOT be used
 * without real authentication, an external restore gate and a transaction
 * holding users FOR UPDATE before any revocation or account erasure.
 */
const {validateLegacyIds,legacyRowToAnswers}=
  require('./opinionAnswersV2BackfillCandidate');
const {sanitizeStoredDocument}=require('./opinionAnswersV2Candidate');
const {validateSourceMap}=require('./opinionAnswersV2SourcesCandidate');
const {planPostSnapshotPoliticalErasure}=
  require('./opinionAnswersV2GdprCandidate');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function subject(value){
  if(typeof value!=='string'||!UUID.test(value)){
    throw new TypeError('Canonical user UUID required');
  }
  return value.toLowerCase();
}

/**
 * Requires an authorized SELECT * of the OWN opinion row, after restore
 * readiness was established and the user's rights were authenticated.
 * Future/archived answers and historical sources are included in an
 * authorized GDPR subject export, but NOT in the public catalog.
 * Omissions, collisions and invalid stored data fail closed.
 */
function projectHybridGdprSubjectExport(authorizedUserId,databaseRow,historicalIds){
  const own=subject(authorizedUserId);
  const ids=validateLegacyIds(historicalIds);
  if(databaseRow==null)return null;
  if(typeof databaseRow!=='object'||Array.isArray(databaseRow)||
      subject(databaseRow.user_id)!==own){
    throw new Error('GDPR_HYBRID_SUBJECT_MISMATCH');
  }
  if(!Object.prototype.hasOwnProperty.call(databaseRow,'fonti_opinioni')||
      !Object.prototype.hasOwnProperty.call(databaseRow,'answers_extra')){
    throw new Error('GDPR_HYBRID_EXPORT_INCOMPLETE_ROW');
  }
  const old=legacyRowToAnswers(databaseRow,ids);
  const future=sanitizeStoredDocument(databaseRow.answers_extra);
  for(const id of Object.keys(future)){
    if(ids.includes(id))throw new Error('GDPR_HYBRID_DUPLICATE_HISTORICAL_ID');
  }
  // Do not silently omit any archived source. validateSourceMap checks
  // structure and byte limits; historic outliers require a preflight audit.
  const sources=validateSourceMap(databaseRow.fonti_opinioni);
  const answers=Object.create(null);
  for(const id of Object.keys({...old,...future}).sort()){
    answers[id]=Object.prototype.hasOwnProperty.call(old,id)?old[id]:future[id];
  }
  const sourceExport=Object.create(null);
  for(const id of Object.keys(sources).sort())sourceExport[id]=sources[id];
  return {
    format:'demos-opinion-answers-hybrid',
    answers_by_id:answers,
    sources_by_id:sourceExport,
    historical_columns_included:ids.length,
    future_opinions_included:Object.keys(future).length
  };
}

const SQL=Object.freeze({
  deleteWholeRow:'DELETE FROM public.opinioni_risposte WHERE user_id=$1::uuid',
  authorizedExport:'SELECT * FROM public.opinioni_risposte WHERE user_id=$1::uuid'
});

/**
 * Must be called inside the EXISTING authorized consent-revocation or
 * account-deletion transaction after the same users row FOR UPDATE lock.
 * A missing target table will raise 42P01: never swallow the exception.
 * Deletes old answers + new JSONB + sources atomically by deleting one row.
 */
async function deleteHybridOpinionsInsideGdprTransaction(client,userId){
  if(!client||typeof client.query!=='function'){
    throw new TypeError('PostgreSQL transaction client required');
  }
  const result=await client.query(SQL.deleteWholeRow,[subject(userId)]);
  if(!result||!Number.isInteger(result.rowCount)||result.rowCount<0){
    throw new Error('HYBRID_GDPR_DELETE_UNVERIFIED');
  }
  return result.rowCount;
}

/**
 * This is deliberately only a *plan*, not evidence that the external
 * erasure ledger is complete, durable or synchronized with the restored
 * snapshot. A trusted external coordinator must attest watermark and
 * completeness BEFORE replay and keep all external traffic blocked.
 *
 * In this layout, ONE row deletion covers both historical and future
 * answers even when the user re-grants political consent after revocation.
 */
function planHybridPostRestoreErasure(externalEvents,{snapshotAt}={}){
  const v2Plan=planPostSnapshotPoliticalErasure(externalEvents,{snapshotAt});
  return v2Plan.map(item=>({
    user_id:item.user_id,
    erase_hybrid_opinion_row:true,
    account_deleted:item.account_deleted
  }));
}

module.exports={
  SQL,projectHybridGdprSubjectExport,
  deleteHybridOpinionsInsideGdprTransaction,
  planHybridPostRestoreErasure
};
