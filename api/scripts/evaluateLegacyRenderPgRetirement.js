'use strict';

// OPS-STG-001 — NO network, credentials, environment variables or side effects.
// This contract never deletes infrastructure. It only identifies whether all
// independent evidence is present for a separate human GO decision.
const EXPECTED_PG_ID = 'dpg-db4id8id0e5s73cfb0cg-a';

function evaluateLegacyRenderPgRetirement(evidence = {}) {
  const blockers = [];
  const reject = (condition, code) => { if (!condition) blockers.push(code); };
  reject(evidence.resourceId === EXPECTED_PG_ID, 'WRONG_RENDER_POSTGRES_RESOURCE');
  reject(evidence.backup?.existsVerified === true, 'BACKUP_NOT_VERIFIED');
  reject(typeof evidence.backup?.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(evidence.backup.sha256), 'BACKUP_CHECKSUM_NOT_VERIFIED');
  reject(evidence.backup?.restoreTestPassed === true, 'BACKUP_RESTORE_NOT_TESTED');
  reject(evidence.dependencies?.allNineServicesAudited === true,
    'LEGACY_SERVICE_DEPENDENCIES_UNVERIFIED');
  reject(evidence.dependencies?.oldDbConnectionReferencesCleared === true,
    'POTENTIAL_LEGACY_DATABASE_CLIENTS');
  reject(evidence.dependencies?.productionTargetsExcluded === true,
    'PRODUCTION_ISOLATION_NOT_VERIFIED');
  reject(evidence.metrics?.windowHours >= 24 && evidence.metrics?.coverageComplete === true,
    'CONNECTION_METRICS_INSUFFICIENT');
  reject(evidence.metrics?.unattributedNonzeroSamples === 0,
    'NONZERO_CONNECTIONS_NOT_ATTRIBUTED');
  reject(evidence.staging?.functionalE2EGo === true,
    'UNIFIED_STAGING_NOT_FUNCTIONALLY_READY');
  reject(evidence.staging?.rollbackVerified === true,
    'ROLLBACK_NOT_VERIFIED');
  reject(evidence.approval?.authorizedHumanReview === true,
    'EXPLICIT_OPERATOR_REVIEW_PENDING');

  return Object.freeze({
    resourceId: EXPECTED_PG_ID,
    // Even all-verified evidence only permits human review; no delete action.
    readyForHumanRetirementReview: blockers.length === 0,
    canAutomaticallyDelete: false,
    blockers: Object.freeze(blockers),
  });
}

module.exports = { EXPECTED_PG_ID, evaluateLegacyRenderPgRetirement };
