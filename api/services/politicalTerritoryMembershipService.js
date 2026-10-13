'use strict';

const { compressRegione, decompressRegione } = require('../utils/regioniUtils');
const { TERRITORY_SCOPES, resolvePoliticalOffice } = require('./politicalJurisdictionRegistryService');
const {
  createTerritoryContext,
  chooseMostSpecificEligibleUnits,
} = require('./politicalTerritoryService');

const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);
const VERIFICATION_PRIORITY = Object.freeze({ SELF_DECLARED: 1, VERIFIED: 2, OFFICIAL: 3 });

function isTerritoryMembershipSchemaError(error) {
  return SCHEMA_COMPAT_ERROR_CODES.has(error?.code);
}

function normalizeText(value) {
  return value == null ? null : String(value).trim().toLocaleLowerCase('en-US');
}

function regionAliases(value) {
  if (!value) return [];
  const decompressed = decompressRegione(value);
  const compressed = decompressed ? value : compressRegione(value);
  return [...new Set([value, compressed, decompressed].map(normalizeText).filter(Boolean))];
}

function verificationRank(value) {
  return VERIFICATION_PRIORITY[String(value || '').trim().toUpperCase()] || 0;
}

function keepHighestVerificationRows(rows = [], groupKey) {
  const maxByGroup = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    const rank = verificationRank(row.verification_level);
    if (!maxByGroup.has(key) || rank > maxByGroup.get(key)) maxByGroup.set(key, rank);
  }
  return rows.filter((row) => verificationRank(row.verification_level) === maxByGroup.get(groupKey(row)));
}

function resolveAuthoritativeTerritoryRows(rows = []) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.jurisdiction_id || ''}|${row.territory_type || ''}|${row.political_office_id || ''}`;
    const current = grouped.get(key) || [];
    current.push(row);
    grouped.set(key, current);
  }

  const resolved = [];
  const conflicts = [];
  for (const [key, groupRows] of grouped.entries()) {
    const maxRank = Math.max(...groupRows.map((row) => verificationRank(row.verification_level)));
    const topRows = groupRows.filter((row) => verificationRank(row.verification_level) === maxRank);
    const codes = [...new Set(topRows.map((row) => normalizeText(row.territory_code)).filter(Boolean))];
    if (codes.length > 1) {
      conflicts.push({
        key,
        jurisdictionId: topRows[0]?.jurisdiction_id || null,
        territoryType: topRows[0]?.territory_type || null,
        politicalOfficeId: topRows[0]?.political_office_id || null,
        verificationLevel: String(topRows[0]?.verification_level || '').toUpperCase() || null,
        territoryCodes: [...new Set(topRows.map((row) => String(row.territory_code)))].sort(),
        sources: [...new Set(topRows.map((row) => String(row.source || '')))].filter(Boolean).sort(),
      });
      continue;
    }
    if (topRows.length) {
      const chosen = [...topRows].sort((a, b) => String(a.source || '').localeCompare(String(b.source || '')))[0];
      resolved.push(chosen);
    }
  }
  return { rows: resolved, conflicts };
}

function territoryContextFromLegacyUser(user) {
  if (!user) return createTerritoryContext();
  return createTerritoryContext({
    country: [user.paese_residenza],
    admin1: regionAliases(user.regione_residenza),
    region: regionAliases(user.regione_residenza),
    admin2: [user.provincia_residenza],
    province: [user.provincia_residenza],
    municipality: [user.comune_residenza],
    electoralDistrict: Array.isArray(user.electoral_districts)
      ? user.electoral_districts
      : [user.electoral_district, user.distretto_elettorale],
  });
}

function territoryContextFromMemberships(rows = []) {
  const values = {
    country: [], admin1: [], admin2: [], municipality: [], electoralDistrict: [], region: [], province: [],
  };
  for (const row of rows) {
    const type = String(row.territory_type || '').trim().toUpperCase();
    const code = row.territory_code;
    if (!code) continue;
    if (type === TERRITORY_SCOPES.COUNTRY || type === TERRITORY_SCOPES.SUPRANATIONAL) values.country.push(code);
    if (type === TERRITORY_SCOPES.ADMIN_LEVEL_1 || type === TERRITORY_SCOPES.REGION) {
      values.admin1.push(code); values.region.push(code);
    }
    if (type === TERRITORY_SCOPES.ADMIN_LEVEL_2 || type === TERRITORY_SCOPES.PROVINCE) {
      values.admin2.push(code); values.province.push(code);
    }
    if (type === TERRITORY_SCOPES.MUNICIPALITY) values.municipality.push(code);
    if (type === TERRITORY_SCOPES.ELECTORAL_DISTRICT) values.electoralDistrict.push(code);
  }
  return createTerritoryContext(values);
}

async function loadLegacyResidence(db, userId) {
  const result = await db.query(
    `SELECT id, paese_residenza, regione_residenza, provincia_residenza, comune_residenza
     FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0] || null;
}

