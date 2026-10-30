'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  DELETE_V2_SQL,SELECT_V2_EXPORT_SQL,
  deleteV2AnswersInsideGdprTransaction,
  projectV2GdprExport,planPostSnapshotPoliticalErasure
}=require('../experiments/opinionAnswersV2GdprCandidate');

const u1='00000000-0000-4000-8000-000000000021';
const u2='00000000-0000-4000-8000-000000000022';
const at='2026-10-30T11:00:00.000Z';
const e=(key,user,type,time)=>({
  event_key:key,subject_user_id:user,event_type:type,occurred_at:time
});

test('GDPR erasure SQL is private and parametrized; missing v2 table must not be silently ignored',()=>{
  assert.match(DELETE_V2_SQL,/^DELETE FROM demos_private\.opinion_answer_maps_v2 WHERE user_id = \$1::uuid$/);
  assert.match(SELECT_V2_EXPORT_SQL,/WHERE user_id = \$1::uuid$/);
  assert.doesNotMatch(DELETE_V2_SQL,/IF EXISTS|information_schema/i);
});

test('v2 erasure adapter performs one DELETE in existing transaction, validates outcome',async()=>{
  const calls=[];
  const result=await deleteV2AnswersInsideGdprTransaction({
    query:async(sql,args)=>{calls.push({sql,args});return{rowCount:1};}
  },u1);
  assert.equal(result,1);
  assert.deepEqual(calls,[{sql:DELETE_V2_SQL,args:[u1]}]);
  assert.equal(await deleteV2AnswersInsideGdprTransaction({query:async()=>({rowCount:0})},u1),0);
  await assert.rejects(deleteV2AnswersInsideGdprTransaction({query:async()=>({rowCount:undefined})},u1),/Invalid deletion result/);
  await assert.rejects(deleteV2AnswersInsideGdprTransaction({query:async()=>({rowCount:1})},'user-not-a-uuid'),/UUID/);
  await assert.rejects(deleteV2AnswersInsideGdprTransaction({},u1),/transaction client/);
});

test('v2 GDPR export includes archived IDs and excludes unrelated account fields',()=>{
  const exportRow=projectV2GdprExport(u1,{
    user_id:u1,answers:{opinione_0:'f',opinione_archiviata:'i'},
    email:'synthetic@example.invalid',fonti_opinioni:{another:'synthetic'}
  });
  assert.deepEqual({...exportRow.answers_by_id},
    {opinione_0:'f',opinione_archiviata:'i'});
  assert.equal(exportRow.answer_sources_included,false);
  assert.equal(exportRow.format,'demos-opinion-answers-v2');
  assert.equal(Object.hasOwn(exportRow,'email'),false);
  assert.equal(Object.hasOwn(exportRow,'user_id'),false);
  assert.equal(Object.hasOwn(exportRow,'fonti_opinioni'),false);
  assert.equal(projectV2GdprExport(u1,null),null);
});

test('mismatched subject, malformed answers and invalid UUID never export data',()=>{
  assert.throws(()=>projectV2GdprExport(u2,{user_id:u1,answers:{opinione_0:'f'}}),
    /GDPR_EXPORT_SUBJECT_MISMATCH/);
  assert.throws(()=>projectV2GdprExport(u1,{user_id:u1,answers:{opinione_0:'unsafe'}}),
    /Malformed stored opinion/);
  assert.throws(()=>projectV2GdprExport(u1,{user_id:u1,answers:['f']}),/Stored answers/);
  assert.throws(()=>projectV2GdprExport('not-a-uuid',null),/UUID/);
});

test('revocation after restored snapshot must erase old answers even after regrant',()=>{
  const events=[
    e('event-2',u1,'political_consent_granted','2026-10-30T13:00:00.000Z'),
    e('event-1',u1,'political_consent_revoked','2026-10-30T12:00:00.000Z')
  ];
  assert.deepEqual(planPostSnapshotPoliticalErasure(events,{snapshotAt:at}),[{
    user_id:u1,erase_legacy_answers:true,erase_v2_answers:true,account_deleted:false
  }]);
});

test('deleted account always takes precedence over later grant',()=>{
  const events=[
    e('deleted',u2,'account_deleted','2026-10-30T11:01:00.000Z'),
    e('grant',u2,'political_consent_granted','2026-10-30T13:00:00.000Z')
  ];
  assert.deepEqual(planPostSnapshotPoliticalErasure(events,{snapshotAt:at}),[{
    user_id:u2,erase_legacy_answers:true,erase_v2_answers:true,account_deleted:true
  }]);
});

test('pre-snapshot events do not erase valid post-regrant answers in later snapshots',()=>{
  const events=[
    e('revoked-old',u1,'political_consent_revoked','2026-10-30T09:00:00.000Z'),
    e('granted-new',u1,'political_consent_granted','2026-10-30T10:00:00.000Z')
  ];
  assert.deepEqual(planPostSnapshotPoliticalErasure(events,{snapshotAt:at}),[]);
});

test('replay is idempotent for matching duplicate events, fails closed on conflicting keys',()=>{
  const revoke=e('same',u1,'political_consent_revoked','2026-10-30T12:00:00.000Z');
  assert.equal(planPostSnapshotPoliticalErasure([revoke,{...revoke}],{snapshotAt:at}).length,1);
  assert.throws(()=>planPostSnapshotPoliticalErasure([revoke,{...revoke,subject_user_id:u2}],{snapshotAt:at}),/Conflicting duplicate/);
  assert.throws(()=>planPostSnapshotPoliticalErasure([e('bad',u1,'unknown','2026-10-30T12:00:00.000Z')],{snapshotAt:at}),/Malformed/);
  assert.throws(()=>planPostSnapshotPoliticalErasure([e('bad',u1,'account_deleted','bad-date')],{snapshotAt:at}),/Timestamp/);
  assert.throws(()=>planPostSnapshotPoliticalErasure([],{}),/Timestamp/);
});

test('restore snapshot boundary is conservative and ordered by ID',()=>{
  const input=[
    e('a',u2,'political_consent_revoked','2026-10-30T11:00:00.000Z'),
    e('b',u1,'political_consent_revoked','2026-10-30T12:00:00.000Z')
  ];
  const list=planPostSnapshotPoliticalErasure(input,{snapshotAt:at});
  // Boundary events have identical timestamps; fail closed by including them.
  assert.equal(list.length,2);
  assert.deepEqual(list.map(x=>x.user_id),[u1,u2]);
});
