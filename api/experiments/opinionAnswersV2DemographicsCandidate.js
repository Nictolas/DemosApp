'use strict';

/**
 * RESEARCH ONLY: hybrid single-opinion detailed statistics. NOT imported by
 * any runtime route. The exact public schema metadata was checked read-only:
 * data_nascita (date) and sesso (varchar) are present; anno_nascita is not.
 *
 * Do not use an aggregate without account-type and political-consent checks.
 * This also conservatively suppresses an entire demographic breakdown when
 * a non-empty cell has fewer than ten answers, to avoid exposing its size by
 * subtracting one displayed cell from a parent total. Overlapping public
 * aggregates still require a complete inference/privacy review.
 */
const {validateLegacyIds}=require('./opinionAnswersV2BackfillCandidate');
const {MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE:MINIMUM}=
  require('../utils/politicalAggregatePrivacy');
const {validateCounts,total,safePublicCounts}=
  require('./opinionAnswersV2RegionalPrivacyCandidate');

const ID=/^[a-z][a-z0-9_]{0,62}$/;
const AGE_LABELS=Object.freeze([
  'Under 18','18-25','26-35','36-45','46-55','56-65','65+'
]);
const TYPE_CODES=Object.freeze(['PERSON','P']);
const DEMOGRAPHICS=new Set(['eta','sesso']);
function buildHybridDemographicQuery({
  opinionId,publishedIds,legacyIds,dimension,region
}={}){
  if(typeof opinionId!=='string'||!ID.test(opinionId)||
      !(publishedIds instanceof Set)||!publishedIds.has(opinionId)){
    throw new TypeError('Opinion must have an immutable published ID');
  }
  if(!DEMOGRAPHICS.has(dimension)){
    throw new TypeError('Supported demographic dimension required');
  }
  if(region!==undefined && (typeof region!=='string'||
      !region.trim()||region.length>128)){
    throw new TypeError('Valid compressed region code required');
  }
  const old=new Set(validateLegacyIds(legacyIds));
  const isLegacy=old.has(opinionId);
  const expression=isLegacy
    ? 'orr."'+opinionId+'"'
    : "orr.answers_extra->>$1::text";
  const params=isLegacy?[[...TYPE_CODES]]:[opinionId,[...TYPE_CODES]];
  const accountParam=isLegacy?1:2;
  const regionParam=isLegacy?2:3;
  if(region!==undefined)params.push(region);
  const ageExpr=[
    'CASE',
    " WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE,u.data_nascita)) < 18 THEN 'Under 18'",
    " WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE,u.data_nascita)) BETWEEN 18 AND 25 THEN '18-25'",
    " WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE,u.data_nascita)) BETWEEN 26 AND 35 THEN '26-35'",
    " WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE,u.data_nascita)) BETWEEN 36 AND 45 THEN '36-45'",
    " WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE,u.data_nascita)) BETWEEN 46 AND 55 THEN '46-55'",
    " WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE,u.data_nascita)) BETWEEN 56 AND 65 THEN '56-65'",
    " ELSE '65+' END"
  ].join('\n');
  const groupExpr=dimension==='eta'?ageExpr:'u.sesso';
  const label=dimension==='eta'?'fascia_eta':'sesso';
  const metaFilter=dimension==='eta'
    ? ['u.data_nascita IS NOT NULL','u.data_nascita <= CURRENT_DATE']
    : ["u.sesso IN ('M','F')"];
  const where=[
    'u.account_type = ANY($'+accountParam+'::text[])',
    'COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE',
    ...metaFilter,
    "v.answer IN ('f','c','i')"
  ];
  if(region!==undefined)where.push('u.regione_residenza = $'+regionParam);
  const sql=[
    'WITH valid_responses AS (',
    'SELECT '+groupExpr+' AS dimension_label,',
    'v.answer',
    'FROM opinioni_risposte orr',
    'JOIN users u ON u.id = orr.user_id',
    'LEFT JOIN user_consents uc ON uc.user_id = u.id',
    'CROSS JOIN LATERAL (SELECT '+expression+' AS answer) v',
    'WHERE '+where.join('\n AND '),
    ')',
    'SELECT dimension_label AS '+label+',',
    "COUNT(*) FILTER (WHERE answer='f')::integer AS favorevole,",
    "COUNT(*) FILTER (WHERE answer='c')::integer AS contrario,",
    "COUNT(*) FILTER (WHERE answer='i')::integer AS indeciso",
    'FROM valid_responses',
    'GROUP BY dimension_label',
    'ORDER BY '+(dimension==='eta'
      ? "array_position(ARRAY['Under 18','18-25','26-35','36-45','46-55','56-65','65+']::text[],dimension_label)"
      : 'dimension_label')
  ].join('\n');
  return {sql,params,dimension};
}

/** Strict typed row validation before thresholding, fail closed on malformed SQL. */
function validateRows(rows,dimension){
  if(!Array.isArray(rows)||!DEMOGRAPHICS.has(dimension)){
    throw new TypeError('Expected demographic SQL results');
  }
  const label=dimension==='eta'?'fascia_eta':'sesso';
  const seen=new Set();
  return rows.map(row=>{
    const key=row?.[label];
    if(typeof key!=='string' || seen.has(key) ||
       (dimension==='eta'?!AGE_LABELS.includes(key):!['M','F'].includes(key))){
      throw new Error('Invalid or duplicate demographic group');
    }
    seen.add(key);
    let counts;
    try{
      counts=validateCounts(row);
    }catch(_error){
      throw new TypeError('Invalid demographic count');
    }
    return {[label]:key,...counts};
  });
}

/**
 * For detailed groups, even displaying only the >=10 cells could disclose
 * a suppressed remainder by subtraction from an available region/national
 * parent total. We conservatively suppress ALL subgroup counts when any
 * nonempty subgroup is below ten. This is stricter than existing runtime.
 */
function publishHybridDemographicBreakdown(rows,dimension){
  const valid=validateRows(rows,dimension);
  const small=valid.some(row=>
    total(row)>0 && !safePublicCounts(row)
  );
  if(small)return {
    success:true,minimumCellSize:MINIMUM,suppressed:true,data:[]
  };
  return {
    success:true,minimumCellSize:MINIMUM,suppressed:false,
    data:valid.filter(safePublicCounts)
  };
}

module.exports={
  buildHybridDemographicQuery,publishHybridDemographicBreakdown,
  TYPE_CODES
};
