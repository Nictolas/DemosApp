'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  buildHybridSurveyAggregateQuery,publishHybridSurveyStats,
  projectHybridMatchingMaps
}=require('../experiments/opinionAnswersV2AggregateCandidate');

const legacy=['opinione_0','opinione_1'];
const published=new Set(['opinione_0','opinione_1','opinione_94','opinione_95']);
function query(ids,scope,scopeValues){
  return buildHybridSurveyAggregateQuery({
    opinionIds:ids,publishedIds:published,legacyIds:legacy,scope,scopeValues
  });
}

test('single grouped query includes legacy column and future JSONB key, no SQL catalog reads',()=>{
  const q=query(['opinione_0','opinione_94']);
  assert.deepEqual(q.params,[]);
  assert.match(q.sql,/orr\."opinione_0"/);
  assert.match(q.sql,/orr\.answers_extra->>'opinione_94'/);
  assert.match(q.sql,/JOIN users u ON u\.id = orr\.user_id/);
  assert.match(q.sql,/LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
  assert.match(q.sql,/COALESCE\(uc\.political_opinions_consent,/);
  assert.match(q.sql,/u\.account_type IN \('PERSON','P'\)/);
  assert.match(q.sql,/GROUP BY v\.opinion_id/);
  assert.doesNotMatch(q.sql,/information_schema|opinioni_domande|UNION ALL|SELECT \*/);
});

test('territory is exact and parameterized; injection-looking values are never interpolated',()=>{
  const hostile="Toscana'; DROP TABLE users; --";
  const region=query(['opinione_94'],'regione',[hostile]);
  assert.deepEqual(region.params,[hostile]);
  assert.match(region.sql,/u\.regione_residenza = \$1/);
  assert.doesNotMatch(region.sql,/DROP TABLE/);
  const province=query(['opinione_94'],'provincia',['Toscana','Livorno']);
  assert.deepEqual(province.params,['Toscana','Livorno']);
  assert.match(province.sql,/u\.provincia_residenza = \$2/);
  const town=query(['opinione_94'],'comune',['Toscana','Livorno','Livorno']);
  assert.match(town.sql,/u\.comune_residenza = \$3/);
  assert.equal(town.params.length,3);
  assert.throws(()=>query(['opinione_94'],'comune',['Toscana']),/geographical/);
  assert.throws(()=>query(['opinione_94'],'unknown',['Toscana']),/scope/);
  assert.throws(()=>query(['opinione_94'],undefined,['unexpected']),/scope/);
});

test('all identifiers must come from code-published immutable catalog',()=>{
  assert.throws(()=>query(['opinione_96']),/Unpublished/);
  assert.throws(()=>query(['opinione_0','opinione_0']),/Unique/);
  assert.throws(()=>query([]),/Unique/);
  assert.throws(()=>query(['opinione_94;DELETE FROM users']),/Unpublished/);
  const extended=new Set(Array.from({length:130},(_,i)=>'opinione_'+i));
  assert.throws(()=>buildHybridSurveyAggregateQuery({
    opinionIds:[...extended],publishedIds:extended,legacyIds:legacy
  }),/1\.\.128/);
});

test('privacy: each nonzero answer category must reach 10; 9 or 0 total hides',()=>{
  const rows=[
    {opinion_id:'opinione_0',favorevole:'10',contrario:'10',indeciso:'10'},
    {opinion_id:'opinione_94',favorevole:'10',contrario:'9',indeciso:'10'},
    {opinion_id:'opinione_95',favorevole:'0',contrario:'0',indeciso:'0'}
  ];
  const result=publishHybridSurveyStats(rows,published);
  assert.deepEqual({...result},{
    opinione_0:{favorevole:10,contrario:10,indeciso:10}
  });
  assert.equal(Object.hasOwn(result,'opinione_94'),false);
  assert.equal(Object.hasOwn(result,'opinione_95'),false);
});

test('never publish unknown, duplicate, fractional or negative count rows',()=>{
  assert.throws(()=>publishHybridSurveyStats([{
    opinion_id:'opinione_fake',favorevole:99,contrario:0,indeciso:0
  }],published),/Unexpected opinion/);
  assert.throws(()=>publishHybridSurveyStats([
    {opinion_id:'opinione_94',favorevole:9,contrario:0,indeciso:0},
    {opinion_id:'opinione_94',favorevole:10,contrario:0,indeciso:0}
  ],published),/Repeated/);
  assert.throws(()=>publishHybridSurveyStats([{
    opinion_id:'opinione_0',favorevole:-1,contrario:0,indeciso:0
  }],published),/Invalid SQL aggregate/);
  assert.throws(()=>publishHybridSurveyStats([{
    opinion_id:'opinione_0',favorevole:10.25,contrario:0,indeciso:0
  }],published),/Invalid SQL aggregate/);
});

test('matching maps combine legacy and new answers without extra personal SQL reads',()=>{
  const rows=[{user_id:'user1',opinione_0:'f',opinione_1:null,
    answers_extra:{opinione_94:'c',opinione_archived:'i'}}];
  const maps=projectHybridMatchingMaps(
    rows,['user1','user2'],['opinione_0','opinione_1','opinione_94'],
    published,legacy
  );
  assert.equal(maps.size,2);
  assert.deepEqual({...maps.get('user1')},{
    opinione_0:'f',opinione_1:null,opinione_94:'c'
  });
  assert.deepEqual({...maps.get('user2')},{});
  assert.equal(Object.hasOwn(maps.get('user1'),'opinione_archived'),false);
});

test('matching fails closed if database returns an unrequested subject or duplicate data',()=>{
  const toMaps=rows=>projectHybridMatchingMaps(
    rows,['a'],['opinione_0','opinione_94'],published,legacy
  );
  assert.throws(()=>toMaps([{user_id:'b'}]),/Unexpected or duplicate subject/);
  assert.throws(()=>toMaps([{user_id:'a'},{user_id:'a'}]),/Unexpected or duplicate subject/);
  assert.throws(()=>toMaps([{user_id:'a',opinione_0:'f',
    answers_extra:{opinione_0:'i'}}]),/Duplicate legacy/);
  assert.throws(()=>toMaps([{user_id:'a',opinione_0:'invalid'}]),/Invalid matching/);
  assert.throws(()=>projectHybridMatchingMaps(
    [],['a','a'],['opinione_0'],published,legacy
  ),/unique authorized/);
});


const {
  getOpinionCompletion,calculatePoliticalMatch
}=require('../utils/politicalMatching');

test('real political matching scorer includes new Opinion and ignores archived keys',()=>{
  const ids=['opinione_0','opinione_94'];
  const rows=[
    {user_id:'citizen',opinione_0:'f',
      answers_extra:{opinione_94:'c',opinione_archived:'i'}},
    {user_id:'representative',opinione_0:'f',
      answers_extra:{opinione_94:'c',opinione_archived:'f'}}
  ];
  const maps=projectHybridMatchingMaps(rows,['citizen','representative'],
    ids,published,legacy);
  const citizen=maps.get('citizen');
  const representative=maps.get('representative');
  assert.equal(getOpinionCompletion(ids,citizen).isComplete,true);
  assert.deepEqual(calculatePoliticalMatch(ids,citizen,representative),{
    rawScore:6,maxScore:6,compatibilityPercentage:100,
    knownPositions:2,totalOpinions:2,coveragePercentage:100,
    clearAgreements:2,uncertainAgreements:0,disagreements:0,
    mixedUncertainty:0,targetMissing:0,sharedOpinions:2
  });
  const missing=projectHybridMatchingMaps([
    {user_id:'citizen',opinione_0:'f',answers_extra:{}}
  ],['citizen'],ids,published,legacy).get('citizen');
  assert.deepEqual(getOpinionCompletion(ids,missing).missingOpinionIds,['opinione_94']);
  assert.equal(getOpinionCompletion(ids,missing).isComplete,false);
});


test('30-person mixed count with one contrary response must NOT disclose single voter',()=>{
  const raw=publishHybridSurveyStats([
    {opinion_id:'opinione_0',favorevole:'29',contrario:'1',indeciso:'0'},
    {opinion_id:'opinione_94',favorevole:'30',contrario:'0',indeciso:'0'}
  ],published);
  assert.equal(Object.hasOwn(raw,'opinione_0'),false);
  assert.deepEqual(raw.opinione_94,{
    favorevole:30,contrario:0,indeciso:0
  });
});

test('public aggregate rejects count coercion and overflowing category sums',()=>{
  for(const invalid of ['', ' ', false, [], '01', '1e3',
    '9007199254740992']){
    assert.throws(()=>publishHybridSurveyStats([{
      opinion_id:'opinione_0',favorevole:invalid,
      contrario:0,indeciso:0
    }],published),/Invalid SQL aggregate count/);
  }
  assert.throws(()=>publishHybridSurveyStats([{
    opinion_id:'opinione_0',
    favorevole:Number.MAX_SAFE_INTEGER,contrario:1,indeciso:0
  }],published),/Invalid SQL aggregate count/);
});
