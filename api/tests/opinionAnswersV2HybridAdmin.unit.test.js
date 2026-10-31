'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildHybridAtomicAdminUpsert}=
  require('../experiments/opinionAnswersV2HybridAdminCandidate');
const historical=['opinione_0','opinione_1'];
const published=new Set([...historical,'opinione_94','opinione_95']);
const userId='00000000-0000-4000-8000-000000000091';
const make=(answerPatch,sourcePatch)=>buildHybridAtomicAdminUpsert({
  userId,answerPatch,sourcePatch,publishedIds:published,historicalIds:historical
});

test('one atomic first-time insert supports old and new answers and matching sources',()=>{
  const q=make({opinione_0:'f',opinione_94:'c'},{
    opinione_0:'legacy evidence',opinione_94:'future evidence'
  });
  assert.equal(q.answerCount,2);
  assert.equal(q.sourceCount,2);
  assert.match(q.sql,/INSERT INTO opinioni_risposte AS current/);
  assert.match(q.sql,/"opinione_0"/);
  assert.match(q.sql,/answers_extra/);
  assert.match(q.sql,/fonti_opinioni/);
  assert.match(q.sql,/ON CONFLICT\(user_id\) DO UPDATE SET/);
  assert.match(q.sql,/COALESCE\(current.answers_extra,'\{\}'::jsonb\) \|\| EXCLUDED.answers_extra/);
  assert.match(q.sql,/\(COALESCE\(current.fonti_opinioni,'\{\}'::jsonb\) - \$\d+::text\[\]\) \|\| EXCLUDED.fonti_opinioni/);
  assert.deepEqual(q.params.slice(0,2),[userId,'f']);
  assert.equal(q.params.some(x=>typeof x==='string'&&x.includes('"opinione_94":"c"')),true);
  assert.equal(q.params.some(x=>typeof x==='string'&&x.includes('"opinione_94":"future evidence"')),true);
  assert.equal(q.params.some(Array.isArray),true);
  assert.doesNotMatch(q.sql,/information_schema|opinioni_domande|SELECT .*fonti_opinioni/);
});

test('removal-only source request does NOT insert empty opinion rows',()=>{
  const q=make({},{
    opinione_0:null,opinione_94:' \t '
  });
  assert.equal(q.answerCount,0);
  assert.equal(q.sourceCount,2);
  assert.match(q.sql,/^UPDATE opinioni_risposte AS current SET/);
  assert.doesNotMatch(q.sql,/INSERT INTO |ON CONFLICT/);
  assert.deepEqual(q.params,[userId,['opinione_0','opinione_94']]);
  assert.equal(make({},{}),null);
  assert.equal(make(undefined,undefined),null);
});

test('source-only additions can create row; unrelated/archived source IDs are untouched',()=>{
  const q=make(undefined,{opinione_95:'source for future'});
  assert.equal(q.answerCount,0);
  assert.equal(q.sourceCount,1);
  assert.match(q.sql,/^INSERT/);
  assert.match(q.sql,/fonti_opinioni/);
  assert.doesNotMatch(q.sql,/answers_extra=|\"opinione_0\"=/);
  assert.deepEqual(q.params[0],userId);
  assert.equal(q.params.some(x=>typeof x==='string'&&x.includes('source for future')),true);
});

test('mixed answer plus source removal preserves first-ever insert and old answers',()=>{
  const q=make({opinione_94:'i'},{
    opinione_0:null
  });
  assert.equal(q.answerCount,1);
  assert.equal(q.sourceCount,1);
  assert.match(q.sql,/INSERT INTO/);
  assert.match(q.sql,/answers_extra=COALESCE/);
  assert.match(q.sql,/fonti_opinioni=\(COALESCE/);
  assert.deepEqual(q.params.at(-1),['opinione_0']);
});

test('strictly reject untrusted column IDs, unpublished sources and unsafe shapes',()=>{
  const bad=[
    ()=>make({opinione_95:'f',opinione_0:'invalid'},undefined),
    ()=>make(undefined,{'opinione_96':'injected'}),
    ()=>make(undefined,{'opinion;DROP TABLE users':null}),
    ()=>make(undefined,{opinione_0:{nested:'source'}}),
    ()=>make(undefined,{opinione_0:42}),
    ()=>make(undefined,{opinione_0:'a'.repeat(8193)}),
    ()=>make(['f'],undefined),
    ()=>make(undefined,['bad']),
    ()=>make(undefined,{__proto__:null,opinione_0:'fine'})
  ];
  for(const f of bad.slice(0,8))assert.throws(f);
  assert.throws(()=>buildHybridAtomicAdminUpsert({
    userId:'invalid',sourcePatch:{opinione_0:'hi'},
    publishedIds:published,historicalIds:historical
  }),/UUID/);
  assert.throws(()=>buildHybridAtomicAdminUpsert({
    userId,sourcePatch:{opinione_0:'hi'},
    publishedIds:published,historicalIds:['opinione_0','opinione_0']
  }),/duplicate/);
});

test('whitespace-only removal and genuine evidence distinguish null from valid text',()=>{
  const q=make(undefined,{
    opinione_0:'  real text  ',opinione_1:'',opinione_94:null
  });
  assert.equal(q.sourceCount,3);
  const additions=q.params.filter(x=>typeof x==='string'&&x.startsWith('{'));
  assert.equal(additions.length,1);
  assert.deepEqual(JSON.parse(additions[0]),{opinione_0:'  real text  '});
  assert.deepEqual(q.params.find(Array.isArray),['opinione_1','opinione_94']);
});
