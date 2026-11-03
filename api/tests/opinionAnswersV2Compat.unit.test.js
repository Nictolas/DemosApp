'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {projectAnswers,formatOpinioniList}=
  require('../experiments/opinionAnswersV2CompatCandidate');

// Entirely invented public catalog metadata and invented personal answers.
const published=[
  {id:'opinione_0',text:'Domanda sintetica A',gradi_opinione:['N']},
  {id:'opinione_1',text:'Domanda sintetica B',gradi_opinione:['N','R']},
  {id:'opinione_94',text:'Nuova domanda sintetica',gradi_opinione:['N']}
];
test('same GET response shape from old columns or v2 answer map',()=>{
  const legacy={opinione_0:'f',opinione_1:'c',opinione_94:'i'};
  const v2={opinione_0:'f',opinione_1:'c',opinione_94:'i'};
  const expected={success:true,grado:'N',total:3,data:[
    {id:'opinione_0',text:'Domanda sintetica A',grado:['N'],userAnswer:'f'},
    {id:'opinione_1',text:'Domanda sintetica B',grado:['N','R'],userAnswer:'c'},
    {id:'opinione_94',text:'Nuova domanda sintetica',grado:['N'],userAnswer:'i'}
  ]};
  assert.deepEqual(formatOpinioniList(published,legacy,'N'),expected);
  assert.deepEqual(formatOpinioniList(published,v2,'N'),expected);
});
test('new ID needs no dedicated response column; missing answer is null',()=>{
  const old={opinione_0:'f',opinione_1:'c'};
  const data=formatOpinioniList(published,old,'N').data;
  assert.equal(data[2].id,'opinione_94');
  assert.equal(data[2].userAnswer,null);
});
test('archived answers remain stored but are absent from public projection',()=>{
  const stored={opinione_0:'f',opinione_1:'i',opinione_archived:'c'};
  const result=projectAnswers(published,stored);
  assert.equal(result.length,3);
  assert.equal(result.some(x=>x.id==='opinione_archived'),false);
  assert.equal(stored.opinione_archived,'c');
});
test('response projection rejects malformed values and duplicate catalog IDs',()=>{
  assert.throws(()=>formatOpinioniList(published,{opinione_0:'not-valid'},'N'),/Malformed/);
  assert.throws(()=>projectAnswers([...published,published[0]],{}),/duplicate/);
  assert.throws(()=>formatOpinioniList(published,{},''),/Grade required/);
  assert.throws(()=>projectAnswers(published,[]),/Invalid opinion projection/);
});
test('does not mutate input arrays or leak service/user fields',()=>{
  const rows={opinione_0:'f',user_id:'invented',fonti_opinioni:{x:'synthetic'}};
  const result=projectAnswers(published,rows);
  assert.equal(Object.hasOwn(result[0],'user_id'),false);
  assert.equal(Object.hasOwn(result[0],'fonti_opinioni'),false);
  result[0].grado.push('E');
  assert.deepEqual(published[0].gradi_opinione,['N']);
  assert.equal(rows.opinione_0,'f');
});
