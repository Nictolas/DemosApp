const {
  TERRITORY_SCOPES,
  resolvePoliticalOffice,
  getOfficeAliases,
  normalizeKey,
} = require('./politicalJurisdictionRegistryService');
const {
  TERRITORY_PRIORITY,
  jurisdictionMatchesScope,
  mappingMatchesTerritory,
  chooseMostSpecificEligibleUnits,
} = require('./politicalTerritoryService');
const {
  regionAliases,
  territoryContextFromLegacyUser,
  loadUserPoliticalTerritoryState,
  loadUserElectoralUnitMemberships,
  chooseEligibleUnitsWithMemberships,
} = require('./politicalTerritoryMembershipService');

const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);
const GLOBAL_REPRESENTATIVE_GRADES = new Set(['E', 'C', 'S']); // legacy export; semantics now come from the registry

function territoryAliases(user) {
  return territoryContextFromLegacyUser(user);
}

function asTerritoryContext(value) {
  if (value && Array.isArray(value[TERRITORY_SCOPES.COUNTRY])) return value;
  return territoryAliases(value);
}

function jurisdictionMatchesRepresentative(jurisdiction, grade, userOrContext) {
  const office = resolvePoliticalOffice(grade);
  if (!office) return false;
  const aliases = asTerritoryContext(userOrContext);
  const allowUnspecified = office.residenceScope === TERRITORY_SCOPES.SUPRANATIONAL || office.residenceScope === TERRITORY_SCOPES.COUNTRY;
  return jurisdictionMatchesScope(jurisdiction || {}, office.residenceScope, aliases, { allowUnspecified });
}

function mappingMatchesUser(mapping, aliases) {
  return mappingMatchesTerritory(mapping, aliases);
}

function chooseEligibleUnits(mappings, userOrContext) {
  return chooseMostSpecificEligibleUnits(mappings, asTerritoryContext(userOrContext));
}

async function listEligibleCandidatesNewModel(pool, userId, grade) {
  const office = resolvePoliticalOffice(grade);
  if (!office) return { subjects: [], source: 'CAPABILITY', strict: true, reason: 'POLITICAL_OFFICE_UNKNOWN' };

  const territoryState = await loadUserPoliticalTerritoryState(pool, { userId, officeId: office.id });

  const candidatesResult = await pool.query(
    `
    SELECT
      u.id, u.nome, u.cognome, u.ruolo, u.status, u.avatar_config,
      pc.id AS candidacy_id,
      pc.election_event_id,
      pc.electoral_unit_id,
      pc.jurisdiction,
      pc.jurisdiction->>'level' AS grado_candidatura
    FROM political_candidacies pc
    JOIN users u ON u.id = pc.user_id
    JOIN eventi e ON e.id = pc.election_event_id
    WHERE pc.status = 'ACTIVE'
      AND pc.starts_at <= NOW()
      AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
      AND pc.election_event_id IS NOT NULL
      AND pc.electoral_unit_id IS NOT NULL
      AND u.status = 'a'
      AND regexp_replace(UPPER(COALESCE(pc.jurisdiction->>'level', '')), '[^A-Z0-9]', '', 'g') = ANY($1::text[])
      AND LOWER(TRIM(e.tipologia_evento)) = 'elezioni'
      AND (e.giorno_inizio IS NULL OR COALESCE(e.giorno_fine, e.giorno_inizio) >= CURRENT_DATE)
    ORDER BY u.cognome, u.nome
    `,
    [getOfficeAliases(grade).map(normalizeKey)]
  );

  if (candidatesResult.rows.length === 0) {
    return { subjects: [], source: 'CAPABILITY', strict: true, reason: 'NO_CANONICAL_CANDIDACIES' };
  }

  const unitIds = [...new Set(candidatesResult.rows.map((row) => row.electoral_unit_id).filter(Boolean))];
  const eventIds = [...new Set(candidatesResult.rows.map((row) => row.election_event_id).filter(Boolean))];
  const mappingsResult = await pool.query(
    `
    SELECT
      ue.id AS electoral_unit_id,
      ue.evento_id AS election_event_id,
      COALESCE(
        NULLIF(UPPER(TRIM(uet.territory_type)), ''),
        CASE WHEN uet.regione_codice IS NOT NULL THEN 'REGION' ELSE NULL END
      ) AS territory_type,
      COALESCE(NULLIF(uet.territory_code, ''), uet.regione_codice) AS territory_code
    FROM unita_elettorale ue
    JOIN unita_elettorale_territorio uet ON uet.unita_elettorale_id = ue.id
    WHERE ue.id = ANY($1)
    `,
    [unitIds]
  );

  const electoralMembershipState = await loadUserElectoralUnitMemberships(pool, {
    userId,
    eventIds,
    officeId: office.id,
  });
  const eligibleKeys = chooseEligibleUnitsWithMemberships(
    mappingsResult.rows,
    territoryState.context,
    electoralMembershipState.memberships,
  );
  const subjects = candidatesResult.rows.filter((row) =>
    eligibleKeys.has(`${String(row.election_event_id)}:${String(row.electoral_unit_id)}`)
  );

  return {
    subjects,
    source: 'CAPABILITY',
    territorySource: territoryState.source,
    electoralMembershipsAvailable: electoralMembershipState.available,
    strict: true,
    reason: subjects.length ? null : 'NO_ELECTORAL_UNIT_FOR_USER'
  };
}

