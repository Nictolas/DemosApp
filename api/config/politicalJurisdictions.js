'use strict';

const LEGACY_DEFAULT_ADAPTER_ID = 'it';

const TERRITORY_SCOPES = Object.freeze({
  SUPRANATIONAL: 'SUPRANATIONAL',
  COUNTRY: 'COUNTRY',
  ADMIN_LEVEL_1: 'ADMIN_LEVEL_1',
  ADMIN_LEVEL_2: 'ADMIN_LEVEL_2',
  ELECTORAL_DISTRICT: 'ELECTORAL_DISTRICT',
  REGION: 'REGION',
  PROVINCE: 'PROVINCE',
  MUNICIPALITY: 'MUNICIPALITY',
  // Evidence-only scopes: ordinary residence never derives these.
  SUB_MUNICIPAL_AREA: 'SUB_MUNICIPAL_AREA',
  OFFICIAL_AREA: 'OFFICIAL_AREA',
  CUSTOM: 'CUSTOM',
});

const OPINION_SCOPES = Object.freeze({
  E: Object.freeze({ id: 'E', adapterId: 'it', jurisdictionId: 'eu', label: 'Europeo', aliases: Object.freeze(['E', 'Europeo', 'European']) }),
  N: Object.freeze({ id: 'N', adapterId: 'it', jurisdictionId: 'it', label: 'Nazionale', aliases: Object.freeze(['N', 'Nazionale', 'National']) }),
  R: Object.freeze({ id: 'R', adapterId: 'it', jurisdictionId: 'it', label: 'Regionale', aliases: Object.freeze(['R', 'Regionale', 'Regional']) }),
  CO: Object.freeze({ id: 'CO', adapterId: 'it', jurisdictionId: 'it', label: 'Comunale', aliases: Object.freeze(['CO', 'Comunale', 'Municipal']) }),
  US_FED: Object.freeze({ id: 'US_FED', adapterId: 'us', jurisdictionId: 'us', label: 'Federale (USA)', aliases: Object.freeze(['US_FED', 'Federal', 'Federale']) }),
  US_STATE: Object.freeze({ id: 'US_STATE', adapterId: 'us', jurisdictionId: 'us', label: 'Statale (USA)', aliases: Object.freeze(['US_STATE', 'State', 'Statale']) }),
  US_LOCAL: Object.freeze({ id: 'US_LOCAL', adapterId: 'us', jurisdictionId: 'us', label: 'Locale (USA)', aliases: Object.freeze(['US_LOCAL', 'Local', 'Locale']) }),
});

