'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {REGIONI_DB_TO_FRONTEND}=require('../utils/regioniUtils');
const {planCoherentRegionalPublication,validateCounts,total}=
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
  assert.equal(p.publishNational,false);
  assert.deepEqual(p.visibleRegions,[]);
  assert.ok(p.suppressedRegions.includes('LA'));
  assert.ok(p.suppressedRegions.includes('TO'));
});

test('if two full regions and one subthreshold region exist, hide a second region',()=>{
  const national={favorevole:20,contrario:1,indeciso:0};
  const result=planCoherentRegionalPublication(national,fixture({
    TO:{favorevole:10},LO:{favorevole:10},LA:{contrario:1}
  }));
  assert.equal(result.publishNational,false);
  // The single contrary answer would still be reconstructible by
  // subtracting a public all-favorable region from the national
  // response-category totals. Both regions must remain withheld.
  assert.deepEqual(result.visibleRegions,[]);
  assert.equal(result.suppressedRegions.length,regions.length);
  assert.ok(result.suppressedRegions.includes('LA'));
  assert.equal(result.suppressedForDifferencing,true);
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


test('hidden total can exceed 10 while a hidden answer category is 1',()=>{
  // Lazio 9 and Lombardy 7 are EACH below threshold, but together
  // hide 16 responses (15f, 1c). A total-only policy would publish
  // Tuscany and allow disclosure of the one contrary category.
  const p=planCoherentRegionalPublication(
    {favorevole:25,contrario:1,indeciso:0},
    fixture({
      TO:{favorevole:10},
      LA:{favorevole:9},
      LO:{favorevole:6,contrario:1}
    })
  );
  assert.equal(p.publishNational,false);
  assert.deepEqual(p.visibleRegions,[]);
  assert.equal(p.suppressedForDifferencing,true);
});

test('prefer withholding a region contributing to the vulnerable answer category',()=>{
  // Withhold the 10-contrary region to raise the suppressed contrary
  // count from 1 to 11, while preserving the 10-favorable region.
  const p=planCoherentRegionalPublication(
    {favorevole:10,contrario:11,indeciso:0},
    fixture({
      TO:{favorevole:10},
      LO:{contrario:10},
      LA:{contrario:1}
    })
  );
  assert.equal(p.publishNational,true);
  assert.deepEqual(p.visibleRegions,['TO']);
  assert.ok(p.suppressedRegions.includes('LO'));
  assert.ok(p.suppressedRegions.includes('LA'));
  assert.equal(p.suppressedForDifferencing,true);
});

test('no positive hidden remainder leaves stable 10-person regions visible',()=>{
  const p=planCoherentRegionalPublication(
    {favorevole:10,contrario:10,indeciso:0},
    fixture({TO:{favorevole:10},LO:{contrario:10}})
  );
  assert.deepEqual([...p.visibleRegions].sort(),['LO','TO']);
  assert.equal(p.suppressedForDifferencing,false);
});


test('political aggregate parser rejects Number coercion and noncanonical bigint strings',()=>{
  const invalid=[null,undefined,'',' ',' \t ','01','-0','1.0','1e3','+1',
    '0x10',false,true,[],[1],{},'9007199254740992',
    Number.MAX_SAFE_INTEGER+1,Infinity,NaN,-1,-0.5];
  for(const value of invalid){
    assert.throws(()=>validateCounts({
      favorevole:value,contrario:0,indeciso:0
    }),/Invalid count/,String(value));
  }
  assert.deepEqual(validateCounts({
    favorevole:'001'.slice(2),contrario:'0',indeciso:3
  }),{favorevole:1,contrario:0,indeciso:3});
  assert.equal(total(validateCounts({
    favorevole:'10',contrario:'20',indeciso:'3'
  })),33);
});

test('sum overflow is rejected before any public regional publication',()=>{
  const max=Number.MAX_SAFE_INTEGER;
  assert.throws(()=>validateCounts({
    favorevole:max,contrario:1,indeciso:0
  }),/Unsafe aggregate count sum/);
  const values=fixture({
    TO:{favorevole:max},LO:{favorevole:1}
  });
  assert.throws(()=>planCoherentRegionalPublication(
    {favorevole:max,contrario:0,indeciso:0},values
  ),/Unsafe aggregate count sum/);
  assert.throws(()=>planCoherentRegionalPublication(
    {favorevole:'1',contrario:'0',indeciso:'0'},
    fixture({TO:{favorevole:''},LA:{favorevole:1}})
  ),/Invalid count/);
});


test('category with one respondent is suppressed even in a nation of 30',()=>{
  const national={favorevole:29,contrario:1,indeciso:0};
  const p=planCoherentRegionalPublication(national,fixture({
    TO:{favorevole:20},LO:{favorevole:9,contrario:1}
  }));
  assert.equal(p.publishNational,false);
  assert.deepEqual(p.visibleRegions,[]);
  assert.equal(p.suppressedRegions.length,regions.length);
});

test('regions with small positive categories are hidden even with a safe national result',()=>{
  const p=planCoherentRegionalPublication({
    favorevole:30,contrario:10,indeciso:0
  },fixture({
    TO:{favorevole:19,contrario:1},
    LO:{favorevole:11,contrario:9}
  }));
  assert.equal(p.publishNational,true);
  assert.deepEqual(p.visibleRegions,[]);
});

test('10/10 mixed region can be visible with no hidden residual',()=>{
  const p=planCoherentRegionalPublication({
    favorevole:10,contrario:10,indeciso:0
  },fixture({TO:{favorevole:10,contrario:10}}));
  assert.equal(p.publishNational,true);
  assert.deepEqual(p.visibleRegions,['TO']);
});
