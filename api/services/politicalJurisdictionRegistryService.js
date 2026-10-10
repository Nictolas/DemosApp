'use strict';

const { JURISDICTIONS, validateJurisdictions } = require('../config/jurisdictions');
const {
  LEGACY_DEFAULT_ADAPTER_ID,
  TERRITORY_SCOPES,
  OPINION_SCOPES,
  POLITICAL_OFFICES,
  ELECTION_CONTESTS,
  ELECTION_TYPES,
  POLITICAL_ADAPTERS,
} = require('../config/politicalJurisdictions');

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function addAlias(index, value, item) {
  const key = normalizeKey(value);
  if (!key) return;
  const items = index.get(key) || [];
  if (!items.some((candidate) => candidate.id === item.id)) items.push(item);
  index.set(key, items);
}

function buildAliasIndex(items, aliasesFor) {
  const index = new Map();
  for (const item of Object.values(items)) {
    for (const alias of aliasesFor(item)) addAlias(index, alias, item);
  }
  return index;
}

const opinionScopeAliasIndex = buildAliasIndex(OPINION_SCOPES, (scope) => [scope.id, scope.label, ...scope.aliases]);
const officeAliasIndex = buildAliasIndex(POLITICAL_OFFICES, (office) => [office.id, office.podiumLevel, ...office.aliases].filter(Boolean));
const electionAliasIndex = buildAliasIndex(ELECTION_TYPES, (election) => [election.id, ...election.aliases]);

function resolveIndexed(index, value, context = {}) {
  const candidates = [...(index.get(normalizeKey(value)) || [])];
  if (!candidates.length) return null;

  const adapterId = context?.adapterId || null;
  const jurisdictionId = context?.jurisdictionId || null;
  let filtered = candidates;
  if (adapterId) filtered = filtered.filter((item) => item.adapterId === adapterId);
  if (jurisdictionId) filtered = filtered.filter((item) => item.jurisdictionId === jurisdictionId);
  if (filtered.length === 1) return filtered[0];
  if (filtered.length > 1) return null;

  if (adapterId || jurisdictionId) return null;
  if (candidates.length === 1) return candidates[0];
  const legacy = candidates.filter((item) => item.adapterId === LEGACY_DEFAULT_ADAPTER_ID);
  return legacy.length === 1 ? legacy[0] : null;
}

function getPoliticalAdapter(adapterId) {
  return POLITICAL_ADAPTERS[String(adapterId || '').trim().toLowerCase()] || null;
}

function resolveOpinionScope(value, context = {}) {
  return resolveIndexed(opinionScopeAliasIndex, value, context);
}

function normalizeOpinionScope(value, context = {}) {
  return resolveOpinionScope(value, context)?.id || null;
}

function getOpinionScopeLabel(value, context = {}) {
  return resolveOpinionScope(value, context)?.label || null;
}

function resolvePoliticalOffice(value, context = {}) {
  return resolveIndexed(officeAliasIndex, value, context);
}

function resolveElectionType(value, context = {}) {
  return resolveIndexed(electionAliasIndex, value, context);
}

function normalizeElectionType(value, context = {}) {
  const resolved = resolveElectionType(value, context);
  if (resolved) return resolved.id;
  const raw = String(value ?? '').trim();
  if (!raw) return 'UNKNOWN';
  return raw.replace(/[\s-]+/g, '_').toUpperCase();
}

function getElectionContest(contestId) {
  return ELECTION_CONTESTS[String(contestId || '').trim()] || null;
}

function getElectionContestIds(value, context = {}) {
  return [...(resolveElectionType(value, context)?.contestIds || [])];
}

function getElectionContestDescriptors(value, context = {}) {
  return getElectionContestIds(value, context)
    .map((contestId) => {
      const contest = getElectionContest(contestId);
      const office = contest ? POLITICAL_OFFICES[contest.officeId] : null;
      if (!contest || !office) return null;
      return Object.freeze({
        id: contest.id,
        adapterId: contest.adapterId,
        officeId: contest.officeId,
        officeLabel: office.label,
        residenceScope: contest.residenceScope,
        opinionGrade: office.opinionGrade || null,
      });
    })
    .filter(Boolean);
}

function getElectionResidenceScope(value, context = {}) {
  const election = resolveElectionType(value, context);
  if (!election) return TERRITORY_SCOPES.CUSTOM;
  if (election.residenceScope) return election.residenceScope;
  const scopes = [...new Set(getElectionContestDescriptors(value, context).map((contest) => contest.residenceScope).filter(Boolean))];
  return scopes.length === 1 ? scopes[0] : TERRITORY_SCOPES.CUSTOM;
}
function isMixedScopeElection(value, context = {}) {
  const scopes = [...new Set(getElectionContestDescriptors(value, context).map((contest) => contest.residenceScope).filter(Boolean))];
  return scopes.length > 1;
}

