'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { POLITICAL_TERRITORY_RESOLVERS } = require('../config/politicalTerritoryResolvers');
const { compressRegione } = require('../utils/regioniUtils');
const {
  TERRITORY_SCOPES,
  normalizeKey,
  resolvePoliticalOffice,
  getElectionOfficeIds,
} = require('./politicalJurisdictionRegistryService');
const {
  replaceUserPoliticalTerritories,
  replaceUserElectoralUnitMemberships,
} = require('./politicalTerritoryMembershipService');

let istatCatalogCache = null;
let istatIndexCache = null;

function getTerritoryResolver(resolverId) {
  return POLITICAL_TERRITORY_RESOLVERS[String(resolverId || '').trim()] || null;
}

function listTerritoryResolvers(adapterId = null) {
  const all = Object.values(POLITICAL_TERRITORY_RESOLVERS);
  return adapterId ? all.filter((resolver) => resolver.adapterId === String(adapterId).trim().toLowerCase()) : all;
}

function validateResolverRegistry() {
  const errors = [];
  for (const resolver of Object.values(POLITICAL_TERRITORY_RESOLVERS)) {
    if (!resolver.id || !resolver.adapterId || !resolver.jurisdictionId || !resolver.kind) {
      errors.push(`RESOLVER_INCOMPLETE:${resolver.id || 'unknown'}`);
    }
    if (!Array.isArray(resolver.territoryScopes) || resolver.territoryScopes.length === 0) {
      errors.push(`RESOLVER_SCOPES_EMPTY:${resolver.id}`);
    }
    if (!['SELF_DECLARED', 'VERIFIED', 'OFFICIAL'].includes(resolver.membershipVerificationLevel)) {
      errors.push(`RESOLVER_VERIFICATION_INVALID:${resolver.id}`);
    }
    if (resolver.kind === 'ELECTORAL_UNIT' && resolver.eventScoped !== true) {
      errors.push(`ELECTORAL_RESOLVER_NOT_EVENT_SCOPED:${resolver.id}`);
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

function officialDataPath(relativePath) {
  return path.resolve(__dirname, '..', relativePath);
}

function loadIstatCatalog() {
  if (istatCatalogCache) return istatCatalogCache;
  const resolver = getTerritoryResolver('it.istat.situas');
  const payload = JSON.parse(fs.readFileSync(officialDataPath(resolver.snapshotPath), 'utf8'));
  if (payload.sourceId !== resolver.id || !Array.isArray(payload.municipalities)) {
    const error = new Error('Invalid Istat territory snapshot');
    error.code = 'TERRITORY_SNAPSHOT_INVALID';
    throw error;
  }
  if (Number(payload.count) !== payload.municipalities.length) {
    const error = new Error('Istat territory snapshot count mismatch');
    error.code = 'TERRITORY_SNAPSHOT_COUNT_MISMATCH';
    throw error;
  }
  istatCatalogCache = Object.freeze(payload);
  return istatCatalogCache;
}

function addIndex(map, value, row) {
  const key = normalizeKey(value);
  if (!key) return;
  const rows = map.get(key) || [];
  rows.push(row);
  map.set(key, rows);
}

function buildIstatIndex() {
  if (istatIndexCache) return istatIndexCache;
  const catalog = loadIstatCatalog();
  const byMunicipalityCode = new Map();
  const byCadastralCode = new Map();
  const byMunicipalityName = new Map();
  for (const row of catalog.municipalities) {
    addIndex(byMunicipalityCode, row.municipalityCode, row);
    addIndex(byCadastralCode, row.cadastralCode, row);
    addIndex(byMunicipalityName, row.municipalityName, row);
  }
  istatIndexCache = Object.freeze({ byMunicipalityCode, byCadastralCode, byMunicipalityName });
  return istatIndexCache;
}

function valueFrom(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return null;
}
function buildProfileFingerprint(profile = {}) {
  const normalized = [
    valueFrom(profile, ['paese_residenza', 'country', 'countryCode', 'paese']),
    valueFrom(profile, ['regione_residenza', 'region', 'regionCode', 'regione']),
    valueFrom(profile, ['provincia_residenza', 'province', 'provinceCode', 'admin2', 'provincia']),
    valueFrom(profile, ['municipalityCode', 'codice_comune', 'codiceComune', 'cadastralCode', 'codice_catastale', 'comune_residenza', 'municipality', 'city', 'comune']),
  ].map((value) => normalizeKey(value)).join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function countryIsItaly(value) {
  if (!value) return true;
  return ['IT', 'ITA', 'ITALIA', 'ITALY'].includes(normalizeKey(value));
}

function rowRegionAliases(row) {
  return [row.regionCode, row.regionName, compressRegione(row.regionName)].map(normalizeKey).filter(Boolean);
}

function rowAdmin2Aliases(row) {
  return [row.admin2Code, row.admin2HistoricCode, row.admin2Name, row.vehicleCode].map(normalizeKey).filter(Boolean);
}

function filterByOptionalAlias(rows, value, aliasesForRow) {
  const key = normalizeKey(value);
  if (!key) return rows;
  return rows.filter((row) => aliasesForRow(row).includes(key));
}

function resolveItalianAdministrativeRecord(profile = {}) {
  const country = valueFrom(profile, ['paese_residenza', 'country', 'countryCode', 'paese']);
  if (!countryIsItaly(country)) {
    return Object.freeze({ resolved: false, reason: 'COUNTRY_NOT_ITALY', candidates: 0 });
  }

  const municipality = valueFrom(profile, [
    'municipalityCode', 'codice_comune', 'codiceComune', 'cadastralCode', 'codice_catastale',
    'comune_residenza', 'municipality', 'city', 'comune',
  ]);
  if (!municipality) return Object.freeze({ resolved: false, reason: 'MUNICIPALITY_REQUIRED', candidates: 0 });

  const indexes = buildIstatIndex();
  const municipalityKey = normalizeKey(municipality);
  let candidates = indexes.byMunicipalityCode.get(municipalityKey)
    || indexes.byCadastralCode.get(municipalityKey)
    || indexes.byMunicipalityName.get(municipalityKey)
    || [];

  const region = valueFrom(profile, ['regione_residenza', 'region', 'regionCode', 'regione']);
  const admin2 = valueFrom(profile, ['provincia_residenza', 'province', 'provinceCode', 'admin2', 'provincia']);
  candidates = filterByOptionalAlias(candidates, region, rowRegionAliases);
  candidates = filterByOptionalAlias(candidates, admin2, rowAdmin2Aliases);

  if (candidates.length === 0) return Object.freeze({ resolved: false, reason: 'NO_OFFICIAL_MATCH', candidates: 0 });
  if (candidates.length > 1) return Object.freeze({ resolved: false, reason: 'AMBIGUOUS_OFFICIAL_MATCH', candidates: candidates.length });

  const row = candidates[0];
  return Object.freeze({
    resolved: true,
    reason: null,
    candidates: 1,
    record: Object.freeze({ ...row }),
    resolverId: 'it.istat.situas',
    referenceDate: loadIstatCatalog().referenceDate,
  });
}

function buildItalianAdministrativeMemberships(resolution) {
  if (!resolution?.resolved || !resolution.record) return [];
  const row = resolution.record;
  const shared = { resolverId: resolution.resolverId, referenceDate: resolution.referenceDate };
  return [
    { territoryType: TERRITORY_SCOPES.COUNTRY, territoryCode: 'IT', context: { ...shared, label: 'Italia' } },
    { territoryType: TERRITORY_SCOPES.ADMIN_LEVEL_1, territoryCode: row.regionCode, context: { ...shared, label: row.regionName } },
    { territoryType: TERRITORY_SCOPES.ADMIN_LEVEL_2, territoryCode: row.admin2Code, context: { ...shared, label: row.admin2Name, historicCode: row.admin2HistoricCode, vehicleCode: row.vehicleCode } },
    { territoryType: TERRITORY_SCOPES.MUNICIPALITY, territoryCode: row.municipalityCode, context: { ...shared, label: row.municipalityName, cadastralCode: row.cadastralCode } },
  ];
}

async function persistItalianAdministrativeResolution(db, { userId, profile, officeId = null } = {}) {
  const resolver = getTerritoryResolver('it.istat.situas');
  const office = officeId ? resolvePoliticalOffice(officeId) : null;
  if (officeId && (!office || office.adapterId !== resolver.adapterId)) {
    const error = new Error('Political office does not belong to resolver adapter');
    error.code = 'TERRITORY_RESOLVER_OFFICE_MISMATCH';
    throw error;
  }
  const resolution = resolveItalianAdministrativeRecord(profile);
  if (!resolution.resolved) return { ...resolution, written: 0 };
  const profileFingerprint = buildProfileFingerprint(profile);
  const memberships = buildItalianAdministrativeMemberships(resolution).map((membership) => ({
    ...membership,
    context: { ...membership.context, profileFingerprint },
  }));
  const write = await replaceUserPoliticalTerritories(db, {
    userId,
    jurisdictionId: resolver.jurisdictionId,
    officeId,
    source: resolver.id,
    verificationLevel: resolver.membershipVerificationLevel,
    memberships,
  });
  return { ...resolution, written: write.written, verificationLevel: write.verificationLevel, memberships };
}

async function assertElectionResolutionContract(db, { resolver, electionEventId, officeId, electoralUnitIds }) {
  const office = resolvePoliticalOffice(officeId);
  if (!office || office.adapterId !== resolver.adapterId) {
    const error = new Error('Political office does not belong to resolver adapter');
    error.code = 'TERRITORY_RESOLVER_OFFICE_MISMATCH';
    throw error;
  }

  const eventResult = await db.query(
    `SELECT id, tipologia_evento, tipo_elezione FROM eventi WHERE id = $1`,
    [electionEventId],
  );
  const event = eventResult.rows[0];
  if (!event || String(event.tipologia_evento || '').trim().toLowerCase() !== 'elezioni') {
    const error = new Error('Election event not found or invalid');
    error.code = 'TERRITORY_RESOLVER_EVENT_INVALID';
    throw error;
  }

  const allowedOffices = getElectionOfficeIds(event.tipo_elezione, { adapterId: resolver.adapterId });
  if (!allowedOffices.length || !allowedOffices.includes(office.id)) {
    const error = new Error('Political office is not part of the election event');
    error.code = 'TERRITORY_RESOLVER_EVENT_OFFICE_MISMATCH';
    throw error;
  }

  const ids = [...new Set((electoralUnitIds || []).map((value) => String(value || '').trim()).filter(Boolean))];
  if (ids.length) {
    const unitResult = await db.query(
      `SELECT id::text AS id FROM unita_elettorale WHERE evento_id = $1 AND id = ANY($2::uuid[])`,
      [electionEventId, ids],
    );
    const found = new Set(unitResult.rows.map((row) => String(row.id)));
    if (ids.some((id) => !found.has(id))) {
      const error = new Error('Electoral unit does not belong to the election event');
      error.code = 'TERRITORY_RESOLVER_UNIT_EVENT_MISMATCH';
      throw error;
    }
  }
  return { office, event, electoralUnitIds: ids };
}

async function persistOfficialElectoralUnitResolution(db, {
  resolverId = 'it.interno.eligendo', userId, electionEventId, officeId, electoralUnitIds = [], evidence = {},
} = {}) {
  const resolver = getTerritoryResolver(resolverId);
  if (!resolver || resolver.kind !== 'ELECTORAL_UNIT' || resolver.eventScoped !== true) {
    const error = new Error('Invalid electoral territory resolver');
    error.code = 'ELECTORAL_TERRITORY_RESOLVER_INVALID';
    throw error;
  }
  const contract = await assertElectionResolutionContract(db, { resolver, electionEventId, officeId, electoralUnitIds });
  const context = {
    resolverId: resolver.id,
    sourceUrl: resolver.sourceUrl,
    ...evidence,
  };
  const write = await replaceUserElectoralUnitMemberships(db, {
    userId,
    electionEventId,
    officeId: contract.office.id,
    electoralUnitIds: contract.electoralUnitIds,
    source: resolver.id,
    verificationLevel: resolver.membershipVerificationLevel,
    context,
  });
  return { resolverId: resolver.id, eventScoped: true, ...write, electoralUnitIds: contract.electoralUnitIds };
}

async function syncItalianPoliticalTerritoriesFromProfiles({ pool, batchSize = 500 } = {}) {
  if (!pool || typeof pool.query !== 'function') throw new Error('Database pool required');
  const schemaCheck = await pool.query(`SELECT to_regclass('public.user_political_territories') AS relation_name`);
  if (!schemaCheck.rows[0]?.relation_name) {
    return { available: false, scanned: 0, resolved: 0, unchanged: 0, unresolved: 0, errors: [] };
  }

  const safeBatchSize = Math.max(1, Math.min(5000, Number(batchSize) || 500));
  const summary = { available: true, scanned: 0, resolved: 0, unchanged: 0, unresolved: 0, errors: [] };
  let lastUserId = null;

  for (;;) {
    const result = await pool.query(
      `SELECT
         u.id::text AS id,
         u.paese_residenza,
         u.regione_residenza,
         u.provincia_residenza,
         u.comune_residenza,
         resolver.context AS resolver_context
       FROM users u
       LEFT JOIN LATERAL (
         SELECT upt.context
         FROM user_political_territories upt
         WHERE upt.user_id = u.id
           AND upt.source = 'it.istat.situas'
           AND upt.territory_type = 'MUNICIPALITY'
           AND upt.valid_to IS NULL
         ORDER BY upt.updated_at DESC
         LIMIT 1
       ) resolver ON TRUE
       WHERE NULLIF(BTRIM(u.comune_residenza), '') IS NOT NULL
         AND (
           NULLIF(BTRIM(u.paese_residenza), '') IS NULL
           OR regexp_replace(UPPER(u.paese_residenza), '[^A-Z0-9]', '', 'g') = ANY(ARRAY['IT','ITA','ITALIA','ITALY'])
         )
         AND ($2::text IS NULL OR u.id::text > $2::text)
       ORDER BY u.id::text
       LIMIT $1`,
      [safeBatchSize, lastUserId],
    );

    if (result.rows.length === 0) break;
    summary.scanned += result.rows.length;

    for (const row of result.rows) {
      const profile = {
        paese_residenza: row.paese_residenza,
        regione_residenza: row.regione_residenza,
        provincia_residenza: row.provincia_residenza,
        comune_residenza: row.comune_residenza,
      };
      const fingerprint = buildProfileFingerprint(profile);
      if (row.resolver_context?.profileFingerprint === fingerprint) {
        summary.unchanged += 1;
        continue;
      }
      try {
        const resolution = await persistItalianAdministrativeResolution(pool, { userId: row.id, profile });
        if (resolution.resolved) summary.resolved += 1;
        else summary.unresolved += 1;
      } catch (error) {
        summary.errors.push({ userId: row.id, code: error?.code || 'UNKNOWN' });
      }
    }

    lastUserId = result.rows[result.rows.length - 1].id;
    if (result.rows.length < safeBatchSize) break;
  }

  return summary;
}
module.exports = {
  getTerritoryResolver,
  listTerritoryResolvers,
  validateResolverRegistry,
  loadIstatCatalog,
  buildProfileFingerprint,
  resolveItalianAdministrativeRecord,
  buildItalianAdministrativeMemberships,
  persistItalianAdministrativeResolution,
  assertElectionResolutionContract,
  persistOfficialElectoralUnitResolution,
  syncItalianPoliticalTerritoriesFromProfiles,
};
