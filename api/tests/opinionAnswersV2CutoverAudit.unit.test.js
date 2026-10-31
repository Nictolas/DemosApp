'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../experiments/opinionAnswersV2HistoricalManifest.json');
const {
  DEPENDENCIES,REQUIRED_INTEGRATION,verifyCatalog,
  auditHybridCutoverReadiness
}=require('../experiments/opinionAnswersV2CutoverAuditCandidate');

const commit='a'.repeat(40);
const metadata=()=>[
  {column_name:'user_id',data_type:'uuid'},
  {column_name:'fonti_opinioni',data_type:'jsonb'},
  ...manifest.historicalIds.map(id=>({column_name:id,data_type:'text'}))
];
function deps(merged){
  return Object.fromEntries(DEPENDENCIES.map(({pr,key})=>[
    key,{number:pr,merged,integratedSha:commit}
  ]));
}
function evidence(sha=commit){
  return Object.fromEntries(REQUIRED_INTEGRATION.map(key=>[
    key,{
      status:'pass',commit:sha,
      evidenceUrl:'https://github.com/Nictolas/DemosApp/actions/runs/123',
      reviewedBy:'independent-test-reviewer'
    }
  ]));
}
function readyFixture(){
  return {
    schemaColumns:[...metadata(),{
      column_name:'answers_extra',data_type:'jsonb'
    }],
    catalogIds:manifest.historicalIds.slice(),
    integrationCommit:commit,
    dependencyStatuses:deps(true),
    integrationChecks:evidence()
  };
}
function codes(report){
  return report.blockers.map(x=>x.code);
}

test('actual pre-migration shape MUST report NO-GO even if 94 TEXT columns match',()=>{
  const report=auditHybridCutoverReadiness({
    schemaColumns:metadata(),
    catalogIds:manifest.historicalIds,
    // PR #384, #464 and #374 currently open/draft; these injected
    // statuses are a test fixture, NOT a GitHub status fetch.
    dependencyStatuses:deps(false)
  });
  assert.equal(report.mode,'dry-run');
  assert.equal(report.releaseAuthorized,false);
  assert.equal(report.mechanicallyReady,false);
  assert.equal(report.schemaVerified,true);
  assert.equal(report.overflowColumnPresent,false);
  assert.equal(report.historicalIdsRequired,94);
  assert.deepEqual(report.catalog,{
    publishedCount:94,historicalPublished:94,overflowPublished:0
  });
  assert.ok(codes(report).includes('FUTURE_JSONB_COLUMN_NOT_PRESENT'));
  assert.ok(codes(report).includes('REQUIRED_PR_NOT_INTEGRATED_384'));
  assert.ok(codes(report).includes('REQUIRED_PR_NOT_INTEGRATED_464'));
  assert.ok(codes(report).includes('REQUIRED_PR_NOT_INTEGRATED_374'));
  assert.ok(codes(report).includes('MANUAL_RELEASE_AUTHORIZATION_REQUIRED'));
});

test('even all optimistic paper evidence cannot authorize merge, DDL or deploy',()=>{
  const report=auditHybridCutoverReadiness(readyFixture());
  assert.equal(report.mechanicallyReady,true);
  assert.equal(report.releaseAuthorized,false);
  assert.deepEqual(codes(report),['MANUAL_RELEASE_AUTHORIZATION_REQUIRED']);
});

test('missing 94th, duplicate, wrong-type and unknown SQL column always block',()=>{
  for(const mutated of [
    metadata().filter(x=>x.column_name!==manifest.historicalIds[3]),
    [...metadata(),metadata()[2]],
    metadata().map(x=>x.column_name===manifest.historicalIds[1]
      ? {...x,data_type:'boolean'}:x),
    [...metadata(),{column_name:'untracked_answer',data_type:'text'}],
    metadata().map(x=>x.column_name==='fonti_opinioni'
      ? {...x,data_type:'text'}:x)
  ]){
    const report=auditHybridCutoverReadiness({
      ...readyFixture(),schemaColumns:mutated
    });
    assert.equal(report.schemaVerified,false);
    assert.equal(report.mechanicallyReady,false);
    assert.ok(codes(report).includes('LIVE_SCHEMA_UNVERIFIED'));
  }
});

test('answers_extra must be a JSONB service column when the time comes',()=>{
  const report=auditHybridCutoverReadiness({
    ...readyFixture(),
    schemaColumns:[...metadata(),{column_name:'answers_extra',data_type:'text'}]
  });
  assert.equal(report.mechanicallyReady,false);
  assert.ok(codes(report).includes('LIVE_SCHEMA_UNVERIFIED'));
});