async function listEligibleCandidatesLegacy(pool, grade) {
  const office = resolvePoliticalOffice(grade);
  const legacyGrade = office?.aliases?.[0] || grade;
  const result = await pool.query(
    `
    SELECT id, nome, cognome, ruolo, status, avatar_config, grado_candidatura
    FROM users
    WHERE ruolo IN ('C', 'CP')
      AND grado_candidatura = $1
    ORDER BY nome, cognome
    `,
    [legacyGrade]
  );
  return { subjects: result.rows, source: 'LEGACY', strict: false, reason: 'CAPABILITY_SCHEMA_NOT_AVAILABLE' };
}

async function listEligibleCandidates(pool, userId, grade) {
  try {
    return await listEligibleCandidatesNewModel(pool, userId, grade);
  } catch (error) {
    if (!SCHEMA_COMPAT_ERROR_CODES.has(error?.code)) throw error;
    return listEligibleCandidatesLegacy(pool, grade);
  }
}

async function listEligibleRepresentativesNewModel(pool, userId, grade) {
  const office = resolvePoliticalOffice(grade);
  if (!office) return { subjects: [], source: 'CAPABILITY', strict: true, reason: 'POLITICAL_OFFICE_UNKNOWN' };
  const territoryState = await loadUserPoliticalTerritoryState(pool, { userId, officeId: office.id });

  const result = await pool.query(
    `
    SELECT
      u.id, u.nome, u.cognome, u.ruolo, u.status, u.avatar_config,
      pm.id AS mandate_id,
      pm.office_code AS grado_elezione,
      pm.jurisdiction
    FROM political_mandates pm
    JOIN users u ON u.id = pm.user_id
    WHERE pm.status = 'ACTIVE'
      AND pm.starts_at <= NOW()
      AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
      AND u.status = 'a'
      AND regexp_replace(UPPER(COALESCE(pm.jurisdiction->>'level', pm.office_code, '')), '[^A-Z0-9]', '', 'g') = ANY($1::text[])
    ORDER BY u.cognome, u.nome
    `,
    [getOfficeAliases(grade).map(normalizeKey)]
  );

  const subjects = result.rows.filter((row) =>
    jurisdictionMatchesRepresentative(row.jurisdiction, grade, territoryState.context)
  );
  return {
    subjects,
    source: 'CAPABILITY',
    territorySource: territoryState.source,
    strict: true,
    reason: subjects.length ? null : 'NO_ELIGIBLE_REPRESENTATIVES'
  };
}

async function listEligibleRepresentativesLegacy(pool, grade) {
  const office = resolvePoliticalOffice(grade);
  const legacyGrade = office?.aliases?.[0] || grade;
  const result = await pool.query(
    `
    SELECT
      u.id, u.nome, u.cognome, u.ruolo, u.status, u.avatar_config,
      u.grado_elezione, u.regione_elezione, u.provincia_elezione, u.comune_elezione
    FROM users u
    WHERE (u.ruolo = 'P' OR u.ruolo = 'CP')
      AND u.grado_elezione = $1
    ORDER BY u.cognome, u.nome
    `,
    [legacyGrade]
  );
  return { subjects: result.rows, source: 'LEGACY', strict: false, reason: 'CAPABILITY_SCHEMA_NOT_AVAILABLE' };
}

async function listEligibleRepresentatives(pool, userId, grade) {
  try {
    return await listEligibleRepresentativesNewModel(pool, userId, grade);
  } catch (error) {
    if (!SCHEMA_COMPAT_ERROR_CODES.has(error?.code)) throw error;
    return listEligibleRepresentativesLegacy(pool, grade);
  }
}

async function isCandidateSelectionEligible(pool, userId, candidateId, grade) {
  const result = await listEligibleCandidates(pool, userId, grade);
  return {
    eligible: result.subjects.some((row) => String(row.id) === String(candidateId)),
    ...result
  };
}

async function isRepresentativeSelectionEligible(pool, userId, representativeId, grade) {
  const result = await listEligibleRepresentatives(pool, userId, grade);
  return {
    eligible: result.subjects.some((row) => String(row.id) === String(representativeId)),
    ...result
  };
}

module.exports = {
  GLOBAL_REPRESENTATIVE_GRADES,
  TERRITORY_PRIORITY,
  regionAliases,
  territoryAliases,
  jurisdictionMatchesRepresentative,
  chooseEligibleUnits,
  listEligibleCandidates,
  listEligibleRepresentatives,
  isCandidateSelectionEligible,
  isRepresentativeSelectionEligible
};
