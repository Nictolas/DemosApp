'use strict';

const fs = require('fs');
const crypto = require('crypto');
const {
  getItalianElectionUnitSource,
} = require('../config/italianElectionUnitSources');
const {
  normalizeElectionType,
  getElectionOfficeIds,
  resolvePoliticalOffice,
} = require('./politicalJurisdictionRegistryService');

const SCHEMA_COMPAT_ERROR_CODES = new Set(['42P01', '42703']);

function sourceError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

function buildUnitCode(sourceId, unit) {
  const office = String(unit?.officeId || '').replace(/^it\./, '').toUpperCase();
  const kind = String(unit?.unitType || '').toUpperCase();
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${sourceId}|${unit?.officeId || ''}|${kind}|${unit?.circumscription || ''}|${unit?.label || ''}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  return `DAIT:${sourceId}:${office}:${kind}:${slug(unit?.circumscription)}:${fingerprint}`;
}

function loadElectionUnitManifest(sourceId = 'POLITICHE_20220925') {
  const source = getItalianElectionUnitSource(sourceId);
  if (!source) throw sourceError('ELECTION_UNIT_SOURCE_UNKNOWN');
  const manifest = JSON.parse(fs.readFileSync(source.snapshotPath, 'utf8'));
  validateElectionUnitManifest(manifest, source);
  return manifest;
}

