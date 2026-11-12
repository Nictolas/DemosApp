'use strict';

/**
 * RESEARCH ONLY. Authorized, consent-filtered ONE-SELECT personal opinion
 * read usable by the inactive hybrid HTTP adapter via dependency injection.
 *
 * A PostgreSQL statement sees one consistent MVCC snapshot for user,
 * consent and answer row. The answer JOIN itself is guarded by explicit
 * Art. 9 consent: a denied user has no political row projected into
 * query results, even temporarily. This does not authorize a production
 * integration or replace ingress-level GDPR/B2 restore coordination.
 *
 * Authentication MUST bind userId to the independently verified access
 * token. NEVER accept a user ID supplied in URL/body/query/header.
 */
// Factory provenance is private: a route may only accept a reader whose
// external restore gate is the SAME dependency used by public stats.
// This avoids accidentally delegating sensitive reads to an unchecked
// function when removing the redundant route-level gate call.
const authorizedReaders=new WeakMap();
function isHybridReadWithGate(reader,externalGate){
  return typeof reader==='function' &&
    typeof externalGate==='function' &&
    authorizedReaders.has(reader) &&
    authorizedReaders.get(reader)===externalGate;
}
const USER_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SELECT_AUTHORIZED_HYBRID_ROW_SQL=[
  'SELECT u.id AS subject_id,',
  '  COALESCE(uc.political_opinions_consent,',
  '           u.political_opinions_consent, false) AS granted,',
  '  to_jsonb(orr) AS answer_row',
  'FROM users u',
  'LEFT JOIN user_consents uc ON uc.user_id=u.id',
  'LEFT JOIN opinioni_risposte orr ON orr.user_id=u.id',
  '  AND COALESCE(uc.political_opinions_consent,',
  '               u.political_opinions_consent, false) IS TRUE',
  'WHERE u.id=$1::uuid'
].join('\n');

function restoreUnavailable(){
  const error=new Error('RESTORE_NOT_READY');
  error.code='RESTORE_NOT_READY';
  return error;
}

function createHybridAuthorizedReadCandidate({
  db,assertRestoreReady
}={}){
  if(!db||typeof db.query!=='function'||
    typeof assertRestoreReady!=='function'){
    throw new TypeError('Read-only DB and external restore gate required');
  }
  const loadOwnAuthorizedRow=async function(authenticatedUserId){
    if(typeof authenticatedUserId!=='string'||
      !USER_ID.test(authenticatedUserId)){
      throw new TypeError('Authenticated canonical UUID required');
    }
    // No PostgreSQL statement is allowed before the external gate.
    const verified=await assertRestoreReady();
    if(verified!==true)throw restoreUnavailable();
    const canonical=authenticatedUserId.toLowerCase();
    const result=await db.query(
      SELECT_AUTHORIZED_HYBRID_ROW_SQL,[canonical]
    );
    if(!result||!Array.isArray(result.rows)||
      result.rows.length>1)throw Error('Unexpected authorized read result');
    if(!result.rows.length)return {status:'missing'};
    const item=result.rows[0];
    if(!item||item.subject_id!==canonical ||
      typeof item.granted!=='boolean'){
      throw Error('Invalid authorized read result');
    }
    if(item.granted!==true){
      // The SQL JOIN already ensured answer_row is NULL.
      if(item.answer_row!==null){
        throw Error('Denied subject has unexpected political answer');
      }
      return {status:'forbidden'};
    }
    if(item.answer_row===null)return {status:'ok',row:null};
    const row=item.answer_row;
    if(!row||typeof row!=='object'||Array.isArray(row)||
      row.user_id!==canonical){
      throw Error('Political answer row belongs to wrong subject');
    }
    return {status:'ok',row};
  };
  authorizedReaders.set(loadOwnAuthorizedRow,assertRestoreReady);
  return loadOwnAuthorizedRow;
}
module.exports={
  SELECT_AUTHORIZED_HYBRID_ROW_SQL,
  createHybridAuthorizedReadCandidate,isHybridReadWithGate
};
