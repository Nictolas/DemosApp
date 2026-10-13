const { isApprovalSchemaError } = require('./eventApprovalService');
const { normalizeElectionType, getElectionResidenceScope, isMixedScopeElection, TERRITORY_SCOPES } = require('./politicalJurisdictionRegistryService');
const { territoryMatchesScope } = require('./politicalTerritoryService');
const {
  territoryContextFromLegacyUser,
  loadUserPoliticalTerritoryState,
  loadUserElectoralUnitMemberships,
  chooseEligibleUnitsWithMemberships,
} = require('./politicalTerritoryMembershipService');

const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);

function asTerritoryContext(userOrContext) {
  if (userOrContext && Array.isArray(userOrContext[TERRITORY_SCOPES.COUNTRY])) return userOrContext;
  return territoryContextFromLegacyUser(userOrContext);
}

function eventGeographyMatches(userOrContext, event) {
  const scope = getElectionResidenceScope(event.tipo_elezione);
  const aliases = asTerritoryContext(userOrContext);
  const countryMatches = !event.paese_evento || territoryMatchesScope(aliases, TERRITORY_SCOPES.COUNTRY, event.paese_evento);
  if (!countryMatches) return false;

  // Mixed-scope events need explicit contest/electoral-unit resolution.
  if (isMixedScopeElection(event.tipo_elezione)) return false;

  if (scope === TERRITORY_SCOPES.COUNTRY || scope === TERRITORY_SCOPES.SUPRANATIONAL) return true;
  if (scope === TERRITORY_SCOPES.REGION || scope === TERRITORY_SCOPES.ADMIN_LEVEL_1) {
    return !event.regione_evento || territoryMatchesScope(aliases, scope, event.regione_evento);
  }
  if (scope === TERRITORY_SCOPES.PROVINCE || scope === TERRITORY_SCOPES.ADMIN_LEVEL_2) {
    return !event.provincia_evento || territoryMatchesScope(aliases, scope, event.provincia_evento);
  }
  if (scope === TERRITORY_SCOPES.MUNICIPALITY) {
    return !event.comune_evento || territoryMatchesScope(aliases, scope, event.comune_evento);
  }
  if (scope === TERRITORY_SCOPES.ELECTORAL_DISTRICT) {
    const district = event.electoral_district || event.distretto_elettorale || null;
    return Boolean(district && territoryMatchesScope(aliases, scope, district));
  }

  if (event.comune_evento) return territoryMatchesScope(aliases, TERRITORY_SCOPES.MUNICIPALITY, event.comune_evento);
  if (event.provincia_evento) return territoryMatchesScope(aliases, TERRITORY_SCOPES.PROVINCE, event.provincia_evento);
  if (event.regione_evento) return territoryMatchesScope(aliases, TERRITORY_SCOPES.REGION, event.regione_evento);
  return true;
}

async function listElectionEvents(pool, { upcomingOnly = false, limit = null } = {}) {
  const params = [];
  let sql = `
    SELECT id, nome_evento, tipologia_evento, tipo_elezione,
           paese_evento, regione_evento, provincia_evento, comune_evento,
           giorno_inizio, giorno_fine, orario_inizio, orario_fine, created_at
    FROM eventi
    WHERE LOWER(TRIM(tipologia_evento)) = 'elezioni'
  `;

  if (upcomingOnly) {
    sql += ` AND giorno_inizio IS NOT NULL AND COALESCE(giorno_fine, giorno_inizio) >= CURRENT_DATE`;
  }
  sql += ` ORDER BY giorno_inizio ASC NULLS LAST, created_at ASC`;

  if (limit != null) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 5));
    params.push(safeLimit);
    sql += ` LIMIT $${params.length}`;
  }

  const approvedSql = sql.replace(
    ` ORDER BY giorno_inizio ASC NULLS LAST, created_at ASC`,
    ` AND approval_status = 'APPROVED' ORDER BY giorno_inizio ASC NULLS LAST, created_at ASC`
  );
  try {
    const result = await pool.query(approvedSql, params);
    return result.rows;
  } catch (error) {
    if (!isApprovalSchemaError(error)) throw error;
    const result = await pool.query(sql, params);
    return result.rows;
  }
}

async function getElectionUnitMappings(pool, eventIds) {
  if (!eventIds.length) return [];
  const result = await pool.query(
    `
    SELECT
      ue.evento_id AS election_event_id,
      ue.id AS electoral_unit_id,
      COALESCE(
        NULLIF(UPPER(TRIM(uet.territory_type)), ''),
        CASE WHEN uet.regione_codice IS NOT NULL THEN 'REGION' ELSE NULL END
      ) AS territory_type,
      COALESCE(NULLIF(uet.territory_code, ''), uet.regione_codice) AS territory_code
    FROM unita_elettorale ue
    JOIN unita_elettorale_territorio uet ON uet.unita_elettorale_id = ue.id
    WHERE ue.evento_id = ANY($1)
    `,
    [eventIds]
  );
  return result.rows;
}

async function listRelevantElectionEvents(pool, userId, { limit = null } = {}) {
  const territoryState = await loadUserPoliticalTerritoryState(pool, { userId });
  const events = await listElectionEvents(pool, { upcomingOnly: true });
  if (!events.length) return [];

  const eventIds = events.map((event) => event.id);
  const electoralMembershipState = await loadUserElectoralUnitMemberships(pool, { userId, eventIds });
  const directMembershipsByEvent = new Map();
  for (const membership of electoralMembershipState.memberships) {
    const eventId = String(membership.election_event_id);
    const units = directMembershipsByEvent.get(eventId) || new Set();
    units.add(String(membership.electoral_unit_id));
    directMembershipsByEvent.set(eventId, units);
  }

  let mappings = [];
  try {
    mappings = await getElectionUnitMappings(pool, eventIds);
  } catch (error) {
    if (!SCHEMA_COMPAT_ERROR_CODES.has(error?.code)) throw error;
    mappings = [];
  }

  const eligibleKeys = chooseEligibleUnitsWithMemberships(
    mappings,
    territoryState.context,
    electoralMembershipState.memberships,
  );
  const mappingsByEvent = new Map();
  for (const row of mappings) {
    const key = String(row.election_event_id);
    const arr = mappingsByEvent.get(key) || [];
    arr.push(row);
    mappingsByEvent.set(key, arr);
  }

  const relevant = [];
  for (const event of events) {
    const eventId = String(event.id);
    const directUnits = directMembershipsByEvent.get(eventId);
    const eventMappings = mappingsByEvent.get(eventId) || [];

    if (eventMappings.length > 0) {
      const eligibleUnitIds = eventMappings
        .filter((row) => eligibleKeys.has(`${eventId}:${String(row.electoral_unit_id)}`))
        .map((row) => row.electoral_unit_id);
      if (eligibleUnitIds.length > 0) {
        relevant.push({ ...event, eligible_electoral_unit_ids: [...new Set(eligibleUnitIds)] });
      }
      continue;
    }

    if (directUnits?.size) {
      relevant.push({ ...event, eligible_electoral_unit_ids: [...directUnits] });
      continue;
    }

    if (eventGeographyMatches(territoryState.context, event)) {
      relevant.push({ ...event, eligible_electoral_unit_ids: [] });
    }
  }

  if (limit == null) return relevant;
  return relevant.slice(0, Math.max(1, Math.min(100, Number(limit) || 5)));
}

module.exports = {
  normalizeElectionType,
  eventGeographyMatches,
  listElectionEvents,
  listRelevantElectionEvents
};
