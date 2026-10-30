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
function validateCounts(raw){
  if(!raw || typeof raw!=='object'||Array.isArray(raw)){
    throw new TypeError('Expected complete aggregate counts');
  }
  const out={};
  for(const name of COUNTS){
    const number=Number(raw[name]);
    if(raw[name]===null||raw[name]===undefined||
       !Number.isSafeInteger(number)||number<0){
      throw new TypeError('Invalid count: '+name);
    }
    out[name]=number;
  }
  return out;
}
const total=c=>COUNTS.reduce((n,k)=>n+c[k],0);

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
    for(const key of COUNTS)sum[key]+=c[key];
  }
  for(const key of COUNTS){
    if(sum[key]!==national[key]){
      throw new Error('Regional and national totals are inconsistent');
    }
  }
  const visible=new Set(REGIONS.filter(code=>total(byRegion.get(code))>=MINIMUM));
  const hidden=new Set(REGIONS.filter(code=>!visible.has(code)));
  let hiddenTotal=[...hidden].reduce((n,code)=>n+total(byRegion.get(code)),0);
  if(hiddenTotal>0 && hiddenTotal<MINIMUM){
    // Primary suppression alone allows the user to subtract each
    // published region from the national total to reconstruct a small
    // undisclosed remainder. Withhold the smallest otherwise-releasable
    // region too, thus making the combined hidden remainder >= MINIMUM.
    const eligible=[...visible].sort((a,b)=>
      total(byRegion.get(a))-total(byRegion.get(b)) || a.localeCompare(b)
    );
    while(hiddenTotal>0 && hiddenTotal<MINIMUM && eligible.length){
      const code=eligible.shift();
      visible.delete(code);
      hidden.add(code);
      hiddenTotal+=total(byRegion.get(code));
    }
  }
  // If national itself has fewer than 10, neither national nor any
  // region may be released.
  const publishNational=total(national)>=MINIMUM;
  if(!publishNational)visible.clear();
  return Object.freeze({
    publishNational,
    visibleRegions:Object.freeze([...visible].sort()),
    suppressedRegions:Object.freeze(REGIONS.filter(code=>!visible.has(code))),
    minimumCellSize:MINIMUM
  });
}

module.exports={planCoherentRegionalPublication};
