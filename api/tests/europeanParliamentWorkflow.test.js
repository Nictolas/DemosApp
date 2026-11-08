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
    'europeanParliamentCurrentOnlyCandidateBridge.test.js'
  ];
  for(const name of required){
    assert.ok(paths.includes("'api/tests/"+name+"'"),'Missing path for '+name);
    assert.ok(testBlock.includes('api/tests/'+name),'Missing real run for '+name);
  }
  assert.doesNotMatch(paths, /\.test\.js \w+\/\w+\.test\.js/, 'Two source paths improperly combined');
  assert.match(workflow,/api\/services\/europeanParliamentCurrentOnlyCandidateBridge\.js/);
  assert.match(workflow,/node --check api\/services\/europeanParliamentCurrentOnlyCandidateBridge\.js/);
});

test('real official API remains manual pre-release; Chromium mobile runs on PR branch',()=>{
  assert.match(workflow,/name: Complete Italian MEP latest verified whole-text ballots \(manual release gate\)/);
  assert.match(workflow,/if: github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow,/run: node api\/scripts\/verifyEuropeanParliamentLatestSitting\.js/);
  assert.doesNotMatch(workflow,/One-time read-only real EP latest-vote 76 MEP coverage audit/);
  assert.match(workflow,/name: European representative current vote — real Chrome mobile synthetic/);
  assert.match(workflow,/run: node --test api\/tests\/europeanRepresentativeChrome\.synthetic\.e2e\.test\.js/);
});
