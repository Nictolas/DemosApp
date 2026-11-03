'use strict';

// OPS-STG-001 — NO network, credentials, environment variables or side effects.
// This contract never deletes infrastructure. It only identifies whether all
// independent evidence is present for a separate human GO decision.
const EXPECTED_PG_ID = 'dpg-db4id8id0e5s73cfb0cg-a';
const EXPECTED_LEGACY_SERVICE_IDS = Object.freeze([
  "srv-dbkcblss728c73conl60",
  "srv-dbeeca5g1s2s73fb7pd0",
  "srv-dbct3vmq1p3s73d7rhg0",
  "srv-dbckvbivcj2c73f0i7e0",
  "srv-db8i4d689jmc73drmhp0",
  "srv-db8hdg8u01pc7387rbc0",
  "srv-db8h8ubncjis73b26hu0",
  "srv-db8h4uo473hc73eums60",
  "srv-db2ho5jncjis73ep4ot0"
]);

function hasExactLegacyServiceCoverage(ids) {
  if (!Array.isArray(ids) || ids.length !== EXPECTED_LEGACY_SERVICE_IDS.length ||
      ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
    return false;
  }
  return EXPECTED_LEGACY_SERVICE_IDS.every((id) => ids.includes(id));
}

function evaluateLegacyRenderPgRetirement(evidence = {}) {
  // Malformed or absent evidence must produce a NO-GO decision, not crash an audit.
  if (evidence === null || typeof evidence !== 'object' || Array.isArray(evidence)) {
    evidence = {};
  }
  const blockers = [];
  const reject = (condition, code) => { if (!condition) blockers.push(code); };
  reject(evidence.resourceId === EXPECTED_PG_ID, 'WRONG_RENDER_POSTGRES_RESOURCE');
  reject(evidence.backup?.existsVerified === true, 'BACKUP_NOT_VERIFIED');
  reject(typeof evidence.backup?.sha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(evidence.backup.sha256), 'BACKUP_CHECKSUM_NOT_VERIFIED');
  reject(evidence.backup?.restoreTestPassed === true, 'BACKUP_RESTORE_NOT_TESTED');
  reject(evidence.dependencies?.allNineServicesAudited === true &&
    hasExactLegacyServiceCoverage(evidence.dependencies?.auditedServiceIds),
    'LEGACY_SERVICE_DEPENDENCIES_UNVERIFIED');
  reject(evidence.dependencies?.oldDbConnectionReferencesCleared === true,
    'POTENTIAL_LEGACY_DATABASE_CLIENTS');
  reject(evidence.dependencies?.productionTargetsExcluded === true,
    'PRODUCTION_ISOLATION_NOT_VERIFIED');
  reject(Number.isFinite(evidence.metrics?.windowHours) &&
    evidence.metrics.windowHours >= 24 && evidence.metrics.coverageComplete === true,
    'CONNECTION_METRICS_INSUFFICIENT');
  reject(Number.isSafeInteger(evidence.metrics?.unattributedNonzeroSamples) &&
    evidence.metrics.unattributedNonzeroSamples === 0,
    'NONZERO_CONNECTIONS_NOT_ATTRIBUTED');
  // Repeated 3-second sessions from a private IP can be probe-like, but the
  // appearance of monitoring traffic is not independent client attribution.
  reject(evidence.metrics?.sourceAttributionVerified === true,
    'CONNECTION_SOURCE_NOT_INDEPENDENTLY_VERIFIED');
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

module.exports = {
  EXPECTED_PG_ID,
  EXPECTED_LEGACY_SERVICE_IDS,
  evaluateLegacyRenderPgRetirement,
};
