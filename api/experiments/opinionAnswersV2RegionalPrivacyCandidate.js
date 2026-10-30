'use strict';

/**
 * RESEARCH ONLY: complementary suppression for overlapping public national
 * and regional opinion aggregates. This does NOT by itself secure separate
 * live endpoints or sequential releases; it requires a complete, coherent
 * snapshot of ALL regions (including zero-count regions) plus a national
 * total captured in that same snapshot, and a shared publication decision
 * across API routes and cache versions.
 */
const {REGIONI_DB_TO_FRONTEND}=require('../utils/regioniUtils');
const {MINIMUM_POLITICAL_AGGREGATE_CELL_SIZE:MINIMUM}=
  require('../utils/politicalAggregatePrivacy');
const COUNTS=['favorevole','contrario','indeciso'];
const REGIONS=Object.freeze(Object.keys(REGIONI_DB_TO_FRONTEND));
// PostgreSQL COUNT(bigint) arrives as a canonical base-10 string.
// Number(''), Number(false) and Number([]) are all zero: never silently
// accept those malformed values as political statistics.
const MAX=Number.MAX_SAFE_INTEGER;
function checkedAdd(a,b){
  if(!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(b)||b<0||
     a>MAX-b)throw new TypeError('Unsafe aggregate count sum');
  return a+b;
}
function parseCount(value,name){
  let n;
  if(typeof value==='number'){
    n=value;
  }else if(typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value)){
    const exact=BigInt(value);
    if(exact>BigInt(MAX))throw new TypeError('Invalid count: '+name);
    n=Number(exact);
  }else{
    throw new TypeError('Invalid count: '+name);
  }
  if(!Number.isSafeInteger(n)||n<0){
    throw new TypeError('Invalid count: '+name);
  }
  return n;
}
function validateCounts(raw){
  if(!raw || typeof raw!=='object'||Array.isArray(raw)){
    throw new TypeError('Expected complete aggregate counts');
  }
  const out={};
  for(const name of COUNTS){
    out[name]=parseCount(raw[name],name);
  }
  // Even a per-category safe integer can overflow when summed.
  total(out);
  return out;
}
const total=c=>COUNTS.reduce((n,k)=>checkedAdd(n,c[k]),0);

function planCoherentRegionalPublication(nationalRaw,regionRows){
  const national=validateCounts(nationalRaw);
  if(!Array.isArray(regionRows))throw new TypeError('Region rows required');
  const byRegion=new Map();
  for(const row of regionRows){
    const code=row?.regione;
    if(!REGIONS.includes(code)||byRegion.has(code)){
      throw new Error('Unknown or duplicated region in publication snapshot');
    }
    byRegion.set(code,validateCounts(row));
  }
  if(byRegion.size!==REGIONS.length){
    // A missing region or unmapped population invalidates the proof that
    // suppressed cells cannot be reconstructed from national aggregates.
    throw new Error('Incomplete regional publication snapshot');
  }
  const sum={favorevole:0,contrario:0,indeciso:0};
  for(const c of byRegion.values()){
    for(const key of COUNTS)sum[key]=checkedAdd(sum[key],c[key]);
  }
  for(const key of COUNTS){
    if(sum[key]!==national[key]){
      throw new Error('Regional and national totals are inconsistent');
    }
  }
  const visible=new Set(REGIONS.filter(code=>total(byRegion.get(code))>=MINIMUM));
  // Suppression by the TOTAL hidden population alone is insufficient.
  // National totals are published separately by f/c/i, so subtraction
  // of released regions can reveal a tiny hidden CATEGORY even if the
  // hidden total itself is much larger than the threshold.
  //
  // In this intentionally conservative research candidate, each
  // positive hidden remainder must meet MINIMUM for BOTH the overall
  // population and each response category. Otherwise withhold another
  // region which contributes to the unsafe remainder. If there is no
  // such visible region, withhold all regional results (the national
  // aggregate may still be published, but cannot be subtracted).
  const residual=()=>{
    const remainder={favorevole:national.favorevole,
      contrario:national.contrario,indeciso:national.indeciso};
    for(const code of visible){
      const counts=byRegion.get(code);
      for(const key of COUNTS)remainder[key]-=counts[key];
    }
    return remainder;
  };
  let suppressedForDifferencing=false;
  while(visible.size>0){
    const r=residual();
    const risks=[
      ...COUNTS.map(key=>({key,value:r[key]})),
      {key:'total',value:total(r)}
    ].filter(({value})=>value>0&&value<MINIMUM)
      .sort((a,b)=>a.value-b.value || a.key.localeCompare(b.key));
    if(!risks.length)break;
    suppressedForDifferencing=true;
    const mostAtRisk=risks[0];
    const options=[...visible].filter(code=>{
      const counts=byRegion.get(code);
      return mostAtRisk.key==='total'
        ? total(counts)>0
        : counts[mostAtRisk.key]>0;
    }).sort((a,b)=>total(byRegion.get(a))-total(byRegion.get(b))||
      a.localeCompare(b));
    if(!options.length){
      // No remaining visible region contributes to the tiny category:
      // suppression of a different region cannot repair that
      // category. Publishing ANY other region alongside the national
      // count would permit subtraction of this small remainder.
      visible.clear();
      break;
    }
    visible.delete(options[0]);
  }
  // If national itself has fewer than 10, neither national nor any
  // region may be released. The separate API routes must consume ONE
  // versioned decision, not calculate a different plan per request.
  const publishNational=total(national)>=MINIMUM;
  if(!publishNational)visible.clear();
  return Object.freeze({
    publishNational,
    visibleRegions:Object.freeze([...visible].sort()),
    suppressedRegions:Object.freeze(REGIONS.filter(code=>!visible.has(code))),
    minimumCellSize:MINIMUM,
    suppressedForDifferencing
  });
}

module.exports={planCoherentRegionalPublication,validateCounts,total};
