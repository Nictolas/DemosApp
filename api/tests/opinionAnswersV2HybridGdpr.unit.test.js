'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../experiments/opinionAnswersV2HistoricalManifest.json');
const {
  SQL,projectHybridGdprSubjectExport,
  deleteHybridOpinionsInsideGdprTransaction,
  planHybridPostRestoreErasure
}=require('../experiments/opinionAnswersV2HybridGdprCandidate');

const ids=manifest.historicalIds;
const subject='00000000-0000-4000-8000-000000000040';
const other='00000000-0000-4000-8000-000000000041';
const old=ids[0],archived=ids[17];
const baseRow={
  user_id:subject,
  ...Object.fromEntries(ids.map(id=>[id,null])),
  [old]:'f',[archived]:'c',
  answers_extra:{opinione_95_synthetic:'i',opinione_archived_future:'f'},
  fonti_opinioni:{
    [old]:'https://example.invalid/first',
    [archived]:'Archived source note',
    opinione_archived_future:'https://example.invalid/archive'
  }
};

test('subject export preserves 94 historical slots, archived answers, future answers and sources',()=>{
  const out=projectHybridGdprSubjectExport(subject,baseRow,ids);
  assert.equal(out.format,'demos-opinion-answers-hybrid');
  assert.equal(out.historical_columns_included,94);
  assert.equal(out.future_opinions_included,2);
  assert.deepEqual({...out.answers_by_id},{
    [old]:'f',[archived]:'c',
    opinione_95_synthetic:'i',opinione_archived_future:'f'
  });
  assert.deepEqual({...out.sources_by_id},baseRow.fonti_opinioni);
  assert.equal(Object.hasOwn(out,'user_id'),false);
  assert.equal(Object.hasOwn(out,'fonti_opinioni'),false);
});

test('authorized export rejects another subject and partial or corrupted source rows',()=>{
  assert.throws(()=>projectHybridGdprSubjectExport(other,baseRow,ids),
    /SUBJECT_MISMATCH/);
  assert.throws(()=>projectHybridGdprSubjectExport(subject,{
    ...baseRow,user_id:'bad'
  },ids),/UUID/);
  const {fonti_opinioni,...withoutSources}=baseRow;
  assert.throws(()=>projectHybridGdprSubjectExport(subject,withoutSources,ids),
    /INCOMPLETE_ROW/);
  const {answers_extra,...withoutOverflow}=baseRow;
  assert.throws(()=>projectHybridGdprSubjectExport(subject,withoutOverflow,ids),
    /INCOMPLETE_ROW/);
  const withoutLegacy={...baseRow};
  delete withoutLegacy[old];
  assert.throws(()=>projectHybridGdprSubjectExport(subject,withoutLegacy,ids),
    /Missing legacy column/);
  assert.throws(()=>projectHybridGdprSubjectExport(subject,{
    ...baseRow,answers_extra:{[old]:'i'}
  },ids),/DUPLICATE_HISTORICAL_ID/);
  assert.throws(()=>projectHybridGdprSubjectExport(subject,{
    ...baseRow,fonti_opinioni:{[old]:{nested:'not a source string'}}
  },ids),/Invalid stored opinion source/);
  assert.equal(projectHybridGdprSubjectExport(subject,null,ids),null);
});

test('one table DELETE is parameterized and its result must be verified',async()=>{
  assert.equal(SQL.deleteWholeRow,
    'DELETE FROM public.opinioni_risposte WHERE user_id=$1::uuid');
  assert.equal(SQL.authorizedExport,
    'SELECT * FROM public.opinioni_risposte WHERE user_id=$1::uuid');
  const calls=[];
  const fakeDb={query:async(sql,params)=>{
    calls.push({sql,params});
    return {rowCount:1};
  }};
  assert.equal(await deleteHybridOpinionsInsideGdprTransaction(fakeDb,subject),1);
  assert.deepEqual(calls,[{sql:SQL.deleteWholeRow,params:[subject]}]);
  assert.equal(await deleteHybridOpinionsInsideGdprTransaction({
    query:async()=>({rowCount:0})
  },subject),0);
  await assert.rejects(deleteHybridOpinionsInsideGdprTransaction({
    query:async()=>({rowCount:null})
  },subject),/UNVERIFIED/);
  await assert.rejects(deleteHybridOpinionsInsideGdprTransaction({
    query:async()=>{const e=Error('Table missing');e.code='42P01';throw e;}
  },subject),e=>e.code==='42P01');
  await assert.rejects(deleteHybridOpinionsInsideGdprTransaction(fakeDb,'bad'),
    /UUID/);
});

test('revoke THEN regrant after backup still requires deleting all restored political answers',()=>{
  const events=[
    {event_key:'later-grant',subject_user_id:subject,
      event_type:'political_consent_granted',occurred_at:'2026-10-30T13:00:00Z'},
    {event_key:'past-grant',subject_user_id:other,
      event_type:'political_consent_granted',occurred_at:'2026-10-30T09:00:00Z'},
    {event_key:'old-revoke',subject_user_id:subject,
      event_type:'political_consent_revoked',occurred_at:'2026-10-30T12:00:00Z'}
  ];
  assert.deepEqual(planHybridPostRestoreErasure(events,{
    snapshotAt:'2026-10-30T11:00:00Z'
  }),[{
    user_id:subject,erase_hybrid_opinion_row:true,account_deleted:false
  }]);
  assert.deepEqual(planHybridPostRestoreErasure(events,{
    snapshotAt:'2026-10-30T14:00:00Z'
  }),[]);
  assert.throws(()=>planHybridPostRestoreErasure(events,{}),/Timestamp/);
  assert.throws(()=>planHybridPostRestoreErasure(null,{
    snapshotAt:'2026-10-30T11:00:00Z'
  }),/External event list/);
});

test('account deletion after snapshot also requires full-row erasure',()=>{
  const plan=planHybridPostRestoreErasure([
    {event_key:'delete-1',subject_user_id:subject,
      event_type:'account_deleted',occurred_at:'2026-10-30T13:00:00Z'}
  ],{snapshotAt:'2026-10-30T11:00:00Z'});
  assert.deepEqual(plan,[{
    user_id:subject,erase_hybrid_opinion_row:true,account_deleted:true
  }]);
});