const POLITICAL_OFFICES = Object.freeze({
  'eu.parliament.it': Object.freeze({
    id: 'eu.parliament.it', jurisdictionId: 'eu', adapterId: 'it', officeKind: 'legislative', label: 'Parlamento europeo',
    aliases: Object.freeze(['E', 'EU', 'EUROPEO', 'EUROPEA', 'PARLAMENTOEUROPEO']), residenceScope: TERRITORY_SCOPES.COUNTRY,
    legacyRepresentativeField: 'rappresentante_europeo', legacyCandidateField: 'candidato_europeo', legacyCategory: 'europeo', legacyTestField: 'test_europeo',
    opinionGrade: 'E', podiumLevel: 'EUROPEO',
  }),
  'it.camera': Object.freeze({
    id: 'it.camera', jurisdictionId: 'it', adapterId: 'it', officeKind: 'legislative', label: 'Camera dei deputati',
    aliases: Object.freeze(['C', 'CAMERA', 'CAMERADEIDEPUTATI']), residenceScope: TERRITORY_SCOPES.COUNTRY,
    legacyRepresentativeField: 'rappresentante_camera', legacyCandidateField: 'candidato_camera', legacyCategory: 'camera', legacyTestField: 'test_camera',
    opinionGrade: 'N', podiumLevel: 'CAMERA',
  }),
  'it.senato': Object.freeze({
    id: 'it.senato', jurisdictionId: 'it', adapterId: 'it', officeKind: 'legislative', label: 'Senato della Repubblica',
    aliases: Object.freeze(['S', 'SENATO', 'SENATODELLAREPUBBLICA']), residenceScope: TERRITORY_SCOPES.COUNTRY,
    legacyRepresentativeField: 'rappresentante_senato', legacyCandidateField: 'candidato_senato', legacyCategory: 'senato', legacyTestField: 'test_senato',
    opinionGrade: 'N', podiumLevel: 'SENATO',
  }),
  'it.regional': Object.freeze({
    id: 'it.regional', jurisdictionId: 'it', adapterId: 'it', officeKind: 'legislative', label: 'Regione',
    aliases: Object.freeze(['R', 'REGIONE', 'REGIONALE', 'REGIONAL']), residenceScope: TERRITORY_SCOPES.REGION,
    legacyRepresentativeField: 'rappresentante_regionale', legacyCandidateField: 'candidato_regionale', legacyCategory: 'regione', legacyTestField: 'test_regionale',
    opinionGrade: 'R', podiumLevel: 'REGIONE',
  }),
  'it.municipal': Object.freeze({
    id: 'it.municipal', jurisdictionId: 'it', adapterId: 'it', officeKind: 'local', label: 'Comune',
    aliases: Object.freeze(['CO', 'COMUNE', 'COMUNALE', 'MUNICIPAL']), residenceScope: TERRITORY_SCOPES.MUNICIPALITY,
    legacyRepresentativeField: 'rappresentante_comune', legacyCandidateField: 'candidato_comune', legacyCategory: 'comune', legacyTestField: 'test_comune',
    opinionGrade: 'CO', podiumLevel: 'COMUNE',
  }),

  'us.president': Object.freeze({
    id: 'us.president', jurisdictionId: 'us', adapterId: 'us', officeKind: 'executive', label: 'President of the United States',
    aliases: Object.freeze(['PRESIDENT', 'PRESIDENTIAL', 'USPRESIDENT']), residenceScope: TERRITORY_SCOPES.COUNTRY, opinionGrade: 'US_FED',
  }),
  'us.house': Object.freeze({
    id: 'us.house', jurisdictionId: 'us', adapterId: 'us', officeKind: 'legislative', label: 'U.S. House of Representatives',
    aliases: Object.freeze(['HOUSE', 'USHOUSE', 'HOUSEOFREPRESENTATIVES']), residenceScope: TERRITORY_SCOPES.ELECTORAL_DISTRICT, opinionGrade: 'US_FED',
  }),
  'us.senate': Object.freeze({
    id: 'us.senate', jurisdictionId: 'us', adapterId: 'us', officeKind: 'legislative', label: 'U.S. Senate',
    aliases: Object.freeze(['SENATE', 'USSENATE', 'FEDERALSENATE']), residenceScope: TERRITORY_SCOPES.ADMIN_LEVEL_1, opinionGrade: 'US_FED',
  }),
  'us.governor': Object.freeze({
    id: 'us.governor', jurisdictionId: 'us', adapterId: 'us', officeKind: 'executive', label: 'State Governor',
    aliases: Object.freeze(['GOVERNOR', 'STATEGOVERNOR']), residenceScope: TERRITORY_SCOPES.ADMIN_LEVEL_1, opinionGrade: 'US_STATE',
  }),
  'us.state.upper': Object.freeze({
    id: 'us.state.upper', jurisdictionId: 'us', adapterId: 'us', officeKind: 'legislative', label: 'State Legislature — upper chamber',
    aliases: Object.freeze(['STATESENATE', 'STATEUPPERHOUSE']), residenceScope: TERRITORY_SCOPES.ELECTORAL_DISTRICT, opinionGrade: 'US_STATE',
  }),
  'us.state.lower': Object.freeze({
    id: 'us.state.lower', jurisdictionId: 'us', adapterId: 'us', officeKind: 'legislative', label: 'State Legislature — lower chamber',
    aliases: Object.freeze(['STATEHOUSE', 'STATEASSEMBLY', 'STATELOWERHOUSE']), residenceScope: TERRITORY_SCOPES.ELECTORAL_DISTRICT, opinionGrade: 'US_STATE',
  }),
  'us.mayor': Object.freeze({
    id: 'us.mayor', jurisdictionId: 'us', adapterId: 'us', officeKind: 'executive', label: 'Mayor',
    aliases: Object.freeze(['MAYOR', 'MAYORAL']), residenceScope: TERRITORY_SCOPES.MUNICIPALITY, opinionGrade: 'US_LOCAL',
  }),
});