test('frozen 94 IDs cannot be changed or abbreviated to 93',()=>{
  for(const ids of [
    manifest.historicalIds.slice(0,-1),
    manifest.historicalIds.slice().reverse(),
    [...manifest.historicalIds.slice(0,-1),'new_historical_alias'],
    [...manifest.historicalIds,manifest.historicalIds[0]]
  ]){
    const report=auditHybridCutoverReadiness({
      ...readyFixture(),historicalIds:ids
    });
    assert.ok(codes(report).includes('IMMUTABLE_HISTORY_MISMATCH'));
    assert.equal(report.releaseAuthorized,false);
  }
});

test('published catalog may archive an old question or publish future JSONB keys',()=>{
  const newId='opinione_future_extra_95';
  const v=verifyCatalog(
    [...manifest.historicalIds.slice(1),newId],
    manifest.historicalIds
  );
  assert.deepEqual(v,{
    publishedCount:94,historicalPublished:93,overflowPublished:1
  });
  const report=auditHybridCutoverReadiness({
    ...readyFixture(),
    catalogIds:[...manifest.historicalIds.slice(1),newId]
  });
  assert.equal(report.catalog.overflowPublished,1);
  assert.equal(report.mechanicallyReady,true);
  assert.equal(report.releaseAuthorized,false);
});

test('invalid published IDs, duplicates and missing catalog fail closed',()=>{
  for(const catalogIds of [
    [],[...manifest.historicalIds,'bad;DROP TABLE users'],
    [...manifest.historicalIds,manifest.historicalIds[0]],
    ['__proto__','opinion_ok'],
    'opinione_0'
  ]){
    const report=auditHybridCutoverReadiness({
      ...readyFixture(),catalogIds
    });
    assert.ok(codes(report).includes('PUBLISHED_CATALOG_INVALID'));
    assert.equal(report.mechanicallyReady,false);
  }
});

test('each linked PR must be actually integrated, not merely open with green CI',()=>{
  for(const {key,pr} of DEPENDENCIES){
    const d=deps(true);
    d[key]={...d[key],merged:false};
    const report=auditHybridCutoverReadiness({
      ...readyFixture(),dependencyStatuses:d
    });
    assert.ok(codes(report).includes('REQUIRED_PR_NOT_INTEGRATED_'+pr));
    assert.equal(report.mechanicallyReady,false);
  }
});

test('stale, wrong-commit and unreviewed evidence cannot pass audit',()=>{
  for(const key of REQUIRED_INTEGRATION){
    const checks=evidence();
    checks[key]={...checks[key],commit:'b'.repeat(40)};
    const report=auditHybridCutoverReadiness({
      ...readyFixture(),integrationChecks:checks
    });
    assert.ok(codes(report).includes(
      'MISSING_INDEPENDENT_EVIDENCE_'+key
    ));
    assert.equal(report.releaseAuthorized,false);
  }
  const unpinned=auditHybridCutoverReadiness({
    ...readyFixture(),integrationCommit:undefined
  });
  assert.ok(codes(unpinned).includes('INTEGRATION_COMMIT_NOT_PINNED'));
  assert.equal(unpinned.mechanicallyReady,false);
});

test('every read requires explicitly verified privacy review and genuine B2 restore evidence',()=>{
  const checks=evidence();
  delete checks.realGdprB2RestoreWithExternalLedger;
  delete checks.publicStatsLongitudinalPrivacyReview;
  const r=auditHybridCutoverReadiness({
    ...readyFixture(),integrationChecks:checks
  });
  assert.ok(codes(r).includes(
    'MISSING_INDEPENDENT_EVIDENCE_realGdprB2RestoreWithExternalLedger'
  ));
  assert.ok(codes(r).includes(
    'MISSING_INDEPENDENT_EVIDENCE_publicStatsLongitudinalPrivacyReview'
  ));
  assert.equal(r.mechanicallyReady,false);
});

test('report is read-only and does not mutate any supplied status or schema',()=>{
  const fixture=readyFixture();
  const before=JSON.stringify(fixture);
  const r=auditHybridCutoverReadiness(fixture);
  assert.equal(JSON.stringify(fixture),before);
  assert.equal(Object.isFrozen(r),true);
  assert.equal(Object.isFrozen(r.blockers),true);
  assert.equal(Object.isFrozen(r.blockers[0]),true);
  assert.equal(r.releaseAuthorized,false);
});
