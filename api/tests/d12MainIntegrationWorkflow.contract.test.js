'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '../../.github/workflows/unified-subject-proposal-page.yml'),
  'utf8'
);

test('Draft integration CI validates present main instead of requiring historic conflicts', () => {
  const job = workflow.split('  main-integration-candidate:')[1];
  assert.ok(job, 'Candidate job must remain defined');
  assert.match(job, /git merge-base --is-ancestor/);
  assert.match(job, /git merge-tree --write-tree/);
  assert.doesNotMatch(job, /EXPECTED_FILES|Unexpected main integration overlap|Review exact nine conflicts/);
  for (const safeguard of [
    'lockCivicPushDuringAccountErasure(client)',
    'DELETE FROM subject_proposals WHERE proposer_user_id::text=',
    'reconcileCivicTopicsForUser',
    'compasso-politico',
    'gestisci/proposte-soggetti',
    'privacyErasureCombinedGuards.contract.test.js',
    'npm run build --prefix client',
    'GDPR and real staging/Android release gates remain NO-GO'
  ]) {
    assert.ok(job.includes(safeguard), 'missing integrated safeguard: ' + safeguard);
  }
  assert.doesNotMatch(job, /git push|git merge origin\/main|render deploy|supabase db push/);
});
