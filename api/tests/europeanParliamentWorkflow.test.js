'use strict';
// Defend the EP release gate from accidentally skipping the identity-bridge
// and finality tests when adding another file to GitHub Actions.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,
  '../../.github/workflows/european-parliament-verified-rollcall.yml'),'utf8');

test('EP workflow correctly watches each relevant test file and runs all identity/source tests',()=>{
  const paths=workflow.slice(workflow.indexOf('    paths:'),workflow.indexOf('  workflow_dispatch:'));
  const testBlock=workflow.slice(
    workflow.indexOf('      - name: Strict official identifier/source/absence/order/cache contracts'),
    workflow.indexOf('      - name: Frontend type/build regression')
  );
  const required=[
    'europeanParliamentVerifiedRollCallReader.test.js',
    'europeanParliamentOfficialDecisionReader.test.js',
    'europeanRepresentativeCurrentVoteReader.test.js',
    'europeanParliamentOfficialDiscovery.test.js',
    'europeanParliamentCurrentOnlyCandidateBridge.test.js',
    'europeanParliamentSelectedCurrentOnlyReader.test.js',
    'europeanParliamentIdentityReviewReadonly.test.js'
  ];
  for(const name of required){
    assert.ok(paths.includes("'api/tests/"+name+"'"),'Missing path for '+name);
    assert.ok(testBlock.includes('api/tests/'+name),'Missing real run for '+name);
  }
  assert.doesNotMatch(paths, /\.test\.js \w+\/\w+\.test\.js/, 'Two source paths improperly combined');
  assert.ok(paths.includes("'api/database/20261108_ep_selected_identity_review_readonly.sql'"),
    'Reviewer queue SQL must trigger tests when changed');
  assert.ok(paths.includes("'client/src/pages/Rappresentanti/components/CategoriaPrincipale.tsx'"),
    'EU primary representative tile must trigger Chrome QA');
  assert.match(workflow,/api\/services\/europeanParliamentCurrentOnlyCandidateBridge\.js/);
  assert.match(workflow,/node --check api\/services\/europeanParliamentCurrentOnlyCandidateBridge\.js/);
  assert.match(workflow,/node --check api\/services\/europeanParliamentSelectedCurrentOnlyReader\.js/);
});

test('real official API remains manual pre-release; Chromium mobile runs on PR branch',()=>{
  assert.match(workflow,/name: Complete Italian MEP latest verified whole-text ballots \(manual release gate\)/);
  assert.match(workflow,/if: github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow,/run: node api\/scripts\/verifyEuropeanParliamentLatestSitting\.js/);
  assert.doesNotMatch(workflow,/One-time read-only real EP latest-vote 76 MEP coverage audit/);
  assert.match(workflow,/name: European representative current vote — real Chrome mobile synthetic/);
  assert.match(workflow,/run: node --test api\/tests\/europeanRepresentativeChrome\.synthetic\.e2e\.test\.js/);
});


test('ep-reader and PG16 jobs exercise actual PR633 shared writer and guard all fixture writes',()=>{
  assert.match(workflow,/ref: refs\/pull\/633\/head/);
  assert.match(workflow,/Cross-PR current-only writer contract with synthetic verified PE candidate/);
  assert.match(workflow,/node --test api\/tests\/europeanParliamentSharedWriterInterop\.test\.js/);
  assert.match(workflow,/Prove actual canonical followed-PE write, replay protection, review revocation, ROLLBACK/);
  assert.match(workflow,/node api\/tests\/epSelectedWriterRealPgSmoke\.js/);
  assert.match(workflow,/PGDATABASE: ep_bridge_ci_fixture/);
  assert.match(workflow,/EP_SCHEMA_FIXTURE_ONLY: 'true'/);
  assert.match(workflow,/ports:\s*\n\s*- 55434:5432/);
  assert.match(workflow,/api\/tests\/fixtures\/epSelectedWriterPgFixture\.sql/);
  for(const file of [
    'api/tests/europeanParliamentSharedWriterInterop.test.js',
    'api/tests/epSelectedWriterRealPgSmoke.js',
    'api/tests/fixtures/epSelectedWriterPgFixture.sql'
  ]) assert.ok(workflow.includes("'"+file+"'"),
    'A real shared-writer interop change must trigger QA: '+file);
});
