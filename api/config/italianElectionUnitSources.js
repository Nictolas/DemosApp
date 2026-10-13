'use strict';

const path = require('path');

const ITALIAN_ELECTION_UNIT_SOURCES = Object.freeze({
  POLITICHE_20220925: Object.freeze({
    id: 'POLITICHE_20220925',
    adapterId: 'it',
    jurisdictionId: 'it',
    electionType: 'NATIONAL',
    electionDate: '2022-09-25',
    authority: 'Ministero dell’Interno - DAIT',
    sourcePage: 'https://dait.interno.gov.it/elezioni/trasparenza/elezioni-politiche-2022',
    snapshotPath: path.join(__dirname, '..', 'data', 'official', 'it', 'dait-politiche-20220925-units.json'),
    perimeterSnapshotPath: path.join(__dirname, '..', 'data', 'official', 'it', 'gazzetta-dlgs177-2020-perimeters.json'),
    perimeterAuthority: 'Gazzetta Ufficiale della Repubblica Italiana',
    perimeterLegalBasis: 'Decreto legislativo 23 dicembre 2020, n. 177',
    mappingAuthorityRequired: true,
    expectedUnitCounts: Object.freeze({
      'it.camera:UNINOMINAL': 147,
      'it.camera:PLURINOMINAL': 49,
      'it.senato:UNINOMINAL': 74,
      'it.senato:PLURINOMINAL': 26,
    }),
  }),
});

function getItalianElectionUnitSource(sourceId) {
  return ITALIAN_ELECTION_UNIT_SOURCES[String(sourceId || '').trim().toUpperCase()] || null;
}

module.exports = {
  ITALIAN_ELECTION_UNIT_SOURCES,
  getItalianElectionUnitSource,
};
