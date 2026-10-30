'use strict';
// Contract on the actual shared /api/opinioni/check-missing service.
// Only the published IDs are taken from code. A user's answers still require
// an authorized SQL query; no personal answer fixtures leave this process.
const test=require('node:test');
const assert=require('node:assert/strict');
const {getAllOpinions,getOpinionsForGrade}=require('../services/opinionCatalog');
const {
  GRADI_PREFERITI_DEFAULT,getColonneOpinioniRisposte,computeCheckMissingForGrado
}=require('../services/opinioniCheckMissing');

test('check-missing derives all 94 published answer IDs from code without SQL metadata reads',async()=>{
  let calls=0;
  const pool={async query(){calls++;throw Error('FORBIDDEN_SCHEMA_DB_READ');}};
  const ids=await getColonneOpinioniRisposte(pool);
  assert.equal(calls,0,'No information_schema request is allowed');
  assert.equal(ids.size,94);
  assert.deepEqual([...ids].sort(),getAllOpinions().map(op=>op.id).sort());
  assert.ok(Object.isFrozen(getAllOpinions()[0]));
  assert.deepEqual(GRADI_PREFERITI_DEFAULT,['N','E','R','CO']);
});

test('provincial C grade computes missing questions with only one personal answer SELECT',async()=>{
  const grade='C',questions=getOpinionsForGrade(grade);
  assert.equal(questions.length,6,'Current published fixture has 6 provincial opinions');
  const first=questions[0].id,calls=[];
  const pool={async query(sql,values){
    calls.push({sql:String(sql),values});
    const row=Object.fromEntries(questions.map(x=>[x.id,null]));
    row[first]='f';
    return {rows:[row]};
  }};
  const ids=await getColonneOpinioniRisposte(pool);
  const result=await computeCheckMissingForGrado(pool,'synthetic-user',grade,ids);
  assert.equal(calls.length,1,'No schema round-trip is needed');
  assert.doesNotMatch(calls[0].sql,/information_schema|opinioni_domande|SELECT\s+\*/i);
  assert.match(calls[0].sql,/FROM opinioni_risposte/);
  assert.deepEqual(calls[0].values,['synthetic-user']);
  const columns=[...calls[0].sql.matchAll(/"([a-z][a-z0-9_]*)"/g)]
    .map(x=>x[1]).sort();
  assert.deepEqual(columns,questions.map(x=>x.id).sort());
  assert.equal(result.totaleOpinioni,6);
  assert.equal(result.opinioniRisposte,1);
  assert.equal(result.opinioniMancanti,5);
  assert.ok(!result.missingOpinions.some(x=>x.id===first));
});

test('the code catalog still marks all personal answers missing if no answer row exists',async()=>{
  const pool={async query(sql,values){
    assert.match(sql,/FROM opinioni_risposte/);
    assert.deepEqual(values,['synthetic-new-user']);
    return {rows:[]};
  }};
  const ids=await getColonneOpinioniRisposte(pool);
  for(const grade of ['N','R','C','CO','E']){
    const result=await computeCheckMissingForGrado(pool,'synthetic-new-user',grade,ids);
    assert.equal(result.totaleOpinioni,getOpinionsForGrade(grade).length);
    assert.equal(result.opinioniRisposte,0);
    assert.equal(result.opinioniMancanti,result.totaleOpinioni);
    assert.equal(result.isComplete,false);
  }
});

test('invalid grade is rejected before any personal SQL query',async()=>{
  let queries=0;
  const pool={async query(){queries++;throw Error('UNEXPECTED_SQL');}};
  const ids=await getColonneOpinioniRisposte(pool);
  await assert.rejects(
    computeCheckMissingForGrado(pool,'synthetic-user','UNKNOWN',ids),
    {code:'INVALID_GRADO'});
  assert.equal(queries,0);
});
