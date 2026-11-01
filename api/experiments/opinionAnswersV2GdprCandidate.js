'use strict';

/**
 * RESEARCH ONLY — no route/service imports. Candidate adapter for future
 * political-consent revocation, account erasure, GDPR export, and recovery.
 *
 * This is NOT the authorization/transaction/restore coordinator. Callers
 * must hold the same public.users FOR UPDATE lock as all opinion writers,
 * re-read consent after acquiring it, and execute legacy+v2 deletion in
 * that ONE transaction. Do not switch on in production before GDPR routes,
 * backup recovery and external replay gates are integrated and verified.
 */
const {sanitizeStoredDocument} = require('./opinionAnswersV2Candidate');
const {validateSourceMap} = require('./opinionAnswersV2SourcesCandidate');

const DELETE_V2_SQL =
  'DELETE FROM demos_private.opinion_answer_maps_v2 WHERE user_id = $1::uuid';
const SELECT_V2_EXPORT_SQL =
  'SELECT user_id, answers FROM demos_private.opinion_answer_maps_v2 WHERE user_id = $1::uuid';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_EVENTS=new Set([
  'account_deleted','political_consent_revoked','political_consent_granted'
]);

function asUuid(value) {
  if(typeof value!=='string' || !UUID_RE.test(value)) {
    throw new TypeError('Expected canonical UUID');
  }
  return value.toLowerCase();
}

/**
 * Explicitly named and transactional-context-only delete primitive.
 * Must be invoked with an ALREADY-OPEN PostgreSQL transaction holding
 * the users row lock. It does not query information_schema at runtime:
 * a missing v2 table MUST fail closed instead of silently skipping erasure.
 */
async function deleteV2AnswersInsideGdprTransaction(client, userId) {
  if(!client || typeof client.query!=='function') {
    throw new TypeError('PostgreSQL transaction client required');
  }
  const {rowCount} = await client.query(DELETE_V2_SQL,[asUuid(userId)]);
  if(!Number.isInteger(rowCount) || rowCount<0) {
    throw new TypeError('Invalid deletion result; fail closed');
  }
  return rowCount;
}

/**
 * Single-user export adapter. Caller must have authenticated and authorized
 * THIS subject and checked GDPR restore-readiness BEFORE querying v2.
 * Historical (archived) opinion answers are intentionally retained for
 * an authorized data subject export, but not exposed by public catalog GET.
 */
function projectV2GdprExport(subjectUserId, databaseRow) {
  const subject=asUuid(subjectUserId);
  if(databaseRow===null || databaseRow===undefined) return null;
  if(!databaseRow || asUuid(databaseRow.user_id)!==subject) {
    throw new Error('GDPR_EXPORT_SUBJECT_MISMATCH');
  }
  const source=sanitizeStoredDocument(databaseRow.answers);
  const answersById=Object.create(null);
  for(const id of Object.keys(source).sort()) answersById[id]=source[id];
  // Sources are part of the complete opinion export. An older candidate
  // row lacking the sources column is explicitly marked INCOMPLETE, not
  // confused with an empty sources map. This module never fetches legacy
  // sources or performs an authorization check by itself.
  const sourcesProvided=Object.prototype.hasOwnProperty.call(databaseRow,'sources');
  const sourcesById=sourcesProvided
    ? validateSourceMap(databaseRow.sources)
    : null;
  const exported={
    format:'demos-opinion-answers-v2',
    answers_by_id:answersById,
    answer_sources_included:sourcesProvided
  };
  if(sourcesProvided){
    const sourceCopy=Object.create(null);
    for(const id of Object.keys(sourcesById).sort()) sourceCopy[id]=sourcesById[id];
    exported.sources_by_id=sourceCopy;
  }
  return exported;
}

function isoTimeMs(value) {
  if(typeof value!=='string' ||
     !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    throw new TypeError('Timestamp with explicit timezone required');
  }
  const t=Date.parse(value);
  if(!Number.isFinite(t))throw new TypeError('Invalid timestamp');
  return t;
}

/**
 * Plan which OLD SNAPSHOT rows must be destroyed during post-restore replay.
 * A revocation followed by a NEW grant still MUST erase answers from before
 * that revocation. Therefore selecting only the latest consent event is not
 * sufficient. For each restored backup, a trustworthy external source must
 * prove ledger completeness and snapshot watermark separately.
 *
 * This plan is deliberately conservative: all relevant subjects whose
 * revocation/deletion occurred strictly after snapshotAt are marked for
 * deletion from BOTH legacy and v2, even if later re-granted. It does not
 * itself prove external log durability, event ordering, or access gating.
 */
function planPostSnapshotPoliticalErasure(events,{snapshotAt}={}) {
  const cut=isoTimeMs(snapshotAt);
  if(!Array.isArray(events))throw new TypeError('External event list required');
  const seen=new Map();
  const flagged=new Map();
  for(const event of events){
    if(!event || typeof event!=='object' || Array.isArray(event) ||
       typeof event.event_key!=='string' || !event.event_key ||
       !VALID_EVENTS.has(event.event_type)) {
      throw new TypeError('Malformed external privacy event');
    }
    const userId=asUuid(event.subject_user_id);
    const at=isoTimeMs(event.occurred_at);
    const identity=JSON.stringify([userId,event.event_type,at]);
    if(seen.has(event.event_key)){
      if(seen.get(event.event_key)!==identity) {
        throw new Error('Conflicting duplicate privacy event key');
      }
      continue;
    }
    seen.set(event.event_key,identity);
    if(at<cut || event.event_type==='political_consent_granted')continue;
    const prior=flagged.get(userId);
    const accountDeleted=event.event_type==='account_deleted';
    flagged.set(userId,{
      user_id:userId,
      erase_legacy_answers:true,
      erase_v2_answers:true,
      account_deleted:accountDeleted || (prior?.account_deleted===true)
    });
  }
  return [...flagged.values()].sort((a,b)=>a.user_id.localeCompare(b.user_id));
}

module.exports={
  DELETE_V2_SQL,SELECT_V2_EXPORT_SQL,
  deleteV2AnswersInsideGdprTransaction,
  projectV2GdprExport,planPostSnapshotPoliticalErasure
};
