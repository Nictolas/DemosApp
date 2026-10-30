'use strict';

/**
 * RESEARCH ONLY — build once from a single coherent SQL snapshot, then
 * serve nation/regions from ONE VERSIONED, PRECOMPUTED, PUBLIC payload.
 * This module never queries Supabase or stores personal answer rows.
 *
 * An immutable version prevents mixing answers from different snapshots
 * inside one publication batch. It does NOT prevent attackers comparing
 * different versions published over time: an external release policy,
 * stable cache behavior and privacy review are mandatory.
 */
const {REGIONI_DB_TO_FRONTEND}=require('../utils/regioniUtils');
const {planSnapshotPublication}=
  require('./opinionAnswersV2CoherentSnapshotCandidate');
const ID=/^[a-z][a-z0-9_]{0,62}$/;
const REGION_CODES=Object.keys(REGIONI_DB_TO_FRONTEND);
const VALID_VERSION=/^[a-zA-Z0-9_-]{1,64}$/;
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);

function checkedInput(opinionId,questionText,version){
  if(typeof opinionId!=='string'||!ID.test(opinionId)||
      typeof questionText!=='string'||!questionText.trim()||
      questionText.length>2048||
      typeof version!=='string'||!VALID_VERSION.test(version)){
    throw new TypeError('Immutable publication ID, title and version required');
  }
}

function onlyPublishedCounts(raw){
  const counts={};
  for(const key of ['favorevole','contrario','indeciso']){
    const n=Number(raw[key]);
    if(!Number.isSafeInteger(n)||n<0)throw new TypeError('Invalid public count');
    counts[key]=n;
  }
  return Object.freeze(counts);
}
function buildVersionedOpinionPublication({
  opinionId,questionText,version,snapshotRows
}={}){
  checkedInput(opinionId,questionText,version);
  // Do not expose planSnapshotPublication's raw national or raw regions:
  // the export contains ONLY policy-approved counts.
  const {publication,national,regions}=planSnapshotPublication(snapshotRows);
  const min=publication.minimumCellSize;
  const base=Object.freeze({suppressed:true,minimumCellSize:min,questionText});
  const nationalPayload=publication.publishNational
    ? Object.freeze({
        suppressed:false,minimumCellSize:min,questionText,
        stats:onlyPublishedCounts(national),
        totaleUtenti:['favorevole','contrario','indeciso']
          .reduce((n,k)=>n+Number(national[k]),0)
      })
    : base;
  const byCode=Object.create(null);
  const allowed=new Set(publication.visibleRegions);
  const regionMap=new Map(regions.map(({regione,...count})=>[regione,count]));
  for(const code of REGION_CODES){
    const publicRegion=Object.freeze({
      ...base,regione:REGIONI_DB_TO_FRONTEND[code]
    });
    if(!allowed.has(code)){
      byCode[code]=publicRegion;
      continue;
    }
    const stats=onlyPublishedCounts(regionMap.get(code));
    byCode[code]=Object.freeze({
      ...publicRegion,suppressed:false,stats,
      totaleUtenti:stats.favorevole+stats.contrario+stats.indeciso
    });
  }
  return Object.freeze({
    version,opinionId,national:nationalPayload,
    regionsByCode:Object.freeze(byCode),
    // Deliberately NO unfiltered counts, regionRows or raw snapshot.
  });
}
function readVersionedOpinionPublication(envelope,{
  version,opinionId,regionCode
}={}){
  if(!envelope||typeof envelope!=='object'||
    typeof version!=='string'||version!==envelope.version||
    typeof opinionId!=='string'||opinionId!==envelope.opinionId){
    // Must not fallback to a newer independently calculated result.
    throw new Error('OPINION_PUBLICATION_VERSION_MISMATCH');
  }
  if(regionCode===undefined){
    return {success:true,data:envelope.national};
  }
  if(typeof regionCode!=='string'||!REGION_CODES.includes(regionCode)||
    !own(envelope.regionsByCode,regionCode)){
    throw new TypeError('Unknown publication region');
  }
  return {success:true,data:envelope.regionsByCode[regionCode]};
}
module.exports={
  buildVersionedOpinionPublication,readVersionedOpinionPublication
};
