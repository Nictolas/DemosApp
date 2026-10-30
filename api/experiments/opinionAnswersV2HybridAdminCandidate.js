'use strict';

/**
 * RESEARCH ONLY — atomic hybrid ADMIN answer + source patch.
 * No route imports this file. User identity, political consent and restore
 * readiness MUST be checked by the authorized caller in a transaction
 * AFTER locking users FOR UPDATE.
 *
 * Admin profile currently fetches the entire fonti_opinioni JSON document
 * and overwrites it, risking lost updates when edits overlap. This candidate
 * merges just the changed keys in PostgreSQL, preserving unrelated and
 * archived sources, without SELECT for source pre-images, catalog SQL, or
 * information_schema queries.
 */
const {splitHybridDelta}=require('./opinionAnswersV2HybridCandidate');
const {validateLegacyIds}=require('./opinionAnswersV2BackfillCandidate');
const ID=/^[a-z][a-z0-9_]{0,62}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_BYTES=8192;
function plain(x){
  return x!==null && typeof x==='object' && !Array.isArray(x) &&
    (Object.getPrototypeOf(x)===Object.prototype ||
     Object.getPrototypeOf(x)===null);
}
function extractSources(raw,published){
  const added=Object.create(null),removed=[];
  if(raw===undefined)return {added,removed};
  if(!plain(raw)||!(published instanceof Set)){
    throw new TypeError('Source patch must be a plain object and catalog a Set');
  }
  const entries=Object.entries(raw);
  if(entries.length>512)throw new RangeError('Too many source edits');
  for(const [id,source] of entries){
    if(!ID.test(id)||!published.has(id)){
      throw new RangeError('Unpublished or unsafe opinion source ID');
    }
    if(source===null || (typeof source==='string' && source.trim()==='')){
      removed.push(id);
      continue;
    }
    if(typeof source!=='string'||
       Buffer.byteLength(source,'utf8')>MAX_SOURCE_BYTES){
      throw new TypeError('Source must be text, empty text or null; max 8192 bytes');
    }
    added[id]=source;
  }
  return {added,removed};
}

/**
 * Every SQL identifier comes from a validated immutable manifest.
 * Values, future IDs, source patches and removal arrays are PostgreSQL
 * parameters. Removal-only patches use UPDATE, never INSERT: removing
 * an absent source cannot create an empty political-opinion row.
 *
 * Returns {sql,params,answerCount,sourceCount} or null for no changes.
 * A sourceCount is the number of requested edits, NOT evidence that the
 * corresponding source existed; the authorized caller decides the
 * notification / audit semantics based on the locked current row.
 */
function buildHybridAtomicAdminUpsert({
  userId,answerPatch,sourcePatch,publishedIds,historicalIds
}={}){
  if(typeof userId!=='string'||!UUID.test(userId)){
    throw new TypeError('Canonical user UUID required');
  }
  if(!(publishedIds instanceof Set))throw new TypeError('Published IDs Set required');
  const legacyIds=validateLegacyIds(historicalIds);
  const legacySet=new Set(legacyIds);
  let legacy=Object.create(null),overflow=Object.create(null);
  if(answerPatch!==undefined){
    if(!plain(answerPatch))throw new TypeError('Answer patch must be a plain object');
    if(Object.keys(answerPatch).length){
      const split=splitHybridDelta(answerPatch,publishedIds,legacyIds);
      legacy=split.legacyColumns;
      overflow=split.extraPatch;
    }
  }
  const source=extractSources(sourcePatch,publishedIds);
  const answerCount=Object.keys(legacy).length+Object.keys(overflow).length;
  const sourceCount=Object.keys(source.added).length+source.removed.length;
  if(!answerCount&&!sourceCount)return null;

  const params=[userId.toLowerCase()];
  function param(value,cast=''){
    params.push(value);
    return '$'+params.length+cast;
  }
  // Remove-only source edits cannot create a new empty answers row.
  if(!answerCount&&!Object.keys(source.added).length){
    return {
      sql:'UPDATE opinioni_risposte AS current SET '+
        "fonti_opinioni=COALESCE(current.fonti_opinioni,'{}'::jsonb) - "+
        param(source.removed,'::text[]')+
        ' WHERE user_id=$1::uuid RETURNING user_id',
      params,answerCount,sourceCount
    };
  }

  const columns=['user_id'],values=['$1::uuid'],updates=[];
  for(const id of Object.keys(legacy).sort()){
    if(!legacySet.has(id))throw new Error('Unrecognized legacy source identifier');
    const col='"'+id+'"';
    columns.push(col);
    values.push(param(legacy[id]));
    updates.push(col+'=EXCLUDED.'+col);
  }
  const extraIds=Object.keys(overflow);
  if(extraIds.length){
    columns.push('answers_extra');
    values.push(param(JSON.stringify(overflow),'::jsonb'));
    updates.push(
      "answers_extra=COALESCE(current.answers_extra,'{}'::jsonb) || EXCLUDED.answers_extra"
    );
  }
  if(sourceCount){
    columns.push('fonti_opinioni');
    values.push(param(JSON.stringify(source.added),'::jsonb'));
    updates.push(
      "fonti_opinioni=(COALESCE(current.fonti_opinioni,'{}'::jsonb) - "+
      param(source.removed,'::text[]')+
      ') || EXCLUDED.fonti_opinioni'
    );
  }
  return {
    sql:'INSERT INTO opinioni_risposte AS current ('+columns.join(',')+') '+
      'VALUES ('+values.join(',')+') '+
      'ON CONFLICT(user_id) DO UPDATE SET '+updates.join(',')+
      ' RETURNING user_id',
    params,answerCount,sourceCount
  };
}
module.exports={buildHybridAtomicAdminUpsert};
