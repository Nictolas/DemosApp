'use strict';

/**
 * RESEARCH ONLY — one SQL statement yields the nation AND every observed
 * region from the SAME PostgreSQL statement snapshot. No live route imports.
 * The caller must publish only through the complementary-suppression plan,
 * with one coherently cached version for national + regional endpoints.
 *
 * WARNING: single-snapshot regional suppression does NOT protect against
 * longitudinal differencing, province/town or demographic intersections.
 */
const {REGIONI_DB_TO_FRONTEND}=require('../utils/regioniUtils');
const {validateLegacyIds}=require('./opinionAnswersV2BackfillCandidate');
const {planCoherentRegionalPublication}=
  require('./opinionAnswersV2RegionalPrivacyCandidate');
const CODE_IDS=Object.freeze(Object.keys(REGIONI_DB_TO_FRONTEND));
const ID=/^[a-z][a-z0-9_]{0,62}$/;

function buildCoherentHybridRegionSnapshotQuery(opinionId,publishedIds,legacyIds){
  if(typeof opinionId!=='string'||!ID.test(opinionId)||
     !(publishedIds instanceof Set)||!publishedIds.has(opinionId)){
    throw new TypeError('Code-published opinion ID required');
  }
  const historical=new Set(validateLegacyIds(legacyIds));
  // Column identifiers derive only from validated immutable legacy IDs.
  const isLegacy=historical.has(opinionId);
  const expression=isLegacy
    ? 'orr."'+opinionId+'"'
    : "orr.answers_extra->>$1::text";
  const params=isLegacy?[]:[opinionId];
  const sql=[
    'WITH eligible AS (',
    '  SELECT u.regione_residenza AS regione, '+expression+' AS answer',
    '  FROM opinioni_risposte orr',
    '  JOIN users u ON u.id = orr.user_id',
    '  LEFT JOIN user_consents uc ON uc.user_id = u.id',
    "  WHERE u.account_type IN ('PERSON','P')",
    '    AND COALESCE(uc.political_opinions_consent,',
    '                 u.political_opinions_consent,false) IS TRUE',
    ')',
    'SELECT GROUPING(regione)::integer AS is_national, regione,',
    "  COUNT(*) FILTER(WHERE answer='f')::bigint AS favorevole,",
    "  COUNT(*) FILTER(WHERE answer='c')::bigint AS contrario,",
    "  COUNT(*) FILTER(WHERE answer='i')::bigint AS indeciso",
    'FROM eligible',
    "WHERE answer IN ('f','c','i')",
    'GROUP BY GROUPING SETS ((regione), ())'
  ].join('\n');
  return {sql,params};
}

/**
 * The query returns one nation row and one row for each non-empty region.
 * Pad genuinely zero regions in memory. Reject unknown (including NULL)
 * regions and malformed/duplicate nation rows, rather than silently drop
 * them and publish an inconsistent or accidentally disclosive result.
 */
function planSnapshotPublication(rows){
  if(!Array.isArray(rows))throw new TypeError('Snapshot rows required');
  let national=null;
  const codes=new Set();
  const regions=[];
  for(const row of rows){
    const marker=row?.is_national;
    if(marker!==0&&marker!==1&&marker!=='0'&&marker!=='1'){
      throw new TypeError('Invalid national/region grouping marker');
    }
    const counts={
      favorevole:row.favorevole,
      contrario:row.contrario,
      indeciso:row.indeciso
    };
    if(marker===1||marker==='1'){
      if(national!==null||row.regione!==null){
        throw new Error('Duplicate or malformed national snapshot row');
      }
      national=counts;
    }else{
      if(!CODE_IDS.includes(row.regione)||codes.has(row.regione)){
        throw new Error('Unknown or duplicated region in snapshot');
      }
      codes.add(row.regione);
      regions.push({regione:row.regione,...counts});
    }
  }
  if(national===null)throw new Error('Missing national snapshot row');
  for(const code of CODE_IDS){
    if(!codes.has(code)){
      regions.push({regione:code,favorevole:0,contrario:0,indeciso:0});
    }
  }
  const publication=planCoherentRegionalPublication(national,regions);
  return {
    publication,
    // Keep counts private to the authorized precomputation process.
    // Do not serialize them directly in any public API response.
    national,
    regions
  };
}

module.exports={buildCoherentHybridRegionSnapshotQuery,planSnapshotPublication};
