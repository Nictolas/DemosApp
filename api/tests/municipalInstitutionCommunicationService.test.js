const test = require('node:test');
const assert = require('node:assert/strict');

const {
  officialMunicipalAuthorityFromState,
  authorizeMunicipalInstitutionSender,
  normalizeMunicipalNoticePayload,
} = require('../services/municipalInstitutionCommunicationService');

function canonicalState(memberships = [], conflicts = []) {
  return { source: 'CANONICAL', strict: true, memberships, conflicts, context: {} };
}

function municipality(overrides = {}) {
  return {
    jurisdiction_id: 'it',
    territory_type: 'MUNICIPALITY',
    territory_code: '050026',
    political_office_id: null,
    source: 'institution_authority',
    verification_level: 'OFFICIAL',
    context: { label: 'Pisa' },
    ...overrides,
  };
}

test('one OFFICIAL municipality authorizes an institutional territorial notice', () => {
  const result = officialMunicipalAuthorityFromState(canonicalState([municipality()]));
  assert.equal(result.authorized, true);
  assert.equal(result.jurisdictionId, 'it');
  assert.equal(result.territoryCode, '050026');
  assert.equal(result.territoryLabel, 'Pisa');
  assert.equal(result.verificationLevel, 'OFFICIAL');
});

test('VERIFIED or SELF_DECLARED municipality is insufficient to broadcast as an institution', () => {
  for (const verification_level of ['VERIFIED', 'SELF_DECLARED']) {
    const result = officialMunicipalAuthorityFromState(canonicalState([
      municipality({ verification_level }),
    ]));
    assert.equal(result.authorized, false);
    assert.equal(result.reason, 'OFFICIAL_MUNICIPAL_AUTHORITY_REQUIRED');
  }
});

test('office-specific municipality does not grant general institutional broadcast authority', () => {
  const result = officialMunicipalAuthorityFromState(canonicalState([
    municipality({ political_office_id: 'it.comune' }),
  ]));
  assert.equal(result.authorized, false);
  assert.equal(result.reason, 'OFFICIAL_MUNICIPAL_AUTHORITY_REQUIRED');
});

test('ambiguous or conflicting municipal authority fails closed', () => {
  const ambiguous = officialMunicipalAuthorityFromState(canonicalState([
    municipality(),
    municipality({ territory_code: '050031', context: { label: 'San Giuliano Terme' } }),
  ]));
  assert.equal(ambiguous.authorized, false);
  assert.equal(ambiguous.reason, 'MUNICIPAL_AUTHORITY_AMBIGUOUS');

  const conflict = officialMunicipalAuthorityFromState(canonicalState([], [{
    territoryType: 'MUNICIPALITY',
    politicalOfficeId: null,
    territoryCodes: ['050026', '050031'],
  }]));
  assert.equal(conflict.authorized, false);
  assert.equal(conflict.reason, 'MUNICIPAL_AUTHORITY_CONFLICT');
});

test('legacy territory model never authorizes municipal broadcast', () => {
  const result = officialMunicipalAuthorityFromState({ source: 'LEGACY', strict: false, memberships: [] });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, 'CANONICAL_TERRITORY_REQUIRED');
});

test('ordinary person is rejected before any territory database lookup', async () => {
  let queries = 0;
  const db = { query: async () => { queries += 1; return { rows: [] }; } };
  const result = await authorizeMunicipalInstitutionSender(db, {
    user: { id: 'u1', accountType: 'PERSON', isAdmin: false },
  });
  assert.equal(result.authorized, false);
  assert.equal(result.reason, 'INSTITUTION_OR_ADMIN_REQUIRED');
  assert.equal(queries, 0);
});

test('notice payload validates dates, ordering and bounded free text', () => {
  assert.deepEqual(normalizeMunicipalNoticePayload({
    tipologia: 'Allerta Meteo',
    dove: 'Tutto il comune',
    dal_giorno: '2026-10-10',
    al_giorno: '2026-10-11',
  }), {
    tipologia: 'Allerta Meteo',
    dove: 'Tutto il comune',
    dalGiorno: '2026-10-10',
    alGiorno: '2026-10-11',
  });
  assert.throws(() => normalizeMunicipalNoticePayload({
    tipologia: 'Allerta', dove: 'Centro', dal_giorno: '2026-10-12', al_giorno: '2026-10-11',
  }), /INFORMA_CITTADINI_PAYLOAD_INVALID/);
});
