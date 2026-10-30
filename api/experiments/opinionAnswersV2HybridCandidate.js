'use strict';
/**
 * RESEARCH ONLY — a low-migration-risk alternative to replacing 94 TEXT
 * columns. Existing responses/fonti_opinioni remain in the SAME table.
 * One nullable answers_extra JSONB column is introduced ONCE; subsequent
 * new opinions are keys, not columns. No runtime route imports this file.
 * 
 * All writes STILL need users FOR UPDATE, a separate post-lock Art. 9
 * consent check, and the same restore/erasure coordination as legacy.
 */
const {sanitizePublishedDelta,sanitizeStoredDocument}=
  require('./opinionAnswersV2Candidate');
const {validateLegacyIds}=require('./opinionAnswersV2BackfillCandidate');
const VALID=new Set(['f','c','i']);
function plain(x){
  return x!==null && typeof x==='object' && !Array.isArray(x);
}
function splitHybridDelta(input,publishedIds,immutableLegacyIds){
  const changed=sanitizePublishedDelta(input,publishedIds);
  const legacy=new Set(validateLegacyIds(immutableLegacyIds));
  const columns=Object.create(null),extra=Object.create(null);
  for(const [id,answer] of Object.entries(changed)){
    if(legacy.has(id))columns[id]=answer;
    else extra[id]=answer;
  }
  return {legacyColumns:columns,extraPatch:extra};
}
function projectHybridAnswers(legacyRow,published,immutableLegacyIds){
  if(!plain(legacyRow)||!Array.isArray(published)){
    throw new TypeError('Hybrid projection requires DB row and public metadata');
  }
  const legacy=new Set(validateLegacyIds(immutableLegacyIds));
  const extra=sanitizeStoredDocument(legacyRow.answers_extra);
  for(const id of Object.keys(extra))if(legacy.has(id)){
    // Never silently prefer stale duplicate data from old and new fields.
    throw new Error('Duplicate hybrid legacy and overflow opinion ID');
  }
  const seen=new Set();
  return published.map(op=>{
    if(!op || typeof op.id!=='string' || typeof op.text!=='string' ||
       !Array.isArray(op.gradi_opinione) || seen.has(op.id)){
      throw new TypeError('Invalid published metadata');
    }
    seen.add(op.id);
    const raw=legacy.has(op.id)
      ? (Object.prototype.hasOwnProperty.call(legacyRow,op.id)?legacyRow[op.id]:null)
      : (Object.prototype.hasOwnProperty.call(extra,op.id)?extra[op.id]:null);
    if(raw!==null && !VALID.has(raw))throw new TypeError('Invalid stored legacy answer');
    return {id:op.id,text:op.text,grado:[...op.gradi_opinione],userAnswer:raw};
  });
}
/**
 * One authorized answer SELECT for both historical TEXT fields and all
 * future JSONB keys, with sources in the SAME legacy table. No query to
 * opinion catalog tables and no extra round-trip for overflow answers.
 * The grade's public metadata comes from the versioned code catalog.
 */
function buildHybridAnswerSelect(published,immutableLegacyIds) {
  if(!Array.isArray(published))throw new TypeError('Published metadata list required');
  const legacy=new Set(validateLegacyIds(immutableLegacyIds));
  const selected=new Set();
  for(const op of published){
    if(!op || typeof op.id!=='string' || !/^[a-z][a-z0-9_]{0,62}$/.test(op.id)){
      throw new TypeError('Invalid published ID');
    }
    if(selected.has(op.id))throw new Error('Duplicate published ID');
    selected.add(op.id);
  }
  const columns=[...selected].filter(id=>legacy.has(id)).map(id=>'"'+id+'"');
  columns.push('answers_extra','fonti_opinioni');
  return 'SELECT '+columns.join(',')+' FROM opinioni_risposte WHERE user_id=$1::uuid';
}

const SQL=Object.freeze({
  upsertOverflow:
    'INSERT INTO opinioni_risposte AS old (user_id,answers_extra) '+
    'VALUES($1::uuid,$2::jsonb) '+
    'ON CONFLICT(user_id) DO UPDATE SET '+
    "answers_extra=COALESCE(old.answers_extra,'{}'::jsonb)||EXCLUDED.answers_extra",
  readOverflowAndSources:
    'SELECT answers_extra,fonti_opinioni FROM opinioni_risposte WHERE user_id=$1::uuid'
});

