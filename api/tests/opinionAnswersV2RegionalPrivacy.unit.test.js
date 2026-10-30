'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {REGIONI_DB_TO_FRONTEND}=require('../utils/regioniUtils');
const {planCoherentRegionalPublication}=
  require('../experiments/opinionAnswersV2RegionalPrivacyCandidate');

const regions=Object.keys(REGIONI_DB_TO_FRONTEND);
const blank=()=>({favorevole:0,contrario:0,indeciso:0});
function fixture(overrides={}){
  return regions.map(regione=>({regione,...blank(),...overrides[regione]}));
}
test('national 11 vs Tuscany 10 reveals a one-person Lazio answer without secondary suppression',()=>{
  const national={favorevole:10,contrario:1,indeciso:0};
  const rows=fixture({
    TO:{favorevole:10},
    LA:{contrario:1}
  });
  // Existing threshold permits Tuscany=10, hides Lazio=1, but anyone
  // comparing the two could infer Lazio's political choice exactly.
  const oldUnsafeRegional={favorevole:10,contrario:0,indeciso:0};
  assert.deepEqual({
    favorevole:national.favorevole-oldUnsafeRegional.favorevole,
    contrario:national.contrario-oldUnsafeRegional.contrario
  },{favorevole:0,contrario:1});
  const p=planCoherentRegionalPublication(national,rows);
  assert.equal(p.publishNational,true);
  assert.deepEqual(p.visibleRegions,[]);
  assert.ok(p.suppressedRegions.includes('LA'));
  assert.ok(p.suppressedRegions.includes('TO'));
});

test('if two full regions and one subthreshold region exist, hide a second region',()=>{
  const national={favorevole:20,contrario:1,indeciso:0};
  const result=planCoherentRegionalPublication(national,fixture({
    TO:{favorevole:10},LO:{favorevole:10},LA:{contrario:1}
  }));
  assert.equal(result.publishNational,true);
  assert.equal(result.visibleRegions.length,1);
  assert.equal(result.suppressedRegions.length,regions.length-1);
  assert.ok(result.suppressedRegions.includes('LA'));
});

test('every region with >=10 can be published when no hidden positive remainder exists',()=>{
  const p=planCoherentRegionalPublication(
    {favorevole:10,contrario:10,indeciso:0},
    fixture({TO:{favorevole:10},LO:{contrario:10}})
  );
  assert.deepEqual([...p.visibleRegions].sort(),['LO','TO']);
  assert.equal(p.publishNational,true);
});

test('snapshot must include all official regions and match all national category counts',()=>{
  const national={favorevole:10,contrario:1,indeciso:0};
  const rows=fixture({TO:{favorevole:10},LA:{contrario:1}});
  assert.throws(()=>planCoherentRegionalPublication(national,rows.slice(1)),/Incomplete/);
  assert.throws(()=>planCoherentRegionalPublication(national,[
    ...rows,{...rows[0]}
  ]),/duplicated/);
  assert.throws(()=>planCoherentRegionalPublication(national,[
    ...rows.slice(1),{regione:'unmapped',...blank()}
  ]),/Unknown/);
  assert.throws(()=>planCoherentRegionalPublication({
    ...national,contrario:2
  },rows),/inconsistent/);
  assert.throws(()=>planCoherentRegionalPublication({
    ...national,favorevole:-1
  },rows),/Invalid count/);
});

test('national count under ten is not published even if all region cells are tiny',()=>{
  const result=planCoherentRegionalPublication(
    {favorevole:9,contrario:0,indeciso:0},
    fixture({TO:{favorevole:9}})
  );
  assert.equal(result.publishNational,false);
  assert.deepEqual(result.visibleRegions,[]);
});

test('zero-count regions are still required for completeness but not published',()=>{
  const p=planCoherentRegionalPublication(
    {favorevole:11,contrario:0,indeciso:0},
    fixture({TO:{favorevole:11}})
  );
  assert.deepEqual(p.visibleRegions,['TO']);
  assert.equal(p.suppressedRegions.length,regions.length-1);
});
