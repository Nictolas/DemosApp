'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateLegacyIds,assertLegacyColumnCoverage,assertLegacySchemaInventory,legacyRowToAnswers,rollbackCoverage,rollbackParity}=
  require('../experiments/opinionAnswersV2BackfillCandidate');

const ids=Array.from({length:94},(_,i)=>'opinione_'+i);
const empty=Object.fromEntries(ids.map(id=>[id,null]));

test('legacy mapping requires all 94 actual columns and rejects malformed payloads',()=>{
  assert.equal(validateLegacyIds(ids).length,94);
  assert.throws(()=>legacyRowToAnswers({opinione_0:'f'},ids),/Missing legacy column/);
  assert.throws(()=>legacyRowToAnswers({...empty,opinione_0:'x'},ids),/Unexpected legacy answer/);
  assert.throws(()=>validateLegacyIds(['opinione_0','opinione_0']),/duplicate/);
  assert.throws(()=>validateLegacyIds(['__proto__']),/invalid/i);
});

test('NULL is unanswered, not an opinion state; first and last slots survive',()=>{
  const input={...empty,opinione_0:'f',opinione_93:'i',fonti_opinioni:{demo:'fictional'}};
  const answers=legacyRowToAnswers(input,ids);
  assert.deepEqual({...answers},{opinione_0:'f',opinione_93:'i'});
  assert.equal(Object.prototype.hasOwnProperty.call(answers,'fonti_opinioni'),false);
});

test('rollback compares a full snapshot, not just published or changed IDs',()=>{
  const source={...empty,opinione_4:'f'};
  const aligned={opinione_4:'f'};
  assert.deepEqual(rollbackParity(aligned,source,ids),{
    canRollbackWithoutLoss:true,unrepresentable:[],divergentIds:[]
  });
  assert.deepEqual(rollbackParity({},source,ids),{
    canRollbackWithoutLoss:false,unrepresentable:[],divergentIds:['opinione_4']
  });
  assert.deepEqual(rollbackParity({opinione_4:'i'},source,ids),{
    canRollbackWithoutLoss:false,unrepresentable:[],divergentIds:['opinione_4']
  });
});

test('new opinion IDs prevent a naive legacy rollback even when old values match',()=>{
  const source={...empty,opinione_0:'f'};
  assert.deepEqual(rollbackCoverage({opinione_0:'f',opinione_94:'c'},ids),{
    canRollbackWithoutLoss:false,unrepresentable:['opinione_94']
  });
  assert.deepEqual(rollbackParity({opinione_0:'f',opinione_94:'c'},source,ids),{
    canRollbackWithoutLoss:false,unrepresentable:['opinione_94'],divergentIds:[]
  });
});

test('archived IDs cannot be silently omitted from migration manifests',()=>{
  const manifest=ids.slice();
  manifest.splice(17,1);
  const row={...empty,opinione_17:'c'};
  // Metadata inventory blocks a narrower manifest even when a published
  // catalog no longer shows that historical opinion.
  assert.throws(
    ()=>assertLegacyColumnCoverage(manifest,['user_id','fonti_opinioni',...ids]),
    /historical ID manifest/
  );
  assert.deepEqual(assertLegacyColumnCoverage(ids,['user_id','fonti_opinioni',...ids]),{
    coveredIds:94,serviceColumns:['user_id','fonti_opinioni']
  });
  assert.equal(Object.hasOwn(legacyRowToAnswers(row,ids),'opinione_17'),true);
});

test('schema inventory rejects incomplete, untracked or duplicate columns',()=>{
  assert.throws(()=>assertLegacyColumnCoverage(ids,[]),/schema inventory/);
  assert.throws(()=>assertLegacyColumnCoverage(ids,['user_id',...ids,'opinione_extra']),/historical ID manifest/);
  assert.throws(()=>assertLegacyColumnCoverage(ids,[...ids]),/Missing legacy user_id/);
  assert.throws(()=>assertLegacyColumnCoverage(ids,['user_id',...ids,'opinione_0']),/duplicate/);
});

test('metadata inventory rejects wrong column types, including historical ones',()=>{
  const columns=[{column_name:'user_id',data_type:'uuid'},
    {column_name:'fonti_opinioni',data_type:'jsonb'},
    ...ids.map(id=>({column_name:id,data_type:'text'}))];
  assert.equal(assertLegacySchemaInventory(ids,columns).coveredIds,94);
  const bad=columns.map(c=>c.column_name==='opinione_17'
    ? {...c,data_type:'boolean'} : c);
  assert.throws(()=>assertLegacySchemaInventory(ids,bad),/Non-TEXT/);
  assert.throws(()=>assertLegacySchemaInventory(ids,columns.map(c=>({column_name:c.column_name}))),/data_type/);
});

test('optional operational columns are not mistaken for archived opinions',()=>{
  const columns=[
    {column_name:'user_id',data_type:'uuid'},
    {column_name:'fonti_opinioni',data_type:'jsonb'},
    {column_name:'id',data_type:'bigint'},
    {column_name:'created_at',data_type:'timestamp with time zone'},
    {column_name:'updated_at',data_type:'timestamp with time zone'},
    ...ids.map(id=>({column_name:id,data_type:'text'}))
  ];
  const coverage=assertLegacySchemaInventory(ids,columns);
  assert.equal(coverage.coveredIds,94);
  assert.equal(coverage.serviceColumns.length,5);
  const unexpected=columns.concat({column_name:'historical_opinion_new',data_type:'text'});
  assert.throws(()=>assertLegacySchemaInventory(ids,unexpected),/historical ID manifest/);
  const wrong=columns.map(c=>c.column_name==='fonti_opinioni'
    ? {...c,data_type:'text'} : c);
  assert.throws(()=>assertLegacySchemaInventory(ids,wrong),/service column type/);
  const wrongKey=columns.map(c=>c.column_name==='user_id'
    ? {...c,data_type:'text'} : c);
  assert.throws(()=>assertLegacySchemaInventory(ids,wrongKey),/service column type/);
});

test('one-time hybrid overflow column is permitted as JSONB metadata, not an opinion',()=>{
  const legacy=[
    {column_name:'user_id',data_type:'uuid'},
    {column_name:'fonti_opinioni',data_type:'jsonb'},
    ...ids.map(id=>({column_name:id,data_type:'text'}))
  ];
  const hybrid=[...legacy,{column_name:'answers_extra',data_type:'jsonb'}];
  assert.equal(assertLegacySchemaInventory(ids,hybrid).coveredIds,94);
  assert.equal(assertLegacySchemaInventory(ids,hybrid).serviceColumns.length,3);
  assert.throws(()=>assertLegacySchemaInventory(ids,hybrid.map(row=>
    row.column_name==='answers_extra'?{...row,data_type:'text'}:row
  )),/service column type/);
});
