'use strict';

const { loadUserPoliticalTerritoryState } = require('./politicalTerritoryMembershipService');

const MUNICIPALITY = 'MUNICIPALITY';
const OFFICIAL = 'OFFICIAL';

function uniqueMunicipalities(rows = [], { officialOnly = false } = {}) {
  const seen = new Map();
  for (const row of rows) {
    if (String(row?.territory_type || '').toUpperCase() !== MUNICIPALITY) continue;
    if (row?.political_office_id) continue;
    if (officialOnly && String(row?.verification_level || '').toUpperCase() !== OFFICIAL) continue;
    const jurisdictionId = String(row?.jurisdiction_id || '').trim();
    const territoryCode = String(row?.territory_code || '').trim();
    if (!jurisdictionId || !territoryCode) continue;
    const key = `${jurisdictionId}|${territoryCode}`;
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

function municipalConflicts(state) {
  return (state?.conflicts || []).filter((item) =>
    String(item?.territoryType || '').toUpperCase() === MUNICIPALITY
    && !item?.politicalOfficeId
  );
}

function officialMunicipalAuthorityFromState(state) {
  if (!state || state.source !== 'CANONICAL' || state.strict !== true) {
    return { authorized: false, reason: 'CANONICAL_TERRITORY_REQUIRED' };
  }
  if (municipalConflicts(state).length > 0) {
    return { authorized: false, reason: 'MUNICIPAL_AUTHORITY_CONFLICT' };
  }
  const municipalities = uniqueMunicipalities(state.memberships, { officialOnly: true });
  if (municipalities.length === 0) {
    return { authorized: false, reason: 'OFFICIAL_MUNICIPAL_AUTHORITY_REQUIRED' };
  }
  if (municipalities.length !== 1) {
    return { authorized: false, reason: 'MUNICIPAL_AUTHORITY_AMBIGUOUS' };
  }
  const row = municipalities[0];
  return {
    authorized: true,
    jurisdictionId: String(row.jurisdiction_id),
    territoryType: MUNICIPALITY,
    territoryCode: String(row.territory_code),
    territoryLabel: row.context?.label ? String(row.context.label) : null,
    authoritySource: String(row.source || ''),
    verificationLevel: OFFICIAL,
  };
}

async function authorizeMunicipalInstitutionSender(db, { user } = {}) {
  const accountType = String(user?.accountType || '').toUpperCase();
  const privilegedActor = accountType === 'INSTITUTION' || user?.isAdmin === true;
  if (!privilegedActor) {
    return { authorized: false, reason: 'INSTITUTION_OR_ADMIN_REQUIRED' };
  }
  const state = await loadUserPoliticalTerritoryState(db, { userId: user?.id });
  return officialMunicipalAuthorityFromState(state);
}

async function loadCanonicalMunicipalityTargets(db, { userId } = {}) {
  const state = await loadUserPoliticalTerritoryState(db, { userId });
  if (!state || state.source !== 'CANONICAL' || state.strict !== true) {
    return { available: false, targets: [], conflicts: [] };
  }
  const conflicts = municipalConflicts(state);
  if (conflicts.length > 0) {
    return { available: true, targets: [], conflicts };
  }
  return {
    available: true,
    targets: uniqueMunicipalities(state.memberships).map((row) => ({
      jurisdictionId: String(row.jurisdiction_id),
      territoryCode: String(row.territory_code),
    })),
    conflicts: [],
  };
}

function normalizeMunicipalNoticePayload(body = {}) {
  const tipologia = String(body.tipologia || '').trim();
  const dove = String(body.dove || '').trim();
  const dalGiorno = String(body.dal_giorno || '').trim();
  const alGiorno = String(body.al_giorno || '').trim();
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  if (!tipologia || !dove || !isoDate.test(dalGiorno) || !isoDate.test(alGiorno)) {
    const error = new Error('INFORMA_CITTADINI_PAYLOAD_INVALID');
    error.code = 'INFORMA_CITTADINI_PAYLOAD_INVALID';
    throw error;
  }
  if (tipologia.length > 200 || dove.length > 300 || dalGiorno > alGiorno) {
    const error = new Error('INFORMA_CITTADINI_PAYLOAD_INVALID');
    error.code = 'INFORMA_CITTADINI_PAYLOAD_INVALID';
    throw error;
  }
  return { tipologia, dove, dalGiorno, alGiorno };
}

function isMunicipalCommunicationSchemaError(error) {
  return ['42P01', '42703'].includes(error?.code);
}

module.exports = {
  MUNICIPALITY,
  OFFICIAL,
  uniqueMunicipalities,
  municipalConflicts,
  officialMunicipalAuthorityFromState,
  authorizeMunicipalInstitutionSender,
  loadCanonicalMunicipalityTargets,
  normalizeMunicipalNoticePayload,
  isMunicipalCommunicationSchemaError,
};