const ELECTION_CONTESTS = Object.freeze({
  'it.eu_parliament': Object.freeze({ id: 'it.eu_parliament', adapterId: 'it', officeId: 'eu.parliament.it', residenceScope: TERRITORY_SCOPES.COUNTRY }),
  'it.camera': Object.freeze({ id: 'it.camera', adapterId: 'it', officeId: 'it.camera', residenceScope: TERRITORY_SCOPES.COUNTRY }),
  'it.senato': Object.freeze({ id: 'it.senato', adapterId: 'it', officeId: 'it.senato', residenceScope: TERRITORY_SCOPES.COUNTRY }),
  'it.regional': Object.freeze({ id: 'it.regional', adapterId: 'it', officeId: 'it.regional', residenceScope: TERRITORY_SCOPES.REGION }),
  'it.municipal': Object.freeze({ id: 'it.municipal', adapterId: 'it', officeId: 'it.municipal', residenceScope: TERRITORY_SCOPES.MUNICIPALITY }),
  'us.president': Object.freeze({ id: 'us.president', adapterId: 'us', officeId: 'us.president', residenceScope: TERRITORY_SCOPES.COUNTRY }),
  'us.house': Object.freeze({ id: 'us.house', adapterId: 'us', officeId: 'us.house', residenceScope: TERRITORY_SCOPES.ELECTORAL_DISTRICT }),
  'us.senate': Object.freeze({ id: 'us.senate', adapterId: 'us', officeId: 'us.senate', residenceScope: TERRITORY_SCOPES.ADMIN_LEVEL_1 }),
  'us.governor': Object.freeze({ id: 'us.governor', adapterId: 'us', officeId: 'us.governor', residenceScope: TERRITORY_SCOPES.ADMIN_LEVEL_1 }),
  'us.state.upper': Object.freeze({ id: 'us.state.upper', adapterId: 'us', officeId: 'us.state.upper', residenceScope: TERRITORY_SCOPES.ELECTORAL_DISTRICT }),
  'us.state.lower': Object.freeze({ id: 'us.state.lower', adapterId: 'us', officeId: 'us.state.lower', residenceScope: TERRITORY_SCOPES.ELECTORAL_DISTRICT }),
  'us.mayor': Object.freeze({ id: 'us.mayor', adapterId: 'us', officeId: 'us.mayor', residenceScope: TERRITORY_SCOPES.MUNICIPALITY }),
});