function baseUnitLabel(value) {
  return String(value || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function unitManifestKey(unit) {
  return `${String(unit?.officeId || '')}|${String(unit?.unitType || '').toUpperCase()}|${baseUnitLabel(unit?.unitLabel || unit?.label)}`;
}

function loadElectionPerimeterManifest(sourceId = 'POLITICHE_20220925') {
  const source = getItalianElectionUnitSource(sourceId);
  if (!source) throw sourceError('ELECTION_UNIT_SOURCE_UNKNOWN');
  if (!source.perimeterSnapshotPath) return null;
  const perimeter = JSON.parse(fs.readFileSync(source.perimeterSnapshotPath, 'utf8'));
  const unitManifest = loadElectionUnitManifest(sourceId);
  validateElectionPerimeterManifest(perimeter, source, unitManifest);
  return perimeter;
}

function validateElectionPerimeterManifest(perimeter, source, unitManifest) {
  if (!perimeter || !Array.isArray(perimeter.units) || perimeter.mappingComplete !== true) {
    throw sourceError('ELECTION_PERIMETER_MANIFEST_INVALID');
  }
  if (perimeter.consultationId !== source.id) {
    throw sourceError('ELECTION_PERIMETER_SOURCE_MISMATCH');
  }
  const expected = new Set(unitManifest.units.map(unitManifestKey));
  const seen = new Set();
  const allowedTypes = new Set(['MUNICIPALITY', 'SUB_MUNICIPAL_AREA']);
  let mappings = 0;
  for (const unit of perimeter.units) {
    const key = unitManifestKey(unit);
    if (!expected.has(key) || seen.has(key) || unit.mappingComplete !== true || !Array.isArray(unit.territories) || !unit.territories.length) {
      throw sourceError('ELECTION_PERIMETER_UNIT_INVALID', key);
    }
    seen.add(key);
    for (const territory of unit.territories) {
      if (!allowedTypes.has(String(territory?.territoryType || '').toUpperCase()) || !territory?.territoryCode) {
        throw sourceError('ELECTION_PERIMETER_TERRITORY_INVALID', key);
      }
      mappings += 1;
    }
  }
  if (seen.size !== expected.size) throw sourceError('ELECTION_PERIMETER_COVERAGE_MISMATCH');
  if (!Array.isArray(perimeter.subMunicipalResolutionRequired)) {
    throw sourceError('ELECTION_PERIMETER_RESOLUTION_METADATA_REQUIRED');
  }
  return {
    valid: true,
    unitCount: seen.size,
    mappingCount: mappings,
    eligibilityReadyUnits: Number(perimeter.counts?.eligibilityReadyUnits || 0),
    eligibilityResolutionComplete: perimeter.eligibilityResolutionComplete === true,
  };
}

function buildPerimeterLookup(perimeter) {
  return new Map((perimeter?.units || []).map((unit) => [unitManifestKey(unit), unit]));
}

function validateElectionUnitManifest(manifest, source = null) {
  if (!manifest || !manifest.consultationId || !Array.isArray(manifest.units) || !Array.isArray(manifest.sources)) {
    throw sourceError('ELECTION_UNIT_MANIFEST_INVALID');
  }
  if (source && manifest.consultationId !== source.id) {
    throw sourceError('ELECTION_UNIT_MANIFEST_SOURCE_MISMATCH');
  }
  const seen = new Set();
  const counts = new Map();
  for (const unit of manifest.units) {
    const office = resolvePoliticalOffice(unit.officeId, { adapterId: 'it' });
    if (!office || !unit.label || !unit.unitType || !unit.circumscription) {
      throw sourceError('ELECTION_UNIT_MANIFEST_UNIT_INVALID');
    }
    const key = `${unit.officeId}|${unit.unitType}|${unit.circumscription}|${unit.label}`;
    if (seen.has(key)) throw sourceError('ELECTION_UNIT_MANIFEST_DUPLICATE');
    seen.add(key);
    const countKey = `${unit.officeId}:${unit.unitType}`;
    counts.set(countKey, (counts.get(countKey) || 0) + 1);
  }
  if (source?.expectedUnitCounts) {
    for (const [key, expected] of Object.entries(source.expectedUnitCounts)) {
      if ((counts.get(key) || 0) !== expected) {
        throw sourceError('ELECTION_UNIT_MANIFEST_COUNT_MISMATCH', `${key}: expected ${expected}, got ${counts.get(key) || 0}`);
      }
    }
  }
  return { valid: true, unitCount: manifest.units.length, counts };
}

async function getElectionUnitSchemaStatus(db) {
  try {
    const result = await db.query(
      `SELECT
         to_regclass('public.eventi') AS events_table,
         to_regclass('public.unita_elettorale') AS units_table,
         to_regclass('public.unita_elettorale_territorio') AS mappings_table`
    );
    const row = result.rows[0] || {};
    return {
      available: Boolean(row.events_table && row.units_table && row.mappings_table),
      ...row,
    };
  } catch (error) {
    if (SCHEMA_COMPAT_ERROR_CODES.has(error?.code)) return { available: false };
    throw error;
  }
}

async function validateEventForElectionUnitSource(db, { eventId, sourceId = 'POLITICHE_20220925' } = {}) {
  const source = getItalianElectionUnitSource(sourceId);
  if (!source) throw sourceError('ELECTION_UNIT_SOURCE_UNKNOWN');
  const result = await db.query(
    `SELECT id::text AS id, tipologia_evento, tipo_elezione,
            giorno_inizio::date::text AS giorno_inizio,
            COALESCE(giorno_fine, giorno_inizio)::date::text AS giorno_fine
     FROM eventi WHERE id = $1`,
    [eventId]
  );
  const event = result.rows[0];
  if (!event) throw sourceError('ELECTION_EVENT_NOT_FOUND');
  if (String(event.tipologia_evento || '').trim().toLowerCase() !== 'elezioni') {
    throw sourceError('ELECTION_SOURCE_EVENT_KIND_MISMATCH');
  }
  const eventType = normalizeElectionType(event.tipo_elezione, { adapterId: 'it' });
  if (eventType !== source.electionType) {
    throw sourceError('ELECTION_SOURCE_EVENT_TYPE_MISMATCH');
  }
  if (normalizeDate(event.giorno_inizio) !== source.electionDate) {
    throw sourceError('ELECTION_SOURCE_EVENT_DATE_MISMATCH');
  }
  const officeIds = new Set(getElectionOfficeIds(event.tipo_elezione, { adapterId: 'it' }));
  for (const unit of loadElectionUnitManifest(sourceId).units) {
    if (!officeIds.has(unit.officeId)) throw sourceError('ELECTION_SOURCE_OFFICE_NOT_IN_EVENT');
  }
  return { event, source, officeIds: [...officeIds] };
}

async function verifyOfficialSnapshotSources({ sourceId = 'POLITICHE_20220925', fetchImpl = global.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw sourceError('ELECTION_SOURCE_FETCH_UNAVAILABLE');
  const manifest = loadElectionUnitManifest(sourceId);
  const results = [];
  for (const source of manifest.sources) {
    const response = await fetchImpl(source.url, { headers: { accept: 'text/csv,*/*;q=0.8' } });
    if (!response?.ok) throw sourceError('ELECTION_SOURCE_FETCH_FAILED', `${response?.status || 'unknown'} ${source.url}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
    if (sha256 !== String(source.sha256 || '').toUpperCase()) {
      throw sourceError('ELECTION_SOURCE_HASH_MISMATCH', source.url);
    }
    results.push({ url: source.url, sha256, verified: true });
  }
  return { verified: true, sources: results };
}

function unitMetadata({ source, manifest, unit, code, perimeterUnit = null, perimeterManifest = null }) {
  return {
    sourceAuthority: manifest.authority,
    sourceConsultationId: manifest.consultationId,
    sourcePage: manifest.sourcePage,
    sourceRetrievedOn: manifest.retrievedOn,
    sourceImportKey: code,
    officeId: unit.officeId,
    circumscription: unit.circumscription,
    mappingComplete: perimeterUnit?.mappingComplete === true || unit.mappingComplete === true,
    mappingAuthorityRequired: source.mappingAuthorityRequired === true,
    perimeterSourceId: perimeterManifest?.sourceId || null,
    perimeterAuthority: perimeterManifest?.authority || null,
    perimeterLegalBasis: perimeterManifest?.legalBasis || null,
    containsNonMunicipalAreas: perimeterUnit?.containsNonMunicipalAreas === true,
    eligibilityReady: perimeterUnit ? perimeterUnit.containsNonMunicipalAreas !== true : false,
    requiresSubMunicipalResolution: perimeterUnit?.containsNonMunicipalAreas === true,
  };
}

async function ingestItalianElectionUnitSnapshot({
  db,
  eventId,
  sourceId = 'POLITICHE_20220925',
  verifySources = false,
  fetchImpl = global.fetch,
} = {}) {
  if (!db || typeof db.query !== 'function') throw sourceError('DATABASE_REQUIRED');
  const schema = await getElectionUnitSchemaStatus(db);
  if (!schema.available) {
    return { available: false, sourceId, eventId, units: 0, mappings: 0, reason: 'CAPABILITY_SCHEMA_REQUIRED' };
  }
  const { source } = await validateEventForElectionUnitSource(db, { eventId, sourceId });
  const manifest = loadElectionUnitManifest(sourceId);
  const perimeterManifest = loadElectionPerimeterManifest(sourceId);
  const perimeterLookup = buildPerimeterLookup(perimeterManifest);
  if (verifySources) await verifyOfficialSnapshotSources({ sourceId, fetchImpl });

  const client = typeof db.connect === 'function' ? await db.connect() : db;
  const ownsTransaction = client !== db;
  let units = 0;
  let mappings = 0;
  try {
    if (ownsTransaction) await client.query('BEGIN');
    for (const unit of manifest.units) {
      const code = buildUnitCode(sourceId, unit);
      const perimeterUnit = perimeterLookup.get(unitManifestKey(unit)) || null;
      const metadata = unitMetadata({ source, manifest, unit, code, perimeterUnit, perimeterManifest });
      const unitResult = await client.query(
        `INSERT INTO unita_elettorale (evento_id, code, label, unit_type, metadata)
         VALUES ($1,$2,$3,$4,$5::jsonb)
         ON CONFLICT (evento_id, code) WHERE code IS NOT NULL
         DO UPDATE SET
           label = EXCLUDED.label,
           unit_type = EXCLUDED.unit_type,
           metadata = COALESCE(unita_elettorale.metadata, '{}'::jsonb) || EXCLUDED.metadata
         RETURNING id::text AS id`,
        [eventId, code, unit.label, unit.unitType, JSON.stringify(metadata)]
      );
      const electoralUnitId = unitResult.rows[0]?.id;
      if (!electoralUnitId) throw sourceError('ELECTION_UNIT_UPSERT_FAILED');
      units += 1;

      const territories = perimeterUnit?.territories || unit.territories || [];
      await client.query(
        `DELETE FROM unita_elettorale_territorio
         WHERE unita_elettorale_id = $1
           AND metadata->>'sourceImportKey' = $2`,
        [electoralUnitId, code]
      );
      if (territories.length) {
        const mappingRows = territories.map((territory) => ({
          territory_type: String(territory.territoryType).toUpperCase(),
          territory_code: String(territory.territoryCode),
          metadata: {
            sourceImportKey: code,
            sourceConsultationId: manifest.consultationId,
            perimeterSourceId: perimeterManifest?.sourceId || null,
            perimeterAuthority: perimeterManifest?.authority || null,
            mappingResolution: territory.resolution || null,
            mappingSourceLabel: territory.sourceLabel || territory.label || null,
            parentMunicipalityCode: territory.parentMunicipalityCode || null,
          },
        }));
        await client.query(
          `INSERT INTO unita_elettorale_territorio (
             unita_elettorale_id, regione_codice, territory_type, territory_code, metadata
           )
           SELECT $1, NULL, item.territory_type, item.territory_code, item.metadata
           FROM jsonb_to_recordset($2::jsonb)
             AS item(territory_type text, territory_code text, metadata jsonb)`,
          [electoralUnitId, JSON.stringify(mappingRows)]
        );
        mappings += mappingRows.length;
      }
    }
    if (ownsTransaction) await client.query('COMMIT');
  } catch (error) {
    if (ownsTransaction) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (ownsTransaction && typeof client.release === 'function') client.release();
  }

  return {
    available: true,
    sourceId,
    eventId,
    units,
    mappings,
    mappingComplete: perimeterManifest?.mappingComplete === true || manifest.mappingComplete === true,
    eligibilityReadyUnits: Number(perimeterManifest?.counts?.eligibilityReadyUnits || 0),
    eligibilityResolutionComplete: perimeterManifest?.eligibilityResolutionComplete === true,
    sourceVerified: verifySources,
  };
}

async function getElectionUnitImportStatus(db, { eventId, sourceId = 'POLITICHE_20220925' } = {}) {
  const manifest = loadElectionUnitManifest(sourceId);
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS units,
       COUNT(*) FILTER (WHERE COALESCE((metadata->>'mappingComplete')::boolean, false))::int AS mapped_units,
       COUNT(*) FILTER (WHERE COALESCE((metadata->>'eligibilityReady')::boolean, false))::int AS eligibility_ready_units
     FROM unita_elettorale
     WHERE evento_id = $1
       AND metadata->>'sourceConsultationId' = $2`,
    [eventId, manifest.consultationId]
  );
  const row = result.rows[0] || { units: 0, mapped_units: 0, eligibility_ready_units: 0 };
  const units = Number(row.units || 0);
  const mappedUnits = Number(row.mapped_units || 0);
  const eligibilityReadyUnits = Number(row.eligibility_ready_units || 0);
  return {
    sourceId,
    expectedUnits: manifest.units.length,
    units,
    mappedUnits,
    eligibilityReadyUnits,
    complete: units === manifest.units.length && mappedUnits === manifest.units.length,
    eligibilityResolutionComplete: units === manifest.units.length && eligibilityReadyUnits === manifest.units.length,
  };
}

module.exports = {
  buildUnitCode,
  loadElectionUnitManifest,
  loadElectionPerimeterManifest,
  validateElectionUnitManifest,
  validateElectionPerimeterManifest,
  unitManifestKey,
  getElectionUnitSchemaStatus,
  validateEventForElectionUnitSource,
  verifyOfficialSnapshotSources,
  ingestItalianElectionUnitSnapshot,
  getElectionUnitImportStatus,
};