function getElectionOfficeIds(value, context = {}) {
  return [...new Set(getElectionContestDescriptors(value, context).map((contest) => contest.officeId))];
}

function getPoliticalOffice(value, context = {}) {
  const office = resolvePoliticalOffice(value, context);
  return office ? Object.freeze({ ...office }) : null;
}

function getOfficeAliases(value, context = {}) {
  const office = resolvePoliticalOffice(value, context);
  return office ? [...new Set([office.id, office.podiumLevel, ...office.aliases].filter(Boolean))] : [];
}

function getLegacySelectionField(kind, officeValue, context = { adapterId: LEGACY_DEFAULT_ADAPTER_ID }) {
  const office = resolvePoliticalOffice(officeValue, context);
  if (!office) return null;
  if (kind === 'representative') return office.legacyRepresentativeField || null;
  if (kind === 'candidate') return office.legacyCandidateField || null;
  return null;
}

function adapterOffices(adapterId = LEGACY_DEFAULT_ADAPTER_ID) {
  const adapter = getPoliticalAdapter(adapterId);
  return (adapter?.officeIds || []).map((id) => POLITICAL_OFFICES[id]).filter(Boolean);
}

function getLegacySelectionFields(kind = 'both', { adapterId = LEGACY_DEFAULT_ADAPTER_ID } = {}) {
  const fields = [];
  for (const office of adapterOffices(adapterId)) {
    if (kind === 'representative' || kind === 'both') fields.push(office.legacyRepresentativeField);
    if (kind === 'candidate' || kind === 'both') fields.push(office.legacyCandidateField);
  }
  return [...new Set(fields.filter(Boolean))];
}

function getLegacySelectionDescriptors(kind, { adapterId = LEGACY_DEFAULT_ADAPTER_ID } = {}) {
  return adapterOffices(adapterId).map((office) => Object.freeze({
    officeId: office.id,
    field: kind === 'representative' ? office.legacyRepresentativeField : office.legacyCandidateField,
    category: office.legacyCategory,
    testField: office.legacyTestField,
    opinionGrade: office.opinionGrade,
    podiumLevel: office.podiumLevel,
    residenceScope: office.residenceScope,
    primaryAlias: office.aliases[0],
  })).filter((item) => Boolean(item.field));
}

function getSelectionFieldContract(field) {
  const raw = String(field || '').trim();
  for (const office of Object.values(POLITICAL_OFFICES)) {
    if (office.legacyRepresentativeField === raw) return Object.freeze({ kind: 'representative', field: raw, office });
    if (office.legacyCandidateField === raw) return Object.freeze({ kind: 'candidate', field: raw, office });
  }
  return null;
}

function getLegacySelectionFieldsForElectionType(kind, electionType, context = { adapterId: LEGACY_DEFAULT_ADAPTER_ID }) {
  return getElectionOfficeIds(electionType, context)
    .map((officeId) => getLegacySelectionField(kind, officeId, context))
    .filter(Boolean);
}

function getOpinionGradeForOffice(value, context = {}) {
  return resolvePoliticalOffice(value, context)?.opinionGrade || null;
}

function getPodiumLevels({ adapterId = LEGACY_DEFAULT_ADAPTER_ID } = {}) {
  return [...new Set(adapterOffices(adapterId).map((office) => office.podiumLevel).filter(Boolean))];
}

function getPodiumLevelByScope(scope, { adapterId = LEGACY_DEFAULT_ADAPTER_ID } = {}) {
  return adapterOffices(adapterId).find((office) => office.residenceScope === scope && office.podiumLevel)?.podiumLevel || null;
}

function sqlNormalizedExpression(expression) {
  return `regexp_replace(UPPER(COALESCE(${expression}, '')), '[^A-Z0-9]', '', 'g')`;
}

function buildOfficePodiumCaseSql(expression, { adapterId = LEGACY_DEFAULT_ADAPTER_ID } = {}) {
  const clauses = adapterOffices(adapterId).filter((office) => office.podiumLevel).map((office) => {
    const aliases = [...new Set([office.id, office.podiumLevel, ...office.aliases])]
      .map(normalizeKey)
      .filter(Boolean)
      .map((value) => `'${value.replace(/'/g, "''")}'`)
      .join(',');
    return `WHEN ${sqlNormalizedExpression(expression)} IN (${aliases}) THEN '${office.podiumLevel}'`;
  });
  return `CASE\n  ${clauses.join('\n  ')}\n  ELSE NULL\nEND`;
}

