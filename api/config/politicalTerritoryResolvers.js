'use strict';

const { TERRITORY_SCOPES } = require('./politicalJurisdictions');

const POLITICAL_TERRITORY_RESOLVERS = Object.freeze({
  'it.istat.situas': Object.freeze({
    id: 'it.istat.situas',
    adapterId: 'it',
    jurisdictionId: 'it',
    kind: 'ADMINISTRATIVE_CATALOG',
    eventScoped: false,
    membershipVerificationLevel: 'VERIFIED',
    territoryScopes: Object.freeze([
      TERRITORY_SCOPES.COUNTRY,
      TERRITORY_SCOPES.ADMIN_LEVEL_1,
      TERRITORY_SCOPES.ADMIN_LEVEL_2,
      TERRITORY_SCOPES.MUNICIPALITY,
    ]),
    sourceUrl: 'https://situas.istat.it/ShibO2Module/api/Report/Spool/2026-10-09/61?pdoctype=CSV',
    sourcePageUrl: 'https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/',
    snapshotPath: 'data/official/it/istat-comuni-2026-10-09.json',
    referenceDate: '2026-10-09',
  }),
  'it.municipal.sections.politiche-20220925': Object.freeze({
    id: 'it.municipal.sections.politiche-20220925',
    adapterId: 'it',
    jurisdictionId: 'it',
    kind: 'ELECTORAL_UNIT',
    eventScoped: true,
    electionSourceId: 'POLITICHE_20220925',
    membershipVerificationLevel: 'OFFICIAL',
    territoryScopes: Object.freeze([TERRITORY_SCOPES.ELECTORAL_DISTRICT]),
    snapshotPath: 'data/official/it/politiche-20220925-section-districts.json',
    referenceDate: '2022-09-25',
  }),
  'it.interno.eligendo': Object.freeze({
    id: 'it.interno.eligendo',
    adapterId: 'it',
    jurisdictionId: 'it',
    kind: 'ELECTORAL_UNIT',
    eventScoped: true,
    membershipVerificationLevel: 'OFFICIAL',
    territoryScopes: Object.freeze([TERRITORY_SCOPES.ELECTORAL_DISTRICT]),
    sourceUrl: 'https://elezioni.interno.gov.it/',
    sourcePageUrl: 'https://www.interno.gov.it/it/temi/elezioni-e-referendum/dato-storico-elezioni',
  }),
});

module.exports = { POLITICAL_TERRITORY_RESOLVERS };
