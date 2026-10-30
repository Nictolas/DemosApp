'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  buildVersionedOpinionPublication
}=require('../experiments/opinionAnswersV2PublishedSnapshotCandidate');
const {
  evaluateLongitudinalOpinionPublication
}=require('../experiments/opinionAnswersV2TemporalPrivacyGateCandidate');

const id='opinione_95';
const counts=(f,c=0,i=0)=>({favorevole:f,contrario:c,indeciso:i});
function make(version,national,regions={},text='Domanda sintetica'){
  return buildVersionedOpinionPublication({
    opinionId:id,questionText:text,version,
    snapshotRows:[
      {is_national:1,regione:null,...national},
      ...Object.entries(regions).map(([regione,row])=>({
        is_national:0,regione,...row
      }))
    ]
  });
}
test('10→11 participants: unchanged k=10 minimum does NOT protect a one-person time delta',()=>{
  const old=make('snapshot_1',counts(10),{TO:counts(10)});
  const latest=make('snapshot_2',counts(10,1),{
    TO:counts(10),LA:counts(0,1)
  });
  assert.equal(old.national.minimumCellSize,10);
  assert.equal(latest.national.minimumCellSize,10);
  assert.equal(latest.national.suppressed,false);
  const plan=evaluateLongitudinalOpinionPublication({
    previous:old,proposed:latest
  });
  assert.equal(plan.action,'BLOCK_NEW_PUBLICATION');
  assert.equal(plan.releaseAuthorized,false);
  assert.equal(plan.requiresIndependentReview,true);
  assert.ok(plan.blockers.includes(
    'NATIONAL_PUBLIC_COUNTS_OR_SUPPRESSION_CHANGED'
  ));
  // No raw category numbers or personally identifying data in report.
  assert.equal(JSON.stringify(plan).includes('favorevole'),false);
});

test('one person switching position in a 20-person stable group also blocks release',()=>{
  const v1=make('v1',counts(20),{TO:counts(20)});
  const v2=make('v2',counts(19,1),{TO:counts(19,1)});
  const result=evaluateLongitudinalOpinionPublication({
    previous:v1,proposed:v2
  });
  assert.equal(result.releaseAuthorized,false);
  assert.ok(result.blockers.includes('NATIONAL_PUBLIC_COUNTS_OR_SUPPRESSION_CHANGED'));
});

test('same national stats but new suppression pattern in a region blocks new version',()=>{
  const first=make('v1',counts(20),{TO:counts(10),LO:counts(10)});
  const next=make('v2',counts(20),{
    TO:counts(9),LO:counts(10),LA:counts(1)
  });
  assert.deepEqual(first.national.stats,next.national.stats);
  const result=evaluateLongitudinalOpinionPublication({
    previous:first,proposed:next
  });
  assert.equal(result.action,'BLOCK_NEW_PUBLICATION');
  assert.ok(result.blockers.includes(
    'REGIONAL_PUBLIC_COUNTS_OR_SUPPRESSION_CHANGED'
  ));
});

test('identical public values: reuse prior reviewed version, do not issue another version',()=>{
  const first=make('v1',counts(10),{TO:counts(10)});
  const second=make('v2',counts(10),{TO:counts(10)});
  const out=evaluateLongitudinalOpinionPublication({
    previous:first,proposed:second
  });
  assert.equal(out.action,'REUSE_PREVIOUS_VERSION');
  assert.equal(out.canReusePreviouslyApprovedVersion,true);
  assert.equal(out.requiresIndependentReview,false);
  assert.equal(out.releaseAuthorized,false);
  assert.equal(first.version,'v1');
  assert.equal(second.version,'v2');
  assert.equal(first.national.stats.favorevole,10);
});

test('first-ever public publication always requires external privacy review',()=>{
  const first=make('v1',counts(10,1),{TO:counts(10,1)});
  const out=evaluateLongitudinalOpinionPublication({
    previous:null,proposed:first
  });
  assert.equal(out.action,'BLOCK_NEW_PUBLICATION');
  assert.ok(out.blockers.includes(
    'FIRST_RELEASE_REQUIRES_INDEPENDENT_PRIVACY_REVIEW'
  ));
});

test('old version cannot be reused with DIFFERENT counts even under same identifier',()=>{
  const first=make('same_version',counts(10),{TO:counts(10)});
  const second=make('same_version',counts(11),{TO:counts(11)});
  const out=evaluateLongitudinalOpinionPublication({
    previous:first,proposed:second
  });
  assert.ok(out.blockers.includes('SAME_VERSION_REUSED_FOR_DIFFERENT_RESULTS'));
  assert.equal(out.releaseAuthorized,false);
});

test('injected or forged prior/proposed payload fails closed',()=>{
  const first=make('v1',counts(10),{TO:counts(10)});
  assert.ok(evaluateLongitudinalOpinionPublication({
    previous:{...first},proposed:first
  }).blockers.includes('PREVIOUS_SNAPSHOT_NOT_VERIFIED'));
  assert.ok(evaluateLongitudinalOpinionPublication({
    previous:first,proposed:{...first,version:'v2'}
  }).blockers.includes('PROPOSED_SNAPSHOT_NOT_VERIFIED'));
  const another=buildVersionedOpinionPublication({
    opinionId:'another_opinion',questionText:'Different',
    version:'v2',snapshotRows:[
      {is_national:1,regione:null,...counts(10)},
      {is_national:0,regione:'TO',...counts(10)}
    ]
  });
  assert.ok(evaluateLongitudinalOpinionPublication({
    previous:first,proposed:another
  }).blockers.includes('OPINION_ID_CHANGED'));
});

test('a title-only change still requires public version review, not silent replacement',()=>{
  const first=make('v1',counts(10),{TO:counts(10)});
  const second=make('v2',counts(10),{TO:counts(10)},'Updated question');
  const out=evaluateLongitudinalOpinionPublication({
    previous:first,proposed:second
  });
  assert.equal(out.action,'BLOCK_NEW_PUBLICATION');
  assert.equal(out.requiresIndependentReview,true);
});