/** Pre-write plan. Caller already holds user lock and verified consent. */
function planHybridAnswerChanges(storedRow,rawDelta,publishedIds,immutableLegacyIds) {
  if(storedRow!==null && storedRow!==undefined && !plain(storedRow)) {
    throw new TypeError('Stored opinion row must be an object or null');
  }
  const row=storedRow||{};
  const split=splitHybridDelta(rawDelta,publishedIds,immutableLegacyIds);
  const legacy=new Set(validateLegacyIds(immutableLegacyIds));
  const overflow=sanitizeStoredDocument(row.answers_extra);
  for(const id of Object.keys(overflow)){
    if(legacy.has(id))throw new Error('Duplicate hybrid legacy and overflow opinion ID');
  }
  const changed=Object.create(null),notifications=[],firstAnswers=[];
  for(const [id,next] of Object.entries({...split.legacyColumns,...split.extraPatch})){
    const old=legacy.has(id)
      ? (Object.prototype.hasOwnProperty.call(row,id)?row[id]:null)
      : (Object.prototype.hasOwnProperty.call(overflow,id)?overflow[id]:null);
    if(old!==null && !VALID.has(old)){
      throw new TypeError('Invalid existing opinion answer; no blind overwrite');
    }
    if(old===next)continue;
    changed[id]=next;
    if(old===null)firstAnswers.push(id);
    else notifications.push({opinionId:id,previousValue:old,newValue:next});
  }
  return {
    acceptedCount:Object.keys(split.legacyColumns).length+Object.keys(split.extraPatch).length,
    changedCount:Object.keys(changed).length,
    changed,firstAnswers,notifications
  };
}

/**
 * One INSERT/UPSERT saves old and future opinion answers atomically,
 * INCLUDING first-ever save. Column identifiers are validated immutable
 * IDs, all values and JSONB patches are parameterized. Unrelated sources
 * are untouched. Execute ONLY after users FOR UPDATE and consent recheck.
 */
function buildHybridAtomicAnswerUpsert(rawDelta,publishedIds,immutableLegacyIds,userId) {
  if(typeof userId!=='string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)){
    throw new TypeError('Canonical UUID required');
  }
  const {legacyColumns,extraPatch}=splitHybridDelta(
    rawDelta,publishedIds,immutableLegacyIds
  );
  const names=Object.keys(legacyColumns);
  const extraIds=Object.keys(extraPatch);
  const columns=['user_id'],values=['$1::uuid'],params=[userId];
  const updates=[];
  for(const name of names){
    // name comes from validateLegacyIds AND publishedIds, never arbitrary SQL.
    const column='"'+name+'"';
    columns.push(column);
    params.push(legacyColumns[name]);
    values.push('$'+params.length);
    updates.push(column+'=EXCLUDED.'+column);
  }
  if(extraIds.length){
    columns.push('answers_extra');
    params.push(JSON.stringify(extraPatch));
    values.push('$'+params.length+'::jsonb');
    updates.push(
      "answers_extra=COALESCE(current.answers_extra,'{}'::jsonb)||EXCLUDED.answers_extra"
    );
  }
  return {
    sql:'INSERT INTO opinioni_risposte AS current ('+columns.join(',')+') '+
      'VALUES ('+values.join(',')+') '+
      'ON CONFLICT(user_id) DO UPDATE SET '+updates.join(',')+
      ' RETURNING user_id',
    params,
    changedCount:names.length+extraIds.length
  };
}

/** Preserve old Android API's normalized text-key id distinct from stable ID. */
function formatHybridLegacyGradePayload(storedRow,published,immutableLegacyIds,grade) {
  if(typeof grade!=='string'||!grade.trim())throw new TypeError('Grade required');
  const projected=projectHybridAnswers(storedRow||{},published,immutableLegacyIds);
  return {
    success:true,
    data:projected.map(item=>({
      id:item.text.replace(/\s+/g,'_').toLowerCase(),
      text:item.text,
      grado:item.grado,
      userAnswer:item.userAnswer
    })),
    grado:grade,total:projected.length
  };
}

/** Profile endpoint keeps stable IDs plus original per-opinion source. */
function formatHybridProfileOpinions(storedRow,published,immutableLegacyIds){
  const row=storedRow||{};
  const sources=row.fonti_opinioni||{};
  if(!plain(sources))throw new TypeError('Malformed historical source map');
  return projectHybridAnswers(row,published,immutableLegacyIds).map(item=>({
    ...item,
    source:Object.prototype.hasOwnProperty.call(sources,item.id)
      ? sources[item.id]||'unknown' : 'unknown'
  }));
}

module.exports={splitHybridDelta,projectHybridAnswers,buildHybridAnswerSelect,
  planHybridAnswerChanges,buildHybridAtomicAnswerUpsert,
  formatHybridLegacyGradePayload,formatHybridProfileOpinions,SQL};
