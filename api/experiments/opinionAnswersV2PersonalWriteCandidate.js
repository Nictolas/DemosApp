'use strict';

/**
 * RESEARCH ONLY: a personal (not Admin) POST /salva transaction candidate.
 *
 * Authentication must bind userId to verifyToken, never body/header identity.
 * Restore must be blocked at infrastructure ingress; checking it here before
 * BEGIN is necessary but insufficient for the in-flight restore race.
 *
 * Lock users first, re-read consent as a NEW statement after the lock,
 * then read only the existing answers being changed. One atomic UPSERT
 * patches all old/new values, notifies on actual changes (never first
 * answers), and never issues an UPDATE/WAL for unchanged values.
 */
const {sanitizePublishedDelta}=
  require('./opinionAnswersV2Candidate');
const {validateLegacyIds}=
  require('./opinionAnswersV2BackfillCandidate');
const {
  planHybridAnswerChanges,buildHybridAtomicAnswerUpsert
}=require('./opinionAnswersV2HybridCandidate');
const {LOCK_SUBJECT_SQL,CHECK_CONSENT_SQL}=
  require('./opinionAnswersV2AuthorizedWriteCandidate');
// Explicit UUID shape, NOT the only authentication/authorization mechanism.
const CANONICAL_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function fail(code){
  const error=new Error(code);error.code=code;return error;
}

function buildHybridChangedAnswerSelect(delta,immutableIds){
  const historic=new Set(validateLegacyIds(immutableIds));
  const fields=Object.keys(delta).filter(id=>historic.has(id))
    .sort().map(id=>'"'+id+'"');
  return 'SELECT '+[...fields,'answers_extra'].join(',')+
    ' FROM opinioni_risposte WHERE user_id=$1::uuid FOR UPDATE';
}

async function executeAuthorizedHybridPersonalSave({
  client,userId,answerPatch,publishedIds,historicalIds,
  assertRestoreReady,recordChangeNotifications
}={}){
  if(!client||typeof client.query!=='function'||
    typeof assertRestoreReady!=='function'||
    typeof recordChangeNotifications!=='function'||
    typeof userId!=='string'||!CANONICAL_UUID.test(userId)){
    throw new TypeError('Authenticated user, PG transaction and notification/restore hooks required');
  }
  // All submitted keys and codes checked before any SQL or external call.
  const changes=sanitizePublishedDelta(answerPatch,publishedIds);
  const history=validateLegacyIds(historicalIds);
  const canonical=userId.toLowerCase();
  if(await assertRestoreReady()!==true)throw fail('RESTORE_NOT_READY');
  let began=false,committed=false;
  try{
    await client.query('BEGIN');
    began=true;
    const locked=await client.query(LOCK_SUBJECT_SQL,[canonical]);
    if(!locked||!Array.isArray(locked.rows)||locked.rows.length!==1||
      locked.rows[0].id!==canonical)throw fail('SUBJECT_NOT_FOUND');
    // Independent statement AFTER lock, not consent read during locking SELECT.
    const consent=await client.query(CHECK_CONSENT_SQL,[canonical]);
    if(!consent||!Array.isArray(consent.rows)||consent.rows.length!==1||
      consent.rows[0].granted!==true)throw fail('POLITICAL_CONSENT_REQUIRED');

    const sql=buildHybridChangedAnswerSelect(changes,history);
    const existing=await client.query(sql,[canonical]);
    if(!existing||!Array.isArray(existing.rows)||existing.rows.length>1){
      throw fail('HYBRID_PREIMAGE_UNVERIFIED');
    }
    const plan=planHybridAnswerChanges(
      existing.rows.length?existing.rows[0]:null,
      changes,publishedIds,history
    );
    if(plan.changedCount===0){
      await client.query('COMMIT');
      committed=true;
      return {
        savedCount:plan.acceptedCount,changedCount:0,
        firstAnswers:[],changedOpinionsForPush:[],
        notificationsCreated:0
      };
    }
    const update=buildHybridAtomicAnswerUpsert(
      plan.changed,publishedIds,history,canonical
    );
    const written=await client.query(update.sql,update.params);
    if(!written||written.rowCount!==1){
      throw fail('HYBRID_PERSONAL_SAVE_UNVERIFIED');
    }
    let notificationsCreated=0;
    if(plan.notifications.length){
      // Must use the SAME transaction. A failed notification write rolls
      // back the changed answer; push happens only after external COMMIT.
      const notices=await recordChangeNotifications(
        client,canonical,plan.notifications
      );
      if(!notices||!Number.isSafeInteger(notices.created)||
        notices.created<0){
        throw fail('HYBRID_NOTIFICATION_UNVERIFIED');
      }
      notificationsCreated=notices.created;
    }
    await client.query('COMMIT');
    committed=true;
    return {
      savedCount:plan.acceptedCount,
      changedCount:plan.changedCount,
      firstAnswers:plan.firstAnswers,
      changedOpinionsForPush:plan.notifications,
      notificationsCreated
    };
  }catch(error){
    if(began&&!committed){
      try{await client.query('ROLLBACK');}
      catch(rollbackError){
        throw new AggregateError([error,rollbackError],
          'Hybrid personal save and rollback failed');
      }
    }
    throw error;
  }
}
module.exports={
  buildHybridChangedAnswerSelect,
  executeAuthorizedHybridPersonalSave
};
