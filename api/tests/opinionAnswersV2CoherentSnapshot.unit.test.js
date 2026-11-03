'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  buildCoherentHybridRegionSnapshotQuery,planSnapshotPublication
}=require('../experiments/opinionAnswersV2CoherentSnapshotCandidate');
const legacy=['opinione_0','opinione_1'];
const published=new Set([...legacy,'opinione_94']);
const row=(is_national,regione,favorevole,contrario,indeciso=0)=>
  ({is_national,regione,favorevole,contrario,indeciso});

test('one SQL reads both nation and regions in the SAME snapshot',()=>{
  for(const id of ['opinione_0','opinione_94']){
    const result=buildCoherentHybridRegionSnapshotQuery(id,published,legacy);
    assert.equal((result.sql.match(/JOIN users u/g)||[]).length,1);
    assert.match(result.sql,/GROUP BY GROUPING SETS \(\(regione\), \(\)\)/);
    assert.match(result.sql,/GROUPING\(regione\)::integer AS is_national/);
    assert.match(result.sql,/account_type IN \('PERSON','P'\)/);
    assert.match(result.sql,/COALESCE\(uc\.political_opinions_consent,/);
    assert.doesNotMatch(result.sql,/information_schema|opinioni_domande/);
    if(id==='opinione_0'){
      assert.match(result.sql,/orr\."opinione_0"/);
      assert.deepEqual(result.params,[]);
    }else{
      assert.match(result.sql,/orr\.answers_extra->>\$1::text/);
      assert.deepEqual(result.params,['opinione_94']);
    }
  }
  assert.throws(()=>buildCoherentHybridRegionSnapshotQuery(
    "opinione_94';DELETE",published,legacy),/Code-published/);
  assert.throws(()=>buildCoherentHybridRegionSnapshotQuery(
    'opinione_999',published,legacy),/Code-published/);
  assert.throws(()=>buildCoherentHybridRegionSnapshotQuery(
    'opinione_94',published,['opinione_0','opinione_0']),/duplicate/i);
});

test('national minus Tuscany could expose one Laziale; coherent plan hides Tuscany',()=>{
  const result=planSnapshotPublication([
    row(1,null,'10','1','0'),
    row(0,'TO','10','0','0'),
    row(0,'LA','0','1','0')
  ]);
  assert.equal(result.publication.publishNational,false);
  assert.deepEqual(result.publication.visibleRegions,[]);
  assert.ok(result.publication.suppressedRegions.includes('TO'));
  assert.ok(result.publication.suppressedRegions.includes('LA'));
  assert.equal(result.regions.length,20);
});

test('two large regions and one tiny region leave at most one public region',()=>{
  const result=planSnapshotPublication([
    row(1,null,'20','1','0'),
    row(0,'TO','10','0','0'),
    row(0,'LO','10','0','0'),
    row(0,'LA','0','1','0')
  ]);
  assert.deepEqual(result.publication.visibleRegions,[]);
  assert.ok(result.publication.suppressedRegions.includes('LA'));
});

test('missing/unmapped/duplicate region, missing/duplicate nation and sum mismatch fail closed',()=>{
  const okay=[
    row(1,null,'10','1'),
    row(0,'TO','10','0'),
    row(0,'LA','0','1')
  ];
  assert.throws(()=>planSnapshotPublication(okay.slice(1)),/Missing national/);
  assert.throws(()=>planSnapshotPublication([...okay,okay[0]]),/Duplicate/);
  assert.throws(()=>planSnapshotPublication([...okay,okay[1]]),/duplicated/);
  assert.throws(()=>planSnapshotPublication([...okay,row(0,'XX',0,0)]),/Unknown/);
  assert.throws(()=>planSnapshotPublication([...okay,row(0,null,0,0)]),/Unknown/);
  assert.throws(()=>planSnapshotPublication([...okay,row(2,'TO',0,0)]),/marker/);
  assert.throws(()=>planSnapshotPublication([
    row(1,null,'10','2'),...okay.slice(1)
  ]),/inconsistent/);
});

test('empty eligible subject list yields national zero, never public',()=>{
  const result=planSnapshotPublication([row(1,null,'0','0','0')]);
  assert.equal(result.publication.publishNational,false);
  assert.deepEqual(result.publication.visibleRegions,[]);
  assert.equal(result.regions.length,20);
});
