'use strict';

/**
 * RESEARCH ONLY — consent-safe hybrid admin write orchestration.
 * No production route imports this module. It exercises the same users-row
 * serialization discipline as the active opinion save/revocation endpoints.
 *
 * Required dependencies are intentionally explicit. The actor verifier must
 * authenticate/authorize the admin INSIDE this transaction and hold any
 * necessary role lock; the external restore gate must be enforced at ingress
 * as well (a request-time check cannot stop an in-flight restore).
 *
 * Fail closed: this function never creates consent, never revives deleted
 * answers, and never uses the unaudited pre-lock consent snapshot.
 */
const {buildHybridAtomicAdminUpsert}=
  require('./opinionAnswersV2HybridAdminCandidate');

const LOCK_SUBJECT_SQL='SELECT id FROM users WHERE id=$1::uuid FOR UPDATE';
const CHECK_CONSENT_SQL=[
  'SELECT COALESCE(uc.political_opinions_consent,',
  '                u.political_opinions_consent, false) AS granted',
  'FROM users u',
  'LEFT JOIN user_consents uc ON uc.user_id=u.id',
  'WHERE u.id=$1::uuid'
].join('\n');

function reject(code){
  const error=new Error(code);
  error.code=code;
  return error;
}

async function executeAuthorizedHybridAdminMutation({
  client,principalId,userId,answerPatch,sourcePatch,
  publishedIds,historicalIds,assertRestoreReady,
  assertActorAuthorized
}={}){
  if(!client||typeof client.query!=='function'||
    typeof assertRestoreReady!=='function'||
    typeof assertActorAuthorized!=='function'||
    typeof principalId!=='string'||!principalId){
    throw new TypeError('DB client, principal and authorization/restore gates required');
  }
  // Validate all payload keys and prepare the one-statement mutation before
  // opening the transaction. No SQL identifier comes from request strings.
  const patch=buildHybridAtomicAdminUpsert({
    userId,answerPatch,sourcePatch,publishedIds,historicalIds
  });
  // The gate's verifier MUST be external to the restored database.
  const restoreReady=await assertRestoreReady();
  if(restoreReady!==true)throw reject('RESTORE_NOT_READY');

  let began=false;
  try{
    await client.query('BEGIN');
    began=true;
    // Caller-supplied verifier must check the actor's permissions under a
    // transactionally stable role/authorization lock.
    const authorized=await assertActorAuthorized(client,principalId,userId);
    if(authorized!==true)throw reject('ADMIN_NOT_AUTHORIZED');

    // IMPORTANT: the lock and consent MUST be separate PG statements in
    // READ COMMITTED, because a revoked consent can commit while FOR UPDATE
    // is waiting. The next statement sees the new committed consent.
    const locked=await client.query(LOCK_SUBJECT_SQL,[userId]);
    if(!locked||!Array.isArray(locked.rows)||locked.rows.length!==1){
      throw reject('SUBJECT_NOT_FOUND');
    }
    const checked=await client.query(CHECK_CONSENT_SQL,[userId]);
    if(!checked||!Array.isArray(checked.rows)||checked.rows.length!==1||
      checked.rows[0].granted!==true){
      throw reject('POLITICAL_CONSENT_REQUIRED');
    }

    if(!patch){
      await client.query('COMMIT');
      return {saved:false,answerCount:0,sourceCount:0};
    }

    const saved=await client.query(patch.sql,patch.params);
    // Pure source removals can affect zero rows (when no row exists).
    const removalOnly=patch.answerCount===0&&
      /^UPDATE opinioni_risposte AS current SET /.test(patch.sql);
    if(!saved||!Number.isInteger(saved.rowCount)||
      saved.rowCount<0||
      (!removalOnly&&saved.rowCount!==1)||
      (removalOnly&&saved.rowCount>1)){
      throw reject('HYBRID_MUTATION_UNVERIFIED');
    }
    await client.query('COMMIT');
    return {
      saved:saved.rowCount===1,
      answerCount:patch.answerCount,sourceCount:patch.sourceCount
    };
  }catch(error){
    if(began){
      try{
        await client.query('ROLLBACK');
      }catch(rollbackError){
        throw new AggregateError([error,rollbackError],
          'Hybrid write and rollback both failed');
      }
    }
    throw error;
  }
}

module.exports={
  LOCK_SUBJECT_SQL,CHECK_CONSENT_SQL,
  executeAuthorizedHybridAdminMutation
};
