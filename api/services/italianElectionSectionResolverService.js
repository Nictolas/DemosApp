'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { POLITICAL_TERRITORY_RESOLVERS } = require('../config/politicalTerritoryResolvers');
const { persistOfficialElectoralUnitResolution } = require('./politicalTerritoryResolverService');

const RESOLVER_ID = 'it.municipal.sections.politiche-20220925';
let snapshotCache = null;
let indexCache = null;

function resolverConfig() {
  return POLITICAL_TERRITORY_RESOLVERS[RESOLVER_ID];
}

function snapshotPath() {
  return path.resolve(__dirname, '..', resolverConfig().snapshotPath);
}

function loadItalianElectionSectionSnapshot() {
  if (snapshotCache) return snapshotCache;
  const resolver = resolverConfig();
  const payload = JSON.parse(fs.readFileSync(snapshotPath(), 'utf8'));
  if (payload.sourceId !== resolver.electionSourceId || payload.electionDate !== resolver.referenceDate) {
    const error = new Error('Invalid Italian election section snapshot identity');
    error.code = 'ELECTION_SECTION_SNAPSHOT_INVALID';
    throw error;
  }
  if (!payload.municipalities || Number(payload.counts?.municipalities) !== Object.keys(payload.municipalities).length) {
    const error = new Error('Invalid Italian election section snapshot coverage');
    error.code = 'ELECTION_SECTION_SNAPSHOT_COVERAGE_INVALID';
    throw error;
  }
  const sectionCount = Object.values(payload.municipalities)
    .reduce((sum, municipality) => sum + Number(municipality.sectionCount || 0), 0);
  if (sectionCount !== Number(payload.counts?.sections)) {
    const error = new Error('Italian election section snapshot count mismatch');
    error.code = 'ELECTION_SECTION_SNAPSHOT_COUNT_MISMATCH';
    throw error;
  }
  snapshotCache = Object.freeze(payload);
  return snapshotCache;
}

function buildItalianElectionSectionIndex() {
  if (indexCache) return indexCache;
  const snapshot = loadItalianElectionSectionSnapshot();
  const municipalities = new Map();
  for (const [municipalityCode, municipality] of Object.entries(snapshot.municipalities)) {
    const bySection = new Map();
    for (const row of municipality.sections || []) {
      if (!Array.isArray(row) || row.length !== 5) {
        const error = new Error(`Invalid section row for municipality ${municipalityCode}`);
        error.code = 'ELECTION_SECTION_ROW_INVALID';
        throw error;
      }
      const [section, cameraUninominal, cameraPlurinominal, senatoUninominal, senatoPlurinominal] = row;
      const sectionKey = String(Number(section));
      if (!Number.isInteger(Number(section)) || Number(section) <= 0 || bySection.has(sectionKey)) {
        const error = new Error(`Invalid or duplicate section ${section} for municipality ${municipalityCode}`);
        error.code = 'ELECTION_SECTION_ROW_INVALID';
        throw error;
      }
      bySection.set(sectionKey, Object.freeze({
        section: Number(section),
        cameraUninominal,
        cameraPlurinominal,
        senatoUninominal,
        senatoPlurinominal,
      }));
    }
    if (bySection.size !== Number(municipality.sectionCount)) {
      const error = new Error(`Section count mismatch for municipality ${municipalityCode}`);
      error.code = 'ELECTION_SECTION_SNAPSHOT_COUNT_MISMATCH';
      throw error;
    }
    municipalities.set(municipalityCode, Object.freeze({
      municipalityCode,
      municipalityName: municipality.municipalityName,
      sourceKeys: Object.freeze([...(municipality.sourceKeys || [])]),
      bySection,
    }));
  }
  indexCache = Object.freeze({ municipalities });
  return indexCache;
}

function normalizeMunicipalityCode(value) {
  const raw = String(value ?? '').trim();
  return /^\d{6}$/.test(raw) ? raw : null;
}

function normalizeSectionNumber(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number > 0 ? String(number) : null;
}