async function loadUserPoliticalTerritoryState(db, { userId, officeId = null } = {}) {
  const office = officeId ? resolvePoliticalOffice(officeId) : null;
  const params = [userId];
  const where = [
    'upt.user_id = $1',
    'upt.valid_from <= NOW()',
    '(upt.valid_to IS NULL OR upt.valid_to > NOW())',
  ];
  if (office) {
    params.push(office.id);
    where.push(`(upt.political_office_id IS NULL OR upt.political_office_id = $${params.length})`);
  }

  try {
    const result = await db.query(
      `SELECT
         upt.jurisdiction_id,
         upt.territory_type,
         upt.territory_code,
         upt.political_office_id,
         upt.source,
         upt.verification_level,
         upt.context,
         upt.valid_from,
         upt.valid_to
       FROM user_political_territories upt
       WHERE ${where.join(' AND ')}
       ORDER BY upt.territory_type, upt.territory_code`,
      params,
    );
    const authority = resolveAuthoritativeTerritoryRows(result.rows);
    return {
      source: 'CANONICAL',
      strict: true,
      memberships: authority.rows,
      conflicts: authority.conflicts,
      context: territoryContextFromMemberships(authority.rows),
    };
  } catch (error) {
    if (!isTerritoryMembershipSchemaError(error)) throw error;
  }

  const user = await loadLegacyResidence(db, userId);
  return {
    source: 'LEGACY',
    strict: false,
    memberships: [],
    conflicts: [],
    legacyUser: user,
    context: territoryContextFromLegacyUser(user),
  };
}

async function loadUserElectoralUnitMemberships(db, {
  userId,
  eventIds = [],
  officeId = null,
} = {}) {
  const params = [userId];
  const where = [
    'uem.user_id = $1',
    'uem.valid_from <= NOW()',
    '(uem.valid_to IS NULL OR uem.valid_to > NOW())',
  ];
  if (eventIds.length) {
    params.push(eventIds);
    where.push(`uem.election_event_id = ANY($${params.length}::uuid[])`);
  }
  if (officeId) {
    const office = resolvePoliticalOffice(officeId);
    if (!office) return { available: true, memberships: [] };
    params.push(office.id);
    where.push(`uem.political_office_id = $${params.length}`);
  }

  try {
    const result = await db.query(
      `SELECT
         uem.election_event_id::text AS election_event_id,
         uem.electoral_unit_id::text AS electoral_unit_id,
         uem.political_office_id,
         uem.source,
         uem.verification_level,
         uem.context
       FROM user_electoral_unit_memberships uem
       WHERE ${where.join(' AND ')}
       ORDER BY uem.election_event_id, uem.political_office_id, uem.electoral_unit_id`,
      params,
    );
    const memberships = keepHighestVerificationRows(
      result.rows,
      (row) => `${row.election_event_id || ''}|${row.political_office_id || ''}`,
    );
    return { available: true, memberships };
  } catch (error) {
    if (!isTerritoryMembershipSchemaError(error)) throw error;
    return { available: false, memberships: [] };
  }
}

function chooseEligibleUnitsWithMemberships(mappings, territoryContext, electoralMemberships = []) {
  const authoritativeMemberships = keepHighestVerificationRows(
    electoralMemberships || [],
    (row) => `${row.election_event_id || ''}|${row.political_office_id || ''}`,
  );
  const exactByEvent = new Map();
  for (const membership of authoritativeMemberships) {
    const eventId = String(membership.election_event_id);
    const units = exactByEvent.get(eventId) || new Set();
    units.add(String(membership.electoral_unit_id));
    exactByEvent.set(eventId, units);
  }

  const eligible = new Set();
  const mappingsByEvent = new Map();
  for (const row of mappings || []) {
    const eventId = String(row.election_event_id);
    const rows = mappingsByEvent.get(eventId) || [];
    rows.push(row);
    mappingsByEvent.set(eventId, rows);
  }

  for (const [eventId, rows] of mappingsByEvent.entries()) {
    const exactUnits = exactByEvent.get(eventId);
    if (exactUnits?.size) {
      for (const row of rows) {
        if (exactUnits.has(String(row.electoral_unit_id))) eligible.add(`${eventId}:${String(row.electoral_unit_id)}`);
      }
      continue;
    }
    for (const key of chooseMostSpecificEligibleUnits(rows, territoryContext)) eligible.add(key);
  }
  return eligible;
}

