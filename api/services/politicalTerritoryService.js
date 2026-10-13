'use strict';

const { TERRITORY_SCOPES } = require('./politicalJurisdictionRegistryService');

const TERRITORY_PRIORITY = Object.freeze({
  [TERRITORY_SCOPES.ELECTORAL_DISTRICT]: 1,
  [TERRITORY_SCOPES.MUNICIPALITY]: 2,
  [TERRITORY_SCOPES.ADMIN_LEVEL_2]: 3,
  [TERRITORY_SCOPES.PROVINCE]: 3,
  [TERRITORY_SCOPES.ADMIN_LEVEL_1]: 4,
  [TERRITORY_SCOPES.REGION]: 4,
  [TERRITORY_SCOPES.COUNTRY]: 5,
  [TERRITORY_SCOPES.SUPRANATIONAL]: 6,
});

function normalizeTerritoryCode(value) {
  return value == null ? null : String(value).trim().toLocaleLowerCase('en-US');
}

function uniqueNormalized(values) {
  return [...new Set((values || []).map(normalizeTerritoryCode).filter(Boolean))];
}

function createTerritoryContext({
  country = [],
  admin1 = [],
  admin2 = [],
  municipality = [],
  electoralDistrict = [],
  region = [],
  province = [],
} = {}) {
  const regionAliases = uniqueNormalized([...admin1, ...region]);
  const provinceAliases = uniqueNormalized([...admin2, ...province]);
  return Object.freeze({
    [TERRITORY_SCOPES.COUNTRY]: uniqueNormalized(country),
    [TERRITORY_SCOPES.SUPRANATIONAL]: uniqueNormalized(country),
    [TERRITORY_SCOPES.ADMIN_LEVEL_1]: regionAliases,
    [TERRITORY_SCOPES.REGION]: regionAliases,
    [TERRITORY_SCOPES.ADMIN_LEVEL_2]: provinceAliases,
    [TERRITORY_SCOPES.PROVINCE]: provinceAliases,
    [TERRITORY_SCOPES.MUNICIPALITY]: uniqueNormalized(municipality),
    [TERRITORY_SCOPES.ELECTORAL_DISTRICT]: uniqueNormalized(electoralDistrict),
  });
}

function territoryValueFromJurisdiction(jurisdiction, scope) {
  const j = jurisdiction || {};
  const values = {
    [TERRITORY_SCOPES.COUNTRY]: [j.country, j.countryCode, j.paese],
    [TERRITORY_SCOPES.SUPRANATIONAL]: [j.supranational, j.union, j.country, j.countryCode, j.paese],
    [TERRITORY_SCOPES.ADMIN_LEVEL_1]: [j.admin1, j.state, j.region, j.regione],
    [TERRITORY_SCOPES.REGION]: [j.region, j.regione, j.admin1, j.state],
    [TERRITORY_SCOPES.ADMIN_LEVEL_2]: [j.admin2, j.county, j.province, j.provincia],
    [TERRITORY_SCOPES.PROVINCE]: [j.province, j.provincia, j.admin2, j.county],
    [TERRITORY_SCOPES.MUNICIPALITY]: [j.municipality, j.city, j.comune],
    [TERRITORY_SCOPES.ELECTORAL_DISTRICT]: [j.electoralDistrict, j.electoral_district, j.district, j.districtCode],
  };
  return uniqueNormalized(values[scope] || [j.territoryCode, j.territory_code]);
}

function territoryMatchesScope(context, scope, requiredValues, { allowUnspecified = false } = {}) {
  const required = uniqueNormalized(Array.isArray(requiredValues) ? requiredValues : [requiredValues]);
  if (!required.length) return allowUnspecified;
  const owned = context?.[scope] || [];
  return required.some((value) => owned.includes(value));
}

function jurisdictionMatchesScope(jurisdiction, scope, context, { allowUnspecified = false } = {}) {
  const required = territoryValueFromJurisdiction(jurisdiction, scope);
  return territoryMatchesScope(context, scope, required, { allowUnspecified });
}

function mappingMatchesTerritory(mapping, context) {
  const scope = String(mapping?.territory_type || '').trim().toUpperCase();
  const code = normalizeTerritoryCode(mapping?.territory_code);
  return Boolean(TERRITORY_PRIORITY[scope] && code && context?.[scope]?.includes(code));
}

function chooseMostSpecificEligibleUnits(mappings, context) {
  const matching = (mappings || []).filter((row) => mappingMatchesTerritory(row, context));
  const bestPriorityByElection = new Map();

  for (const row of matching) {
    const eventId = String(row.election_event_id);
    const priority = TERRITORY_PRIORITY[String(row.territory_type).trim().toUpperCase()];
    const previous = bestPriorityByElection.get(eventId);
    if (previous == null || priority < previous) bestPriorityByElection.set(eventId, priority);
  }

  const eligible = new Set();
  for (const row of matching) {
    const eventId = String(row.election_event_id);
    const priority = TERRITORY_PRIORITY[String(row.territory_type).trim().toUpperCase()];
    if (priority === bestPriorityByElection.get(eventId)) {
      eligible.add(`${eventId}:${String(row.electoral_unit_id)}`);
    }
  }
  return eligible;
}

module.exports = {
  TERRITORY_PRIORITY,
  normalizeTerritoryCode,
  uniqueNormalized,
  createTerritoryContext,
  territoryValueFromJurisdiction,
  territoryMatchesScope,
  jurisdictionMatchesScope,
  mappingMatchesTerritory,
  chooseMostSpecificEligibleUnits,
};