function baseUnitLabel(value) {
  return String(value || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function municipalityRequiresSectionResolution(municipalityCode) {
  const code = normalizeMunicipalityCode(municipalityCode);
  return Boolean(code && buildItalianElectionSectionIndex().municipalities.has(code));
}

function resolveItalianElectionUnitsBySection({
  sourceId = 'POLITICHE_20220925', municipalityCode, sectionNumber,
} = {}) {
  const resolver = resolverConfig();
  if (sourceId !== resolver.electionSourceId) {
    return Object.freeze({ resolved: false, reason: 'ELECTION_SOURCE_NOT_SUPPORTED' });
  }
  const code = normalizeMunicipalityCode(municipalityCode);
  if (!code) return Object.freeze({ resolved: false, reason: 'MUNICIPALITY_CODE_REQUIRED' });
  const municipality = buildItalianElectionSectionIndex().municipalities.get(code);
  if (!municipality) return Object.freeze({ resolved: false, reason: 'SECTION_NOT_REQUIRED_FOR_MUNICIPALITY' });
  if (sectionNumber == null || String(sectionNumber).trim() === '') {
    return Object.freeze({ resolved: false, reason: 'SECTION_REQUIRED_FOR_SPLIT_MUNICIPALITY' });
  }
  const sectionKey = normalizeSectionNumber(sectionNumber);
  if (!sectionKey) return Object.freeze({ resolved: false, reason: 'SECTION_INVALID' });
  const row = municipality.bySection.get(sectionKey);
  if (!row) return Object.freeze({ resolved: false, reason: 'SECTION_NOT_FOUND' });

  const memberships = Object.freeze([
    Object.freeze({ officeId: 'it.camera', unitType: 'UNINOMINAL', unitLabel: row.cameraUninominal }),
    Object.freeze({ officeId: 'it.camera', unitType: 'PLURINOMINAL', unitLabel: row.cameraPlurinominal }),
    Object.freeze({ officeId: 'it.senato', unitType: 'UNINOMINAL', unitLabel: row.senatoUninominal }),
    Object.freeze({ officeId: 'it.senato', unitType: 'PLURINOMINAL', unitLabel: row.senatoPlurinominal }),
  ]);
  return Object.freeze({
    resolved: true,
    reason: null,
    resolverId: RESOLVER_ID,
    sourceId: resolver.electionSourceId,
    referenceDate: resolver.referenceDate,
    verificationLevel: resolver.membershipVerificationLevel,
    municipalityCode: code,
    municipalityName: municipality.municipalityName,
    sectionNumber: row.section,
    sourceKeys: municipality.sourceKeys,
    memberships,
  });
}

async function persistItalianElectionSectionResolution(db, {
  userId, electionEventId, sourceId = 'POLITICHE_20220925', municipalityCode, sectionNumber,
} = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('Database connection required');
  const resolution = resolveItalianElectionUnitsBySection({ sourceId, municipalityCode, sectionNumber });
  if (!resolution.resolved) return { ...resolution, written: 0 };

  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const ownsTransaction = client !== db;
  try {
    if (ownsTransaction) await client.query('BEGIN');
    const labels = resolution.memberships.map((membership) => membership.unitLabel);
    const lookup = await client.query(
      `SELECT id::text AS id, label, unit_type, metadata->>'officeId' AS office_id
       FROM unita_elettorale
       WHERE evento_id = $1
         AND metadata->>'officeId' = ANY($2::text[])
         AND regexp_replace(label, '\\s*\\([^)]*\\)\\s*$', '') = ANY($3::text[])`,
      [electionEventId, ['it.camera', 'it.senato'], labels],
    );
    const idsByKey = new Map();
    for (const row of lookup.rows || []) {
      const canonicalLabel = baseUnitLabel(row.label);
      const key = `${row.office_id}|${String(row.unit_type || '').toUpperCase()}|${canonicalLabel}`;
      if (idsByKey.has(key)) {
        const error = new Error(`Duplicate electoral unit for ${key}`);
        error.code = 'ELECTION_SECTION_UNIT_AMBIGUOUS';
        throw error;
      }
      idsByKey.set(key, String(row.id));
    }

    const idsByOffice = new Map([['it.camera', []], ['it.senato', []]]);
    for (const membership of resolution.memberships) {
      const key = `${membership.officeId}|${membership.unitType}|${membership.unitLabel}`;
      const id = idsByKey.get(key);
      if (!id) {
        const error = new Error(`Electoral unit is not ingested for section resolution: ${key}`);
        error.code = 'ELECTION_SECTION_UNIT_NOT_INGESTED';
        throw error;
      }
      idsByOffice.get(membership.officeId).push(id);
    }

    let written = 0;
    const persisted = [];
    for (const officeId of ['it.camera', 'it.senato']) {
      const result = await persistOfficialElectoralUnitResolution(client, {
        resolverId: RESOLVER_ID,
        userId,
        electionEventId,
        officeId,
        electoralUnitIds: idsByOffice.get(officeId),
        evidence: {
          electionSourceId: resolution.sourceId,
          municipalityCode: resolution.municipalityCode,
          municipalityName: resolution.municipalityName,
          sectionNumber: resolution.sectionNumber,
          sourceKeys: resolution.sourceKeys,
          referenceDate: resolution.referenceDate,
        },
      });
      written += Number(result.written || 0);
      persisted.push(result);
    }
    if (ownsTransaction) await client.query('COMMIT');
    return { ...resolution, written, persisted: Object.freeze(persisted) };
  } catch (error) {
    if (ownsTransaction) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (ownsTransaction && typeof client.release === 'function') client.release();
  }
}

module.exports = {
  RESOLVER_ID,
  loadItalianElectionSectionSnapshot,
  buildItalianElectionSectionIndex,
  municipalityRequiresSectionResolution,
  resolveItalianElectionUnitsBySection,
  persistItalianElectionSectionResolution,
};