function normalizeVerificationLevel(value, fallback = 'VERIFIED') {
  const normalized = String(value || fallback).trim().toUpperCase();
  if (!VERIFICATION_PRIORITY[normalized]) {
    const error = new Error('Invalid territory verification level');
    error.code = 'TERRITORY_VERIFICATION_LEVEL_INVALID';
    throw error;
  }
  return normalized;
}

async function replaceUserPoliticalTerritories(db, {
  userId,
  jurisdictionId,
  officeId = null,
  source,
  verificationLevel = 'VERIFIED',
  memberships = [],
} = {}) {
  const office = officeId ? resolvePoliticalOffice(officeId) : null;
  if (officeId && !office) {
    const error = new Error('Unknown political office');
    error.code = 'POLITICAL_OFFICE_UNKNOWN';
    throw error;
  }
  const verification = normalizeVerificationLevel(verificationLevel);
  const safeSource = String(source || '').trim();
  const safeJurisdiction = String(jurisdictionId || office?.jurisdictionId || '').trim();
  if (!userId || !safeSource || !safeJurisdiction) {
    const error = new Error('Incomplete political territory write contract');
    error.code = 'POLITICAL_TERRITORY_CONTRACT_INVALID';
    throw error;
  }

  await db.query(
    `UPDATE user_political_territories
     SET valid_to = NOW(), updated_at = NOW()
     WHERE user_id = $1
       AND jurisdiction_id = $2
       AND COALESCE(political_office_id, '') = COALESCE($3, '')
       AND source = $4
       AND valid_to IS NULL`,
    [userId, safeJurisdiction, office?.id || null, safeSource],
  );

  let written = 0;
  for (const membership of memberships || []) {
    const territoryType = String(membership?.territoryType || membership?.territory_type || '').trim().toUpperCase();
    const territoryCode = String(membership?.territoryCode || membership?.territory_code || '').trim();
    if (!territoryCode || territoryType === TERRITORY_SCOPES.CUSTOM || !Object.values(TERRITORY_SCOPES).includes(territoryType)) continue;
    await db.query(
      `INSERT INTO user_political_territories (
         user_id, jurisdiction_id, territory_type, territory_code,
         political_office_id, source, verification_level, context
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        userId, safeJurisdiction, territoryType, territoryCode, office?.id || null,
        safeSource, verification, JSON.stringify(membership?.context || {}),
      ],
    );
    written += 1;
  }
  return { written, verificationLevel: verification, officeId: office?.id || null };
}

async function replaceUserElectoralUnitMemberships(db, {
  userId,
  electionEventId,
  officeId,
  electoralUnitIds = [],
  source,
  verificationLevel = 'OFFICIAL',
  context = {},
} = {}) {
  const office = resolvePoliticalOffice(officeId);
  const verification = normalizeVerificationLevel(verificationLevel, 'OFFICIAL');
  const safeSource = String(source || '').trim();
  if (!userId || !electionEventId || !office || !safeSource) {
    const error = new Error('Incomplete electoral unit membership contract');
    error.code = 'ELECTORAL_UNIT_MEMBERSHIP_CONTRACT_INVALID';
    throw error;
  }

  await db.query(
    `UPDATE user_electoral_unit_memberships
     SET valid_to = NOW(), updated_at = NOW()
     WHERE user_id = $1
       AND election_event_id = $2
       AND political_office_id = $3
       AND source = $4
       AND valid_to IS NULL`,
    [userId, electionEventId, office.id, safeSource],
  );

  const ids = [...new Set((electoralUnitIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  for (const electoralUnitId of ids) {
    await db.query(
      `INSERT INTO user_electoral_unit_memberships (
         user_id, election_event_id, electoral_unit_id, political_office_id,
         source, verification_level, context
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [userId, electionEventId, electoralUnitId, office.id, safeSource, verification, JSON.stringify(context || {})],
    );
  }
  return { written: ids.length, verificationLevel: verification, officeId: office.id };
}
module.exports = {
  VERIFICATION_PRIORITY,
  isTerritoryMembershipSchemaError,
  verificationRank,
  keepHighestVerificationRows,
  resolveAuthoritativeTerritoryRows,
  regionAliases,
  territoryContextFromLegacyUser,
  territoryContextFromMemberships,
  loadUserPoliticalTerritoryState,
  loadUserElectoralUnitMemberships,
  chooseEligibleUnitsWithMemberships,
  normalizeVerificationLevel,
  replaceUserPoliticalTerritories,
  replaceUserElectoralUnitMemberships,
};
