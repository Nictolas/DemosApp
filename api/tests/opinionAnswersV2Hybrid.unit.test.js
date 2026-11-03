'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {splitHybridDelta,projectHybridAnswers,buildHybridAnswerSelect,
  planHybridAnswerChanges,buildHybridAtomicAnswerUpsert,
  formatHybridLegacyGradePayload,formatHybridProfileOpinions,SQL}=
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


const uuid='00000000-0000-4000-8000-000000000023';

test('atomic first mixed save includes legacy values and future map in one statement',()=>{
  const save=buildHybridAtomicAnswerUpsert(
    {opinione_0:'f',opinione_3:'c',opinione_4:'i'},published,immutable,uuid
  );
  assert.equal(save.sql,
    'INSERT INTO opinioni_risposte AS current (user_id,"opinione_0",answers_extra) '+
    'VALUES ($1::uuid,$2,$3::jsonb) '+
    'ON CONFLICT(user_id) DO UPDATE SET "opinione_0"=EXCLUDED."opinione_0",'+
    "answers_extra=COALESCE(current.answers_extra,'{}'::jsonb)||EXCLUDED.answers_extra"+
    ' RETURNING user_id');
  assert.deepEqual(save.params,[uuid,'f','{"opinione_3":"c","opinione_4":"i"}']);
  assert.equal(save.changedCount,3);
  assert.match(save.sql,/ON CONFLICT\(user_id\)/);
  assert.doesNotMatch(save.sql,/information_schema|opinioni_domande|DELETE|ALTER/i);
});

test('overflow-only first save inserts and legacy-only update preserves overflow',()=>{
  const future=buildHybridAtomicAnswerUpsert({opinione_3:'f'},published,immutable,uuid);
  assert.deepEqual(future.params,[uuid,'{"opinione_3":"f"}']);
  assert.doesNotMatch(future.sql,/"opinione_0"/);
  const past=buildHybridAtomicAnswerUpsert({opinione_1:'c'},published,immutable,uuid);
  assert.deepEqual(past.params,[uuid,'c']);
  assert.doesNotMatch(past.sql,/answers_extra/);
  assert.throws(()=>buildHybridAtomicAnswerUpsert(
    {opinione_3:'f'},published,immutable,'unsafe-user'),/UUID/);
});

test('skip no-op saves; notify only for actual changed existing opinions',()=>{
  const row={
    opinione_0:'f',opinione_1:null,answers_extra:{opinione_3:'i',opinione_old:'c'}
  };
  const plan=planHybridAnswerChanges(row,{
    opinione_0:'f',opinione_1:'c',opinione_3:'f',opinione_4:'i'
  },published,immutable);
  assert.deepEqual({...plan.changed},{opinione_1:'c',opinione_3:'f',opinione_4:'i'});
  assert.deepEqual(plan.firstAnswers,['opinione_1','opinione_4']);
  assert.deepEqual(plan.notifications,[{
    opinionId:'opinione_3',previousValue:'i',newValue:'f'
  }]);
  assert.equal(plan.acceptedCount,4);
  assert.equal(plan.changedCount,3);
  const unchanged=planHybridAnswerChanges(row,{opinione_0:'f',opinione_3:'i'},published,immutable);
  assert.equal(unchanged.changedCount,0);
  assert.deepEqual(unchanged.notifications,[]);
  assert.throws(()=>planHybridAnswerChanges(
    {...row,answers_extra:{opinione_0:'f'}},{opinione_3:'i'},published,immutable
  ),/Duplicate hybrid/);
});

test('strict compatibility adapter preserves old text-key IDs and Profile stable IDs',()=>{
  const publishedList=[
    {id:'opinione_0',text:'Opinione A',gradi_opinione:['N']},
    {id:'opinione_3',text:'Un nuovo tema',gradi_opinione:['N']}
  ];
  const row={opinione_0:'c',answers_extra:{opinione_3:'f'},
    fonti_opinioni:{opinione_0:'Fonte storica'}};
  const old=formatHybridLegacyGradePayload(row,publishedList,immutable,'N');
  assert.deepEqual(old,{success:true,grado:'N',total:2,data:[
    {id:'opinione_a',text:'Opinione A',grado:['N'],userAnswer:'c'},
    {id:'un_nuovo_tema',text:'Un nuovo tema',grado:['N'],userAnswer:'f'}
  ]});
  const profile=formatHybridProfileOpinions(row,publishedList,immutable);
  assert.deepEqual(profile,[
    {id:'opinione_0',text:'Opinione A',grado:['N'],userAnswer:'c',source:'Fonte storica'},
    {id:'opinione_3',text:'Un nuovo tema',grado:['N'],userAnswer:'f',source:'unknown'}
  ]);
  assert.equal(row.fonti_opinioni.opinione_0,'Fonte storica');
});
