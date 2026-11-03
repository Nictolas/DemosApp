'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {EXPECTED_PG_ID, evaluateLegacyRenderPgRetirement: assess} =
  require('../scripts/evaluateLegacyRenderPgRetirement');

function allVerified() {
  return {
    resourceId: EXPECTED_PG_ID,
    backup: {existsVerified: true, sha256: 'a'.repeat(64), restoreTestPassed: true},
    dependencies: {allNineServicesAudited: true,
      oldDbConnectionReferencesCleared: true, productionTargetsExcluded: true},
    metrics: {windowHours: 36, coverageComplete: true,
      unattributedNonzeroSamples: 0, sourceAttributionVerified: true},
    staging: {functionalE2EGo: true, rollbackVerified: true},
    approval: {authorizedHumanReview: true},
  };
}

test('defaults to NO-GO with no evidence and never exposes a deletion action', () => {
  const r = assess();
  assert.equal(r.readyForHumanRetirementReview, false);
  assert.equal(r.canAutomaticallyDelete, false);
  assert.ok(r.blockers.includes('BACKUP_NOT_VERIFIED'));
  assert.ok(r.blockers.includes('CONNECTION_METRICS_INSUFFICIENT'));
  assert.ok(r.blockers.includes('UNIFIED_STAGING_NOT_FUNCTIONALLY_READY'));
});
test('observed Render active connections make legacy PG retirement a NO-GO', () => {
  const e = allVerified();
  e.metrics.unattributedNonzeroSamples = 76; // 5-minute samples on Nov 2–3.
  assert.equal(assess(e).readyForHumanRetirementReview, false);
  assert.ok(assess(e).blockers.includes('NONZERO_CONNECTIONS_NOT_ATTRIBUTED'));
});
test('probe-like periodic sessions cannot count as independently attributed', () => {
  const evidence = allVerified();
  evidence.metrics.sourceAttributionVerified = false;
  // Even if every sampled connection is classified "probably monitoring",
  // it is not safe to delete before the actual owner has been established.
  evidence.metrics.unattributedNonzeroSamples = 0;
  const assessment = assess(evidence);
  assert.equal(assessment.readyForHumanRetirementReview, false);
  assert.ok(assessment.blockers.includes(
    'CONNECTION_SOURCE_NOT_INDEPENDENTLY_VERIFIED'));
  assert.equal(assessment.canAutomaticallyDelete, false);
});
test('zero active connections alone is not proof of safe dismission', () => {
  const e = allVerified();
  e.backup.restoreTestPassed = false;
  e.dependencies.oldDbConnectionReferencesCleared = false;
  const r = assess(e);
  assert.equal(r.readyForHumanRetirementReview, false);
  assert.ok(r.blockers.includes('BACKUP_RESTORE_NOT_TESTED'));
  assert.ok(r.blockers.includes('POTENTIAL_LEGACY_DATABASE_CLIENTS'));
});
test('wrong resource or missing metric coverage always fails closed', () => {
  const e = allVerified();
  e.resourceId = 'dpg-other';
  e.metrics.coverageComplete = false;
  assert.equal(assess(e).readyForHumanRetirementReview, false);
  assert.ok(assess(e).blockers.includes('WRONG_RENDER_POSTGRES_RESOURCE'));
  assert.ok(assess(e).blockers.includes('CONNECTION_METRICS_INSUFFICIENT'));
});
test('full independent evidence only allows a separate human decision', () => {
  const r = assess(allVerified());
  assert.equal(r.readyForHumanRetirementReview, true);
  assert.equal(r.canAutomaticallyDelete, false);
  assert.deepEqual(r.blockers, []);
});
test('does not mutate supplied evidence and omits secrets or backup paths', () => {
  const e = allVerified();
  const before = JSON.stringify(e);
  const r = assess(e);
  assert.equal(JSON.stringify(e), before);
  assert.equal(JSON.stringify(r).includes('sha256'), false);
  assert.equal(JSON.stringify(r).includes('DATABASE_URL'), false);
});
