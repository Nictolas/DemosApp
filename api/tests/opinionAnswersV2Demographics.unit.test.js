'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  buildHybridDemographicQuery,publishHybridDemographicBreakdown,TYPE_CODES
}=require('../experiments/opinionAnswersV2DemographicsCandidate');

const ids=['opinione_0','opinione_1'];
const published=new Set([...ids,'opinione_94']);
const query=(opinionId,dimension,region)=>buildHybridDemographicQuery({
  opinionId,dimension,region,publishedIds:published,legacyIds:ids
});

test('new and old Opinions use same consent-aware age grouping and single query',()=>{
  const old=query('opinione_0','eta');
  const future=query('opinione_94','eta');
  assert.match(old.sql,/orr\."opinione_0"/);
  assert.match(future.sql,/orr\.answers_extra->>\$1::text/);
  for(const q of [old,future]){
    assert.match(q.sql,/u\.data_nascita IS NOT NULL/);
    assert.match(q.sql,/u\.data_nascita <= CURRENT_DATE/);
    assert.match(q.sql,q===old
      ? /u\.account_type = ANY\(\$1::text\[\]\)/
      : /u\.account_type = ANY\(\$2::text\[\]\)/);
    assert.match(q.sql,/COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
    assert.match(q.sql,/GROUP BY dimension_label/);
    assert.doesNotMatch(q.sql,/information_schema|opinioni_domande|FROM users u,/);
    assert.deepEqual(q.params,q===old
      ? [['PERSON','P']]
      : ['opinione_94',['PERSON','P']]);
  }
  assert.deepEqual([...TYPE_CODES],['PERSON','P']);
});

test('sex uses verified sesso field rather than old genere; geography is a parameter',()=>{
  const q=query('opinione_94','sesso','Toscana');
  assert.match(q.sql,/u\.sesso IN \('M','F'\)/);
  assert.doesNotMatch(q.sql,/u\.genere/);
  assert.match(q.sql,/u\.regione_residenza = \$3/);
  assert.deepEqual(q.params,['opinione_94',['PERSON','P'],'Toscana']);
  const injection=query('opinione_94','eta',"Toscana' OR TRUE --");
  assert.doesNotMatch(injection.sql,/OR TRUE/);
  assert.equal(injection.params[2],"Toscana' OR TRUE --");
  assert.throws(()=>query('opinione_94','comune'),/dimension/);
  assert.throws(()=>query('opinione_999','sesso'),/published/);
  assert.throws(()=>query('opinione_0','sesso',''),/region/);
});

test('publish only >=10 cells; a nonempty small group hides entire breakdown',()=>{
  assert.deepEqual(publishHybridDemographicBreakdown([
    {sesso:'M',favorevole:'10',contrario:'10',indeciso:'10'},
    {sesso:'F',favorevole:'9',contrario:'10',indeciso:'10'}
  ],'sesso'),{
    success:true,minimumCellSize:10,suppressed:true,data:[]
  });
  assert.deepEqual(publishHybridDemographicBreakdown([
    {sesso:'M',favorevole:'10',contrario:'10',indeciso:'10'},
    {sesso:'F',favorevole:'10',contrario:'10',indeciso:'10'}
  ],'sesso'),{
    success:true,minimumCellSize:10,suppressed:false,data:[
      {sesso:'M',favorevole:10,contrario:10,indeciso:10},
      {sesso:'F',favorevole:10,contrario:10,indeciso:10}
    ]
  });
});

test('empty/zero groups never become public; invalid counts and duplicate groups block response',()=>{
  const empty=publishHybridDemographicBreakdown([
    {fascia_eta:'18-25',favorevole:'0',contrario:'0',indeciso:'0'}
  ],'eta');
  assert.deepEqual(empty,{
    success:true,minimumCellSize:10,suppressed:false,data:[]
  });
  assert.throws(()=>publishHybridDemographicBreakdown([
    {sesso:'X',favorevole:12,contrario:0,indeciso:0}
  ],'sesso'),/Invalid or duplicate/);
  assert.throws(()=>publishHybridDemographicBreakdown([
    {sesso:'F',favorevole:9,contrario:0,indeciso:0},
    {sesso:'F',favorevole:9,contrario:0,indeciso:0}
  ],'sesso'),/Invalid or duplicate/);
  assert.throws(()=>publishHybridDemographicBreakdown([
    {fascia_eta:'18-25',favorevole:-2,contrario:0,indeciso:0}
  ],'eta'),/Invalid demographic count/);
  assert.throws(()=>publishHybridDemographicBreakdown([
    {sesso:'M',favorevole:10.1,contrario:0,indeciso:0}
  ],'sesso'),/Invalid demographic count/);
});

test('source-list input must be bounded, published and immutable',()=>{
  assert.throws(()=>buildHybridDemographicQuery({
    opinionId:"opinione_94'; DELETE FROM users",dimension:'eta',
    legacyIds:ids,publishedIds:published
  }),/published/);
  assert.throws(()=>buildHybridDemographicQuery({
    opinionId:'opinione_94',dimension:'eta',publishedIds:published,
    legacyIds:['opinione_0','opinione_0']
  }),/duplicate/i);
  assert.throws(()=>buildHybridDemographicQuery({
    opinionId:'opinione_94',dimension:'sesso',publishedIds:published,
    legacyIds:ids,region:'a'.repeat(129)
  }),/region/);
});


test('demographic group 29 favorable / 1 contrary hides entire breakdown',()=>{
  const result=publishHybridDemographicBreakdown([
    {sesso:'M',favorevole:'29',contrario:'1',indeciso:'0'},
    {sesso:'F',favorevole:'30',contrario:'0',indeciso:'0'}
  ],'sesso');
  assert.equal(result.suppressed,true);
  assert.deepEqual(result.data,[]);
});

test('demographics reject empty, boolean and overflowed SQL count values',()=>{
  for(const bad of ['',false,[], '00', Number.MAX_SAFE_INTEGER]){
    assert.throws(()=>publishHybridDemographicBreakdown([
      {sesso:'M',favorevole:bad,contrario:1,indeciso:0}
    ],'sesso'),/Invalid demographic count/);
  }
});
