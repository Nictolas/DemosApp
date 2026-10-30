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
// Release inventory gate: schema metadata, no personal rows queried.
// Archived opinion columns MUST remain in the migration manifest.
// This differs from the visible/public catalog, which may hide archived IDs.
// Legacy tables can contain operational columns that are not political
// answers. These names are an explicit allowlist, NEVER a broad prefix rule.
// Unknown columns remain a hard failure instead of being silently dropped.
const SERVICE_COLUMNS=new Set([
  'user_id','fonti_opinioni','answers_extra','id','created_at','updated_at'
]);
const SERVICE_TYPES=Object.freeze({
  user_id: ['uuid'],
  fonti_opinioni: ['jsonb'],
  answers_extra: ['jsonb'],
  id: ['uuid','integer','bigint'],
  created_at: ['timestamp with time zone','timestamp without time zone'],
  updated_at: ['timestamp with time zone','timestamp without time zone']
});
function assertLegacyColumnCoverage(manifestIds, actualColumnNames) {
  const ids=validateLegacyIds(manifestIds);
  if(!Array.isArray(actualColumnNames)||actualColumnNames.length===0) {
    throw new TypeError('Legacy schema inventory is required');
  }
  const actual=new Set();
  for(const col of actualColumnNames){
    if(typeof col!=='string'||actual.has(col)){
      throw new TypeError('Invalid or duplicate legacy column');
    }
    actual.add(col);
  }
  if(!actual.has('user_id'))throw new Error('Missing legacy user_id key');
  const responses=[...actual].filter(col=>!SERVICE_COLUMNS.has(col));
  const missing=ids.filter(id=>!actual.has(id));
  const untracked=responses.filter(id=>!ids.includes(id));
  if(missing.length||untracked.length){
    throw new Error('Legacy schema and historical ID manifest do not match');
  }
  return {coveredIds:ids.length, serviceColumns:[...actual].filter(col=>SERVICE_COLUMNS.has(col))};
}

// Require both names and SQL types in the one-time metadata preflight.
function assertLegacySchemaInventory(manifestIds, columnMetadata) {
  if (!Array.isArray(columnMetadata) || !columnMetadata.length) {
    throw new TypeError('Schema column metadata required');
  }
  const names=columnMetadata.map(col=>{
    if (!col || typeof col.column_name!=='string' || typeof col.data_type!=='string') {
      throw new TypeError('Schema metadata must provide column_name and data_type');
    }
    return col.column_name;
  });
  const coverage=assertLegacyColumnCoverage(manifestIds,names);
  const ids=new Set(manifestIds);
  if(columnMetadata.some(col=>ids.has(col.column_name)&&col.data_type!=='text')) {
    throw new Error('Non-TEXT historical opinion column detected');
  }
  for(const {column_name,data_type} of columnMetadata){
    if(SERVICE_COLUMNS.has(column_name)&&!SERVICE_TYPES[column_name].includes(data_type)){
      throw new Error('Unexpected service column type: '+column_name);
    }
  }
  return coverage;
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

/**
 * A code-only rollback can lose or resurrect changed answers even when IDs
 * remain representable: compare the WHOLE old and new logical snapshots.
 * Caller must first take an authorized, consistent, consent-safe snapshot.
 * This does NOT authorize reading real user data outside a GDPR workflow.
 */
function rollbackParity(v2Document, legacyRow, legacyIds) {
  const ids=validateLegacyIds(legacyIds);
  const coverage=rollbackCoverage(v2Document,ids);
  const source=legacyRowToAnswers(legacyRow,ids);
  const divergentIds=ids.filter(id=>{
    const oldValue=Object.prototype.hasOwnProperty.call(source,id) ? source[id] : null;
    const newValue=Object.prototype.hasOwnProperty.call(v2Document,id) ? v2Document[id] : null;
    return oldValue!==newValue;
  });
  return {
    canRollbackWithoutLoss: coverage.canRollbackWithoutLoss && !divergentIds.length,
    unrepresentable:coverage.unrepresentable,
    divergentIds
  };
}

module.exports={validateLegacyIds,assertLegacyColumnCoverage,assertLegacySchemaInventory,legacyRowToAnswers,rollbackCoverage,rollbackParity};
