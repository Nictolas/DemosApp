'use strict';

/**
 * EXPERIMENT ONLY. Not imported by any route, not a production migration.
 * A candidate for verifying a legacy TEXT-to-v2 JSONB backfill.
 * SQL that reads/writes records must additionally lock public.users,
 * re-check political consent AFTER locking, check the external erasure
 * journal after restoring a snapshot, and avoid live dual writes.
 */
const ID_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
const VALID = new Set(['f','c','i']);
function validateLegacyIds(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 512) {
    throw new TypeError('Expected 1..512 immutable IDs from code manifest');
  }
  const unique = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || unique.has(id)) {
      throw new TypeError('Invalid or duplicate immutable opinion ID');
    }
    unique.add(id);
  }
  return ids.slice();
}
function legacyRowToAnswers(row, orderedIds) {
  const ids = validateLegacyIds(orderedIds);
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new TypeError('Expected legacy database row');
  }
  const answers = Object.create(null);
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(row,id)) {
      throw new Error('Missing legacy column from selected row');
    }
    const value = row[id];
    if (value === null) continue;
    if (!VALID.has(value)) {
      throw new TypeError('Unexpected legacy answer code');
    }
    answers[id] = value;
  }
  // In particular do not silently include fonti_opinioni or other fields.
  return answers;
}
function rollbackCoverage(v2Document, legacyIds) {
  const ids = new Set(validateLegacyIds(legacyIds));
  if (!v2Document || typeof v2Document !== 'object' || Array.isArray(v2Document)) {
    throw new TypeError('Expected v2 answer document');
  }
  const unrepresentable = [];
  for (const [id,value] of Object.entries(v2Document)) {
    if (!ID_PATTERN.test(id) || !VALID.has(value)) {
      throw new TypeError('Invalid v2 answer during rollback audit');
    }
    if (!ids.has(id)) unrepresentable.push(id);
  }
  unrepresentable.sort();
  return { canRollbackWithoutLoss: unrepresentable.length === 0, unrepresentable };
}
module.exports={validateLegacyIds,legacyRowToAnswers,rollbackCoverage};
