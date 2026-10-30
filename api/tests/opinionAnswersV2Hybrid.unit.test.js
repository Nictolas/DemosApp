'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {splitHybridDelta,projectHybridAnswers,buildHybridAnswerSelect,SQL}=
  require('../experiments/opinionAnswersV2HybridCandidate');
const immutable=['opinione_0','opinione_1','opinione_2'];
const published=new Set([...immutable,'opinione_3','opinione_4']);
const metadata=[...published].map(id=>({id,text:'Synthetic '+id,gradi_opinione:['N']}));

test('old and future opinion deltas are split without adding per-question columns',()=>{
  const p=splitHybridDelta({opinione_0:'f',opinione_3:'c',opinione_4:'i'},published,immutable);
  assert.deepEqual({...p.legacyColumns},{opinione_0:'f'});
  assert.deepEqual({...p.extraPatch},{opinione_3:'c',opinione_4:'i'});
  assert.throws(()=>splitHybridDelta({opinione_5:'f'},published,immutable),/Unknown/);
});
test('single old row projects 95th opinion and retains archival answers',()=>{
  const row={opinione_0:'f',opinione_1:null,opinione_2:'i',
    answers_extra:{opinione_3:'c',opinione_4:'f',opinione_archived:'i'},
    fonti_opinioni:{opinione_3:'historical source'}};
  const data=projectHybridAnswers(row,metadata,immutable);
  assert.deepEqual(data.map(x=>x.userAnswer),['f',null,'i','c','f']);
  assert.equal(data.some(x=>x.id==='opinione_archived'),false);
  assert.equal(row.answers_extra.opinione_archived,'i');
});
test('duplicate old/overflow key or bad answer fails rather than silently losing data',()=>{
  const row={opinione_0:'f',opinione_1:null,opinione_2:'c'};
  assert.throws(()=>projectHybridAnswers({...row,answers_extra:{opinione_0:'i'}},metadata,immutable),
    /Duplicate hybrid/);
  assert.throws(()=>projectHybridAnswers({...row,opinione_1:'bogus'},metadata,immutable),
    /Invalid stored legacy/);
});
test('overflow SQL has parameterized JSONB patch and uses the existing legacy table',()=>{
  assert.match(SQL.upsertOverflow,/INSERT INTO opinioni_risposte/);
  assert.match(SQL.upsertOverflow,/COALESCE\(old\.answers_extra,'\{\}'::jsonb\)\|\|EXCLUDED.answers_extra/);
  assert.doesNotMatch(SQL.upsertOverflow,/CREATE|ALTER|DROP/);
  assert.match(SQL.readOverflowAndSources,/FROM opinioni_risposte WHERE user_id=\$1::uuid/);
});

test('one answer query includes old selected columns, future overflow and sources',()=>{
  const published=[{id:'opinione_0'},{id:'opinione_3'}];
  const sql=buildHybridAnswerSelect(published,immutable);
  assert.equal(sql,
    'SELECT "opinione_0",answers_extra,fonti_opinioni FROM opinioni_risposte WHERE user_id=$1::uuid');
  assert.equal((sql.match(/SELECT/g)||[]).length,1);
  assert.doesNotMatch(sql,/"opinione_3"|opinioni_domande|information_schema/i);
  assert.equal(buildHybridAnswerSelect([{id:'opinione_4'}],immutable),
    'SELECT answers_extra,fonti_opinioni FROM opinioni_risposte WHERE user_id=$1::uuid');
  assert.throws(()=>buildHybridAnswerSelect([{id:'bad-name;DROP TABLE users'}],immutable),/Invalid/);
  assert.throws(()=>buildHybridAnswerSelect([{id:'opinione_0'},{id:'opinione_0'}],immutable),/Duplicate/);
});