const ELECTION_TYPES = Object.freeze({
  EUROPEAN: Object.freeze({ id: 'EUROPEAN', adapterId: 'it', aliases: Object.freeze(['Europee', 'European', 'Europee Parlamento']), residenceScope: TERRITORY_SCOPES.COUNTRY, contestIds: Object.freeze(['it.eu_parliament']) }),
  NATIONAL: Object.freeze({ id: 'NATIONAL', adapterId: 'it', aliases: Object.freeze(['Politiche_nazionali', 'Nazionali', 'Politiche', 'National']), residenceScope: TERRITORY_SCOPES.COUNTRY, contestIds: Object.freeze(['it.camera', 'it.senato']) }),
  REGIONAL: Object.freeze({ id: 'REGIONAL', adapterId: 'it', aliases: Object.freeze(['Regionali', 'Regionale', 'Regional']), residenceScope: TERRITORY_SCOPES.REGION, contestIds: Object.freeze(['it.regional']) }),
  MUNICIPAL: Object.freeze({ id: 'MUNICIPAL', adapterId: 'it', aliases: Object.freeze(['Comunali', 'Comunale', 'Municipal']), residenceScope: TERRITORY_SCOPES.MUNICIPALITY, contestIds: Object.freeze(['it.municipal']) }),
  REFERENDUM: Object.freeze({ id: 'REFERENDUM', adapterId: 'it', aliases: Object.freeze(['Referendum']), residenceScope: TERRITORY_SCOPES.CUSTOM, contestIds: Object.freeze([]) }),

  US_PRESIDENTIAL: Object.freeze({ id: 'US_PRESIDENTIAL', adapterId: 'us', aliases: Object.freeze(['Presidential', 'Presidential Election', 'President']), residenceScope: TERRITORY_SCOPES.COUNTRY, contestIds: Object.freeze(['us.president']) }),
  US_HOUSE: Object.freeze({ id: 'US_HOUSE', adapterId: 'us', aliases: Object.freeze(['US House', 'House Election', 'House of Representatives Election']), residenceScope: TERRITORY_SCOPES.ELECTORAL_DISTRICT, contestIds: Object.freeze(['us.house']) }),
  US_SENATE: Object.freeze({ id: 'US_SENATE', adapterId: 'us', aliases: Object.freeze(['US Senate', 'Senate Election', 'Federal Senate Election']), residenceScope: TERRITORY_SCOPES.ADMIN_LEVEL_1, contestIds: Object.freeze(['us.senate']) }),
  US_CONGRESSIONAL: Object.freeze({ id: 'US_CONGRESSIONAL', adapterId: 'us', aliases: Object.freeze(['Congressional', 'Congressional Election', 'Congress']), contestIds: Object.freeze(['us.house', 'us.senate']) }),
  US_STATE: Object.freeze({ id: 'US_STATE', adapterId: 'us', aliases: Object.freeze(['State Election', 'Statewide Election']), contestIds: Object.freeze(['us.governor', 'us.state.upper', 'us.state.lower']) }),
  US_LOCAL: Object.freeze({ id: 'US_LOCAL', adapterId: 'us', aliases: Object.freeze(['Local Election', 'Mayoral Election']), residenceScope: TERRITORY_SCOPES.MUNICIPALITY, contestIds: Object.freeze(['us.mayor']) }),
  US_GENERAL: Object.freeze({ id: 'US_GENERAL', adapterId: 'us', aliases: Object.freeze(['US General', 'General Election', 'General']), contestIds: Object.freeze(['us.president', 'us.house', 'us.senate', 'us.governor', 'us.state.upper', 'us.state.lower', 'us.mayor']) }),
});

const POLITICAL_ADAPTERS = Object.freeze({
  it: Object.freeze({
    id: 'it', jurisdictionId: 'it',
    officeIds: Object.freeze(Object.keys(POLITICAL_OFFICES).filter((id) => POLITICAL_OFFICES[id].adapterId === 'it')),
    contestIds: Object.freeze(Object.keys(ELECTION_CONTESTS).filter((id) => ELECTION_CONTESTS[id].adapterId === 'it')),
    electionTypeIds: Object.freeze(Object.keys(ELECTION_TYPES).filter((id) => ELECTION_TYPES[id].adapterId === 'it')),
    opinionScopeIds: Object.freeze(Object.keys(OPINION_SCOPES).filter((id) => OPINION_SCOPES[id].adapterId === 'it')),
  }),
  us: Object.freeze({
    id: 'us', jurisdictionId: 'us',
    officeIds: Object.freeze(Object.keys(POLITICAL_OFFICES).filter((id) => POLITICAL_OFFICES[id].adapterId === 'us')),
    contestIds: Object.freeze(Object.keys(ELECTION_CONTESTS).filter((id) => ELECTION_CONTESTS[id].adapterId === 'us')),
    electionTypeIds: Object.freeze(Object.keys(ELECTION_TYPES).filter((id) => ELECTION_TYPES[id].adapterId === 'us')),
    opinionScopeIds: Object.freeze(Object.keys(OPINION_SCOPES).filter((id) => OPINION_SCOPES[id].adapterId === 'us')),
  }),
});

module.exports = {
  LEGACY_DEFAULT_ADAPTER_ID,
  TERRITORY_SCOPES,
  OPINION_SCOPES,
  POLITICAL_OFFICES,
  ELECTION_CONTESTS,
  ELECTION_TYPES,
  POLITICAL_ADAPTERS,
};