function validatePoliticalRegistry() {
  const errors = [...validateJurisdictions().errors];
  const fields = new Set();

  for (const adapter of Object.values(POLITICAL_ADAPTERS)) {
    if (!JURISDICTIONS[adapter.jurisdictionId]) errors.push(`ADAPTER_JURISDICTION_UNKNOWN:${adapter.id}:${adapter.jurisdictionId}`);
  }

  for (const scope of Object.values(OPINION_SCOPES)) {
    if (!POLITICAL_ADAPTERS[scope.adapterId]) errors.push(`OPINION_ADAPTER_UNKNOWN:${scope.id}:${scope.adapterId}`);
    if (!JURISDICTIONS[scope.jurisdictionId]) errors.push(`OPINION_JURISDICTION_UNKNOWN:${scope.id}:${scope.jurisdictionId}`);
  }

  for (const office of Object.values(POLITICAL_OFFICES)) {
    if (!office.id || !office.adapterId || !office.residenceScope) errors.push(`OFFICE_INCOMPLETE:${office.id || 'unknown'}`);
    if (!POLITICAL_ADAPTERS[office.adapterId]) errors.push(`OFFICE_ADAPTER_UNKNOWN:${office.id}:${office.adapterId}`);
    if (!JURISDICTIONS[office.jurisdictionId]) errors.push(`OFFICE_JURISDICTION_UNKNOWN:${office.id}:${office.jurisdictionId}`);
    if (office.opinionGrade && !resolveOpinionScope(office.opinionGrade, { adapterId: office.adapterId })) {
      errors.push(`OFFICE_OPINION_SCOPE_UNKNOWN:${office.id}:${office.opinionGrade}`);
    }
    for (const field of [office.legacyRepresentativeField, office.legacyCandidateField]) {
      if (!field) continue;
      if (fields.has(field)) errors.push(`DUPLICATE_SELECTION_FIELD:${field}`);
      fields.add(field);
    }
  }

  for (const contest of Object.values(ELECTION_CONTESTS)) {
    const office = POLITICAL_OFFICES[contest.officeId];
    if (!POLITICAL_ADAPTERS[contest.adapterId]) errors.push(`CONTEST_ADAPTER_UNKNOWN:${contest.id}:${contest.adapterId}`);
    if (!office) errors.push(`CONTEST_OFFICE_UNKNOWN:${contest.id}:${contest.officeId}`);
    else if (office.adapterId !== contest.adapterId) errors.push(`CONTEST_OFFICE_ADAPTER_MISMATCH:${contest.id}:${contest.officeId}`);
  }

  for (const election of Object.values(ELECTION_TYPES)) {
    if (!POLITICAL_ADAPTERS[election.adapterId]) errors.push(`ELECTION_ADAPTER_UNKNOWN:${election.id}:${election.adapterId}`);
    for (const contestId of election.contestIds) {
      const contest = ELECTION_CONTESTS[contestId];
      if (!contest) errors.push(`UNKNOWN_ELECTION_CONTEST:${election.id}:${contestId}`);
      else if (contest.adapterId !== election.adapterId) errors.push(`ELECTION_CONTEST_ADAPTER_MISMATCH:${election.id}:${contestId}`);
    }
  }

  for (const adapter of Object.values(POLITICAL_ADAPTERS)) {
    for (const officeId of adapter.officeIds) if (!POLITICAL_OFFICES[officeId]) errors.push(`UNKNOWN_ADAPTER_OFFICE:${adapter.id}:${officeId}`);
    for (const contestId of adapter.contestIds) if (!ELECTION_CONTESTS[contestId]) errors.push(`UNKNOWN_ADAPTER_CONTEST:${adapter.id}:${contestId}`);
    for (const electionTypeId of adapter.electionTypeIds) if (!ELECTION_TYPES[electionTypeId]) errors.push(`UNKNOWN_ADAPTER_ELECTION:${adapter.id}:${electionTypeId}`);
    for (const scopeId of adapter.opinionScopeIds) if (!OPINION_SCOPES[scopeId]) errors.push(`UNKNOWN_ADAPTER_OPINION_SCOPE:${adapter.id}:${scopeId}`);
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

module.exports = {
  JURISDICTIONS,
  TERRITORY_SCOPES,
  normalizeKey,
  getPoliticalAdapter,
  resolveOpinionScope,
  normalizeOpinionScope,
  getOpinionScopeLabel,
  resolvePoliticalOffice,
  resolveElectionType,
  normalizeElectionType,
  getElectionContest,
  getElectionContestIds,
  getElectionContestDescriptors,
  getElectionResidenceScope,
  isMixedScopeElection,
  getElectionOfficeIds,
  getPoliticalOffice,
  getOfficeAliases,
  getLegacySelectionField,
  getLegacySelectionFields,
  getLegacySelectionDescriptors,
  getSelectionFieldContract,
  getLegacySelectionFieldsForElectionType,
  getOpinionGradeForOffice,
  getPodiumLevels,
  getPodiumLevelByScope,
  buildOfficePodiumCaseSql,
  validatePoliticalRegistry,
};
