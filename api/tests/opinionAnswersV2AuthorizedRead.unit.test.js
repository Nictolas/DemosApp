'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  SELECT_AUTHORIZED_HYBRID_ROW_SQL,
  createHybridAuthorizedReadCandidate,isHybridReadWithGate
}=require('../experiments/opinionAnswersV2AuthorizedReadCandidate');

const id='00000000-0000-4000-8000-000000000071';
const other='00000000-0000-4000-8000-000000000072';
function harness(rows,options={}){
  const calls=[];
  const read=createHybridAuthorizedReadCandidate({
    db:{query:async(sql,params)=>{
      calls.push({sql,params});
      if(options.throwSql)throw Error('Synthetic SQL failure');
      return {rows};
    }},
    assertRestoreReady:async()=>{
      calls.push({sql:'EXTERNAL_GATE'});
      if(options.closed){
        const e=Error('restore closed');
        e.code='RESTORE_NOT_READY';throw e;
      }
      return options.gateValue??true;
    }
  });
  return {read,calls};
}

test('single query joins consent and answers only under active permission',async()=>{
  const row={
    subject_id:id,granted:true,
    answer_row:{user_id:id,opinione_0:'f',
      answers_extra:{opinione_95:'c'},fonti_opinioni:{}}
  };
  const h=harness([row]);
  assert.deepEqual(await h.read(id),{status:'ok',row:row.answer_row});
  assert.equal(h.calls.length,2);
  assert.equal(h.calls[0].sql,'EXTERNAL_GATE');
  assert.equal(h.calls[1].sql,SELECT_AUTHORIZED_HYBRID_ROW_SQL);
  assert.deepEqual(h.calls[1].params,[id]);
  assert.match(SELECT_AUTHORIZED_HYBRID_ROW_SQL,/LEFT JOIN opinioni_risposte orr ON orr.user_id=u.id/);
  assert.match(SELECT_AUTHORIZED_HYBRID_ROW_SQL,/AND COALESCE\(uc.political_opinions_consent,/);
  assert.doesNotMatch(SELECT_AUTHORIZED_HYBRID_ROW_SQL,/information_schema|opinioni_domande/);
});

test('missing, refused or consented-without-answers users have distinct results',async()=>{
  assert.deepEqual(await harness([]).read(id),{status:'missing'});
  assert.deepEqual(await harness([{
    subject_id:id,granted:false,answer_row:null
  }]).read(id),{status:'forbidden'});
  assert.deepEqual(await harness([{
    subject_id:id,granted:true,answer_row:null
  }]).read(id),{status:'ok',row:null});
});

test('restore gate prevents any SQL and cannot be bypassed with false result',async()=>{
  for(const opts of [{closed:true},{gateValue:false}]){
    const h=harness([{
      subject_id:id,granted:true,answer_row:null
    }],opts);
    await assert.rejects(h.read(id),e=>e.code==='RESTORE_NOT_READY');
    assert.deepEqual(h.calls.map(x=>x.sql),['EXTERNAL_GATE']);
  }
});

test('never accepts caller-controlled IDs, duplicate rows or wrong subject',async()=>{
  const h=harness([{
    subject_id:id,granted:true,answer_row:null
  }]);
  await assert.rejects(h.read('injected OR true'),/UUID/);
  assert.equal(h.calls.length,0);
  const wrong=harness([{
    subject_id:other,granted:true,answer_row:{user_id:other}
  }]);
  await assert.rejects(wrong.read(id),/Invalid authorized read result/);
  const swapped=harness([{
    subject_id:id,granted:true,answer_row:{user_id:other}
  }]);
  await assert.rejects(swapped.read(id),/wrong subject/);
  const duplicates=harness([
    {subject_id:id,granted:true,answer_row:null},
    {subject_id:id,granted:true,answer_row:null}
  ]);
  await assert.rejects(duplicates.read(id),/Unexpected authorized read result/);
});

test('denied SQL response carrying answer data fails closed instead of leaking',async()=>{
  const h=harness([{
    subject_id:id,granted:false,
    answer_row:{user_id:id,opinione_0:'f'}
  }]);
  await assert.rejects(h.read(id),/Denied subject/);
  const invalid=harness([{
    subject_id:id,granted:'true',answer_row:null
  }]);
  await assert.rejects(invalid.read(id),/Invalid authorized read result/);
});

test('SQL errors propagate; there is no silent cache fallback',async()=>{
  const h=harness([],{throwSql:true});
  await assert.rejects(h.read(id),/Synthetic SQL failure/);
  assert.equal(h.calls.length,2);
  assert.throws(()=>createHybridAuthorizedReadCandidate({
    db:{query:async()=>({rows:[]})}
  }),/external restore gate/);
});


test('only factory-produced readers match the exact external gate identity',()=>{
  const gate=async()=>true;
  const db={query:async()=>({rows:[]})};
  const read=createHybridAuthorizedReadCandidate({
    db,assertRestoreReady:gate
  });
  assert.equal(isHybridReadWithGate(read,gate),true);
  assert.equal(isHybridReadWithGate(read,async()=>true),false);
  assert.equal(isHybridReadWithGate(async()=>({status:'ok',row:{}}),gate),false);
  assert.equal(isHybridReadWithGate(undefined,gate),false);
  assert.equal(isHybridReadWithGate(read.bind(null),gate),false);
  assert.equal(isHybridReadWithGate(async()=>null,undefined),false);
  assert.equal(isHybridReadWithGate(read,undefined),false);
});
