'use strict';

const {
  JURISDICTIONS,
  SOURCE_ADAPTERS,
  CIVIC_PROCESS_TYPES,
  LEGACY_PROCESS_ALIASES,
} = require('../config/civicProcesses');

const DENY_ALL_ACTIONS = Object.freeze({
  information: false,
  external_signature: false,
  demos_priority: false,
  position_on_question: false,
});

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeFreeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getJurisdiction(jurisdictionId) {
  return JURISDICTIONS[normalizeToken(jurisdictionId)] || null;
}

function getSourceAdapter(sourceId) {
  return SOURCE_ADAPTERS[sourceId] || null;
}

function getProcessType(processTypeId) {
  return CIVIC_PROCESS_TYPES[processTypeId] || null;
}

function getLegacyProcessType(alias) {
  const processTypeId = LEGACY_PROCESS_ALIASES[normalizeToken(alias)];
  return processTypeId ? getProcessType(processTypeId) : null;
}

function sourceBindingMatches(binding, rawType) {
  const matcher = binding?.matcher;
  if (!matcher) return false;

  const value = normalizeFreeText(rawType);
  if (!value) return false;

  const includeAll = matcher.includeAll || [];
  const includeAny = matcher.includeAny || [];
  const excludeAny = matcher.excludeAny || [];

  if (includeAll.some(token => !value.includes(normalizeFreeText(token)))) return false;
  if (includeAny.length > 0 && !includeAny.some(token => value.includes(normalizeFreeText(token)))) return false;
  if (excludeAny.some(token => value.includes(normalizeFreeText(token)))) return false;
  return includeAll.length > 0 || includeAny.length > 0;
}

function resolveProcessTypeFromSource({ jurisdictionId, sourceId, rawType }) {
  const jurisdiction = getJurisdiction(jurisdictionId);
  const source = getSourceAdapter(sourceId);
  if (!jurisdiction || !source || source.jurisdictionId !== jurisdiction.id) return null;

  for (const processType of Object.values(CIVIC_PROCESS_TYPES)) {
    if (processType.jurisdictionId !== jurisdiction.id) continue;
    const binding = processType.sourceBindings.find(candidate => candidate.sourceId === sourceId);
    if (binding && sourceBindingMatches(binding, rawType)) return processType;
  }

  return null;
}

function getSourceBinding(processTypeId, sourceId) {
  const processType = getProcessType(processTypeId);
  if (!processType) return null;
  return processType.sourceBindings.find(binding => binding.sourceId === sourceId) || null;
}

function getSignatureThreshold(processTypeId) {
  const processType = getProcessType(processTypeId);
  const threshold = processType?.rules?.signatureThreshold;
  return Number.isFinite(threshold) && threshold > 0 ? threshold : null;
}

function resolveStageFromSource({ processTypeId, sourceId, sourceState }) {
  const binding = getSourceBinding(processTypeId, sourceId);
  if (!binding?.stageMap) return null;
  return binding.stageMap[normalizeToken(sourceState)] || null;
}

function getStageRank(processTypeId, stageId) {
  const processType = getProcessType(processTypeId);
  const rank = processType?.stageOrder?.[stageId];
  return Number.isFinite(rank) ? rank : null;
}

function getDemosActionPolicy(processTypeId, stageId) {
  const processType = getProcessType(processTypeId);
  const policy = processType?.demosActionPolicies?.[stageId];
  return policy || DENY_ALL_ACTIONS;
}

function getLegacyQueryProfile(alias, sourceId = 'it.justice.signature_portal') {
  const processType = getLegacyProcessType(alias);
  if (!processType) return null;
  const binding = getSourceBinding(processType.id, sourceId);
  if (!binding) return null;

  return Object.freeze({
    jurisdictionId: processType.jurisdictionId,
    processTypeId: processType.id,
    family: processType.family,
    sourceId,
    signatureThreshold: getSignatureThreshold(processType.id),
    sqlLikePatterns: Object.freeze([...(binding.legacySqlLikePatterns || [])]),
  });
}

function describeSourceRecord({ jurisdictionId, sourceId, rawType, sourceState }) {
  const processType = resolveProcessTypeFromSource({ jurisdictionId, sourceId, rawType });
  if (!processType) {
    return Object.freeze({
      jurisdictionId: getJurisdiction(jurisdictionId)?.id || null,
      civicProcessTypeId: null,
      sourceId: getSourceAdapter(sourceId)?.id || null,
      stageId: null,
      signatureThreshold: null,
      demosActions: DENY_ALL_ACTIONS,
    });
  }

  const stageId = resolveStageFromSource({ processTypeId: processType.id, sourceId, sourceState });
  return Object.freeze({
    jurisdictionId: processType.jurisdictionId,
    civicProcessTypeId: processType.id,
    sourceId,
    stageId,
    signatureThreshold: getSignatureThreshold(processType.id),
    demosActions: getDemosActionPolicy(processType.id, stageId),
  });
}

function validateRegistry() {
  const errors = [];

  for (const jurisdiction of Object.values(JURISDICTIONS)) {
    if (jurisdiction.parentId && !JURISDICTIONS[jurisdiction.parentId]) {
      errors.push(`Jurisdiction ${jurisdiction.id} has unknown parent ${jurisdiction.parentId}`);
    }
  }

  for (const source of Object.values(SOURCE_ADAPTERS)) {
    if (!JURISDICTIONS[source.jurisdictionId]) {
      errors.push(`Source ${source.id} has unknown jurisdiction ${source.jurisdictionId}`);
    }
  }

  for (const processType of Object.values(CIVIC_PROCESS_TYPES)) {
    if (!JURISDICTIONS[processType.jurisdictionId]) {
      errors.push(`Process ${processType.id} has unknown jurisdiction ${processType.jurisdictionId}`);
    }
    for (const binding of processType.sourceBindings || []) {
      const source = SOURCE_ADAPTERS[binding.sourceId];
      if (!source) errors.push(`Process ${processType.id} has unknown source ${binding.sourceId}`);
      else if (source.jurisdictionId !== processType.jurisdictionId) {
        errors.push(`Process ${processType.id} source ${binding.sourceId} belongs to another jurisdiction`);
      }
    }
  }

  for (const [alias, processTypeId] of Object.entries(LEGACY_PROCESS_ALIASES)) {
    if (!CIVIC_PROCESS_TYPES[processTypeId]) errors.push(`Legacy alias ${alias} points to unknown process ${processTypeId}`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

module.exports = {
  DENY_ALL_ACTIONS,
  getJurisdiction,
  getSourceAdapter,
  getProcessType,
  getLegacyProcessType,
  resolveProcessTypeFromSource,
  getSourceBinding,
  getSignatureThreshold,
  resolveStageFromSource,
  getStageRank,
  getDemosActionPolicy,
  getLegacyQueryProfile,
  describeSourceRecord,
  validateRegistry,
};
