'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {EXPECTED_PG_ID, EXPECTED_LEGACY_SERVICE_IDS,
  evaluateLegacyRenderPgRetirement: assess} =
  require('../scripts/evaluateLegacyRenderPgRetirement');

function allVerified() {
  return {
    resourceId: EXPECTED_PG_ID,
    backup: {existsVerified: true, sha256: 'a'.repeat(64), restoreTestPassed: true},
    dependencies: {allNineServicesAudited: true,
      auditedServiceIds: [...EXPECTED_LEGACY_SERVICE_IDS],
      oldDbConnectionReferencesCleared: true, productionTargetsExcluded: true},
    metrics: {windowHours: 36, coverageComplete: true,
      unattributedNonzeroSamples: 0, sourceAttributionVerified: true},
    authenticationLogs: {windowHours: 36, coverageComplete: true,
      unattributedAuthorizedSessions: 0, sourceAttributionVerified: true},
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

test('invalid metric window and sample types fail closed even with other approvals', () => {
  for (const invalid of [Infinity, NaN, '36', null]) {
    const e = allVerified();
    e.metrics.windowHours = invalid;
    assert.ok(assess(e).blockers.includes('CONNECTION_METRICS_INSUFFICIENT'));
  }
  for (const invalid of ['0', null, NaN, Infinity, -1, 0.5]) {
    const e = allVerified();
    e.metrics.unattributedNonzeroSamples = invalid;
    assert.ok(assess(e).blockers.includes('NONZERO_CONNECTIONS_NOT_ATTRIBUTED'));
    assert.equal(assess(e).readyForHumanRetirementReview, false);
  }
});

test('missing or malformed evidence never throws and always blocks retirement', () => {
  for (const invalid of [null, undefined, false, 0, 'verified', [], NaN]) {
    assert.doesNotThrow(() => assess(invalid));
    const decision = assess(invalid);
    assert.equal(decision.readyForHumanRetirementReview, false);
    assert.equal(decision.canAutomaticallyDelete, false);
    assert.ok(decision.blockers.includes('WRONG_RENDER_POSTGRES_RESOURCE'));
    assert.ok(decision.blockers.includes('BACKUP_NOT_VERIFIED'));
  }
});

test('retirement needs exact service ID coverage, not only a blanket 9/9 checkbox', () => {
  const full = allVerified();
  assert.equal(EXPECTED_LEGACY_SERVICE_IDS.length, 9);
  assert.equal(new Set(EXPECTED_LEGACY_SERVICE_IDS).size, 9);
  for (const ids of [
    undefined,
    [],
    EXPECTED_LEGACY_SERVICE_IDS.slice(0, 8),
    [...EXPECTED_LEGACY_SERVICE_IDS.slice(0, 8), EXPECTED_LEGACY_SERVICE_IDS[0]],
    [...EXPECTED_LEGACY_SERVICE_IDS.slice(0, 8), 'srv-unknown'],
    'all nine checked',
  ]) {
    const evidence = allVerified();
    evidence.dependencies.auditedServiceIds = ids;
    const result = assess(evidence);
    assert.equal(result.readyForHumanRetirementReview, false);
    assert.equal(result.canAutomaticallyDelete, false);
    assert.ok(result.blockers.includes('LEGACY_SERVICE_DEPENDENCIES_UNVERIFIED'));
  }
  // Array order does not matter; IDs must be unique and from the verified inventory.
  full.dependencies.auditedServiceIds.reverse();
  assert.equal(assess(full).readyForHumanRetirementReview, true);
  assert.equal(assess(full).canAutomaticallyDelete, false);
});

test('authenticated sessions block retirement even when sampled active connections are zero', () => {
  // Read-only Render evidence on 03 Nov: 24 authorized sessions while
  // 43 one-minute active_connections observations were all zero.
  const evidence = allVerified();
  evidence.metrics.unattributedNonzeroSamples = 0;
  evidence.authenticationLogs.unattributedAuthorizedSessions = 24;
  const decision = assess(evidence);
  assert.equal(decision.readyForHumanRetirementReview, false);
  assert.equal(decision.canAutomaticallyDelete, false);
  assert.ok(decision.blockers.includes('AUTHENTICATED_SESSIONS_NOT_ATTRIBUTED'));
});

test('authentication log coverage, attribution and types must be proven independently', () => {
  const cases = [
    [undefined, 'AUTHENTICATION_LOG_COVERAGE_INSUFFICIENT'],
    [{windowHours: 1, coverageComplete: true, unattributedAuthorizedSessions: 0,
      sourceAttributionVerified: true}, 'AUTHENTICATION_LOG_COVERAGE_INSUFFICIENT'],
    [{windowHours: 36, coverageComplete: false, unattributedAuthorizedSessions: 0,
      sourceAttributionVerified: true}, 'AUTHENTICATION_LOG_COVERAGE_INSUFFICIENT'],
    [{windowHours: 36, coverageComplete: true, unattributedAuthorizedSessions: '0',
      sourceAttributionVerified: true}, 'AUTHENTICATED_SESSIONS_NOT_ATTRIBUTED'],
    [{windowHours: 36, coverageComplete: true, unattributedAuthorizedSessions: -1,
      sourceAttributionVerified: true}, 'AUTHENTICATED_SESSIONS_NOT_ATTRIBUTED'],
    [{windowHours: 36, coverageComplete: true, unattributedAuthorizedSessions: 0,
      sourceAttributionVerified: false}, 'AUTHENTICATED_SESSIONS_NOT_ATTRIBUTED'],
  ];
  for (const [logs, expected] of cases) {
    const evidence = allVerified();
    evidence.authenticationLogs = logs;
    const decision = assess(evidence);
    assert.equal(decision.readyForHumanRetirementReview, false);
    assert.equal(decision.canAutomaticallyDelete, false);
    assert.ok(decision.blockers.includes(expected));
  }
});
