'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const manifest=require('../experiments/opinionAnswersV2HistoricalManifest.json');
const {assertLegacySchemaInventory,validateLegacyIds}=
  require('../experiments/opinionAnswersV2BackfillCandidate');
const {splitHybridDelta}=require('../experiments/opinionAnswersV2HybridCandidate');

// This checkout must be the immutable PR #384 commit in the workflow.
// Tests read source JSON only; no network calls, SQL or personal answers.
const catalogRoot=path.resolve(__dirname,'../../_ci_op384/api/catalog');
function pinnedCatalog(){
  const chunks=Array.from({length:6},(_,i)=>
    path.join(catalogRoot,'opinions-part-0'+i+'.json')
  );
  const opinions=[];
  for(const file of chunks){
    if(!fs.existsSync(file)){
      throw Error('PINNED_PR384_CATALOG_MISSING: '+path.basename(file));
    }
    const json=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!Array.isArray(json))throw Error('PR384 catalog part must be an array');
    for(const opinion of json){
      if(!opinion||typeof opinion.id!=='string'||
          typeof opinion.text!=='string'||!Array.isArray(opinion.gradi_opinione)){
        throw Error('Malformed PR384 published opinion');
      }
    }
    opinions.push(...json);
  }
  return opinions;
}

test('PR384 pinned published catalog exactly matches frozen historical SQL ID manifest',()=>{
  assert.equal(manifest.immutable,true);
  assert.equal(manifest.table,'public.opinioni_risposte');
  assert.equal(manifest.sourceCatalogCommit,
    '3396b2d5ce9e190a9e34d68473050750d8099c5c');
  const published=pinnedCatalog().map(x=>x.id);
  assert.equal(published.length,94);
  assert.equal(manifest.historicalIds.length,94);
  assert.deepEqual([...published].sort(),manifest.historicalIds);
  assert.equal(new Set(published).size,94);
  assert.deepEqual(validateLegacyIds(manifest.historicalIds),manifest.historicalIds);
});

test('frozen historical ID list can preflight all 94 TEXT fields and two service columns',()=>{
  const inventory=[
    {column_name:'user_id',data_type:'uuid'},
    {column_name:'fonti_opinioni',data_type:'jsonb'},
    ...manifest.historicalIds.map(id=>({column_name:id,data_type:'text'}))
  ];
  // This validates a SYNTHETIC inventory. The live metadata was separately
  // checked read-only on 2026-10-30. Real cutover must rerun live preflight.
  const coverage=assertLegacySchemaInventory(manifest.historicalIds,inventory);
  assert.equal(coverage.coveredIds,94);
  assert.deepEqual(coverage.serviceColumns,['user_id','fonti_opinioni']);
  assert.equal(assertLegacySchemaInventory(manifest.historicalIds,[
    ...inventory,{column_name:'answers_extra',data_type:'jsonb'}
  ]).serviceColumns.length,3);
});

test('preflight blocks missing, renamed and non-TEXT historical columns',()=>{
  const inventory=[
    {column_name:'user_id',data_type:'uuid'},
    {column_name:'fonti_opinioni',data_type:'jsonb'},
    ...manifest.historicalIds.map(id=>({column_name:id,data_type:'text'}))
  ];
  const rename=inventory.map(row=>row.column_name===manifest.historicalIds[0]
    ? {...row,column_name:'renamed_without_migration'}:row);
  assert.throws(()=>assertLegacySchemaInventory(manifest.historicalIds,rename),
    /historical ID manifest/);
  const missing=inventory.filter(row=>row.column_name!==manifest.historicalIds[1]);
  assert.throws(()=>assertLegacySchemaInventory(manifest.historicalIds,missing),
    /historical ID manifest/);
  const wrong=inventory.map(row=>row.column_name===manifest.historicalIds[2]
    ? {...row,data_type:'boolean'}:row);
  assert.throws(()=>assertLegacySchemaInventory(manifest.historicalIds,wrong),
    /Non-TEXT/);
});

test('future published opinion takes the JSONB overflow path; no historical DDL',()=>{
  const futureId='opinione_futura_sintetica_95';
  assert.equal(manifest.historicalIds.includes(futureId),false);
  const published=new Set([...manifest.historicalIds,futureId]);
  const oldId=manifest.historicalIds[0];
  const result=splitHybridDelta({
    [oldId]:'f',
    [futureId]:'c'
  },published,manifest.historicalIds);
  assert.deepEqual({...result.legacyColumns},{[oldId]:'f'});
  assert.deepEqual({...result.extraPatch},{[futureId]:'c'});
  assert.equal(manifest.historicalIds.length,94);
  assert.throws(()=>splitHybridDelta({
    unknown_unpublished_opinion:'i'
  },published,manifest.historicalIds),/Unknown|invalid|Unpublished/);
});

test('archiving a published opinion must not remove its historical SQL identity',()=>{
  const published=pinnedCatalog();
  const original=manifest.historicalIds[17];
  const archived=published.filter(o=>o.id!==original);
  assert.equal(archived.length,93);
  assert.equal(manifest.historicalIds.includes(original),true);
  const realLivePreflightMustStillIncludeIt=manifest.historicalIds.slice();
  const metadata=[
    {column_name:'user_id',data_type:'uuid'},
    {column_name:'fonti_opinioni',data_type:'jsonb'},
    ...realLivePreflightMustStillIncludeIt.map(id=>({
      column_name:id,data_type:'text'
    }))
  ];
  assert.equal(assertLegacySchemaInventory(manifest.historicalIds,metadata).coveredIds,94);
});
