'use strict';

/**
 * RESEARCH ONLY — a bounded, one-query candidate for opinion surveys and
 * compatibility matching with 94 legacy TEXT columns plus answers_extra JSONB.
 * It is not imported by any production route and never fetches the catalog
 * from SQL. Public IDs must be supplied from the code-held published catalog.
 *
 * Authorization/consent of any PERSONAL profile read remains the caller's
 * responsibility. For public aggregates, the existing consent/account-type
 * filter is applied before exposing counts and the existing >=10 threshold
 * is reused. Aggregation threshold alone does not eliminate differential
 * inference across overlapping populations.
 */
const {validateLegacyIds}=require('./opinionAnswersV2BackfillCandidate');
const {sanitizeStoredDocument}=require('./opinionAnswersV2Candidate');
const {validateCounts,safePublicCounts}=
  require('./opinionAnswersV2RegionalPrivacyCandidate');

const ID=/^[a-z][a-z0-9_]{0,62}$/;
const ANSWERS=new Set(['f','c','i']);
const MAX_GROUPED_IDS=128;
const SCOPE_COLS=Object.freeze({
  regione:['regione_residenza'],
  provincia:['regione_residenza','provincia_residenza'],
  comune:['regione_residenza','provincia_residenza','comune_residenza']
});
function safeSelection(opinionIds,publishedIds,legacyIds){
  if(!(publishedIds instanceof Set)||!Array.isArray(opinionIds)||
      opinionIds.length===0||opinionIds.length>MAX_GROUPED_IDS||
      new Set(opinionIds).size!==opinionIds.length){
    throw new TypeError('Unique code-published opinion IDs (1..128) required');
  }
  const historical=new Set(validateLegacyIds(legacyIds));
  for(const id of opinionIds){
    if(typeof id!=='string'||!ID.test(id)||!publishedIds.has(id)){
      throw new TypeError('Unpublished or invalid opinion ID');
    }
  }
  return historical;
}
function safeTerritory(scope,scopeValues){
  if(scope===undefined && scopeValues===undefined)return {sql:[],params:[]};
  if(!Object.prototype.hasOwnProperty.call(SCOPE_COLS,scope)){
    throw new TypeError('Unsupported territorial scope');
  }
  const cols=SCOPE_COLS[scope];
  if(!Array.isArray(scopeValues)||scopeValues.length!==cols.length||
      scopeValues.some(x=>typeof x!=='string'||x.trim().length===0||x.length>255)){
    throw new TypeError('Expected exact nonempty geographical parameters');
  }
  return {
    sql:cols.map((col,index)=>'u.'+col+' = $'+(index+1)),
    params:[...scopeValues]
  };
}

/**
 * One grouped SQL statement, no per-opinion SQL fallback, no per-ID schema
 * metadata query. Historical columns are quoted ONLY from the immutable
 * code manifest, and JSONB keys are safe, code-published identifiers.
 * Territory values remain SQL parameters. A code/DB schema mismatch
 * raises an error rather than silently ignoring a historical question.
 */
function buildHybridSurveyAggregateQuery({
  opinionIds,publishedIds,legacyIds,scope,scopeValues
}={}){
  const historical=safeSelection(opinionIds,publishedIds,legacyIds);
  const geo=safeTerritory(scope,scopeValues);
  const values=opinionIds.map(id=>{
    const expression=historical.has(id)
      ? 'orr."'+id+'"'
      : "orr.answers_extra->>'"+id+"'";
    return "('"+id+"', "+expression+")";
  });
  const parts=[
    'SELECT v.opinion_id,',
    "COUNT(*) FILTER (WHERE v.answer = 'f')::int AS favorevole,",
    "COUNT(*) FILTER (WHERE v.answer = 'c')::int AS contrario,",
    "COUNT(*) FILTER (WHERE v.answer = 'i')::int AS indeciso",
    'FROM opinioni_risposte orr',
    'JOIN users u ON u.id = orr.user_id',
    'LEFT JOIN user_consents uc ON uc.user_id = u.id',
    'CROSS JOIN LATERAL (VALUES',
    values.join(',\n'),
    ') AS v(opinion_id,answer)',
    "WHERE v.answer IN ('f','c','i')",
    "AND u.account_type IN ('PERSON','P')",
    'AND COALESCE(uc.political_opinions_consent,',
    '             u.political_opinions_consent, false) IS TRUE',
    ...geo.sql.map(x=>'AND '+x),
    'GROUP BY v.opinion_id'
  ];
  return {sql:parts.join('\n'),params:geo.params};
}

/** Exact existing survey output shape, suppress each under-10 answer cell. */
function publishHybridSurveyStats(rows,publishedIds){
  if(!Array.isArray(rows)||!(publishedIds instanceof Set)){
    throw new TypeError('SQL aggregate rows and published catalog required');
  }
  const result=Object.create(null);
  const seen=new Set();
  for(const row of rows){
    if(!row||!publishedIds.has(row.opinion_id)||!ID.test(row.opinion_id)){
      throw new Error('Unexpected opinion ID returned by aggregate');
    }
    if(seen.has(row.opinion_id)){
      throw new Error('Repeated opinion ID in SQL aggregate');
    }
    seen.add(row.opinion_id);
    let counts;
    try{
      counts=validateCounts(row);
    }catch(_error){
      // Never accidentally expose the malformed value in an HTTP error.
      throw new Error('Invalid SQL aggregate count');
    }
    // Restrict BOTH the total and every positive f/c/i category.
    // 29 favorable + 1 contrary must not expose that one answer.
    if(safePublicCounts(counts))result[row.opinion_id]=counts;
  }
  return result;
}

/**
 * Compatibility/matching can still use one SELECT * WHERE user_id=ANY(...).
 * Convert both storage types to the same stable-ID maps without additional
 * per-user SQL reads. Caller must authorize EACH subject before selecting.
 * No matching data is returned for an unrequested subject ID.
 */
function projectHybridMatchingMaps(rows,subjectIds,opinionIds,publishedIds,legacyIds){
  const historical=safeSelection(opinionIds,publishedIds,legacyIds);
  if(!Array.isArray(rows)||!Array.isArray(subjectIds)||
      subjectIds.length>256||new Set(subjectIds).size!==subjectIds.length||
      subjectIds.some(id=>typeof id!=='string'||id.length===0)){
    throw new TypeError('Expected unique authorized subjects and DB rows');
  }
  const allowed=new Set(subjectIds);
  const maps=new Map(subjectIds.map(id=>[id,Object.create(null)]));
  const observed=new Set();
  for(const row of rows){
    const id=String(row?.user_id||'');
    if(!allowed.has(id)||observed.has(id)){
      throw new Error('Unexpected or duplicate subject from matching SELECT');
    }
    observed.add(id);
    const extra=sanitizeStoredDocument(row.answers_extra);
    for(const key of Object.keys(extra)){
      if(historical.has(key))throw new Error('Duplicate legacy and overflow opinion ID');
    }
    const answers=Object.create(null);
    for(const opinionId of opinionIds){
      const answer=historical.has(opinionId)
        ? (Object.prototype.hasOwnProperty.call(row,opinionId)?row[opinionId]:null)
        : (Object.prototype.hasOwnProperty.call(extra,opinionId)?extra[opinionId]:null);
      if(answer!==null&&!ANSWERS.has(answer))throw new Error('Invalid matching answer');
      answers[opinionId]=answer;
    }
    maps.set(id,answers);
  }
  return maps;
}

module.exports={
  buildHybridSurveyAggregateQuery,publishHybridSurveyStats,
  projectHybridMatchingMaps
};
