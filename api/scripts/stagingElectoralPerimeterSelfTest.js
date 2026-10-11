'use strict';

const { getPool } = require('../config/database');
const { E2E_USER_ID } = require('./stagingMigrate');
const {
  ingestItalianElectionUnitSnapshot,
  getElectionUnitImportStatus,
} = require('../services/italianElectionUnitIngestionService');
const {
  RESOLVER_ID,
  loadItalianElectionSectionSnapshot,
  persistItalianElectionSectionResolution,
} = require('../services/italianElectionSectionResolverService');

const FIXTURE_EVENT_ID = '00000000-0000-4000-8000-000000001313';
const SOURCE_ID = 'POLITICHE_20220925';
const SPLIT_MUNICIPALITY_CODE = '001272';
const SPLIT_SECTION_NUMBER = 1;
const EXPECTED = Object.freeze({
  units: 296,
  mappings: 31753,
  municipalityMappings: 31085,
  subMunicipalMappings: 668,
  eligibilityReadyUnits: 254,
  splitMunicipalities: 6,
  splitSections: 6909,
});

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function cleanupFixture(db) {
  await db.query(
    `DELETE FROM user_electoral_unit_memberships
     WHERE election_event_id = $1`,
    [FIXTURE_EVENT_ID],
  );
  await db.query(
    `DELETE FROM unita_elettorale_territorio
     WHERE unita_elettorale_id IN (
       SELECT id FROM unita_elettorale WHERE evento_id = $1
     )`,
    [FIXTURE_EVENT_ID],
  );
  await db.query('DELETE FROM unita_elettorale WHERE evento_id = $1', [FIXTURE_EVENT_ID]);
  await db.query('DELETE FROM eventi WHERE id = $1', [FIXTURE_EVENT_ID]);
}

async function verifyCleanup(db) {
  const result = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM eventi WHERE id = $1) AS events,
       (SELECT COUNT(*)::int FROM unita_elettorale WHERE evento_id = $1) AS units,
       (SELECT COUNT(*)::int FROM user_electoral_unit_memberships WHERE election_event_id = $1) AS memberships`,
    [FIXTURE_EVENT_ID],
  );
  const row = result.rows[0] || {};
  assertEqual(Number(row.events || 0), 0, 'cleanup events');
  assertEqual(Number(row.units || 0), 0, 'cleanup units');
  assertEqual(Number(row.memberships || 0), 0, 'cleanup memberships');
}

async function runStagingElectoralPerimeterSelfTest({
  env = process.env,
  pool = null,
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_ELECTORAL_PERIMETER_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 6 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('electoral perimeter staging E2E allowed only with NODE_ENV=staging');
  }

  const dbPool = pool || getPool();
  const client = await dbPool.connect();
  let inTransaction = false;
  let passed = 0;

  try {
    await cleanupFixture(client);

    const sections = loadItalianElectionSectionSnapshot();
    assertEqual(Number(sections.counts?.municipalities || 0), EXPECTED.splitMunicipalities, 'split municipalities snapshot');
    assertEqual(Number(sections.counts?.sections || 0), EXPECTED.splitSections, 'split sections snapshot');
    passed += 1;
    logger.log('[staging-electoral-e2e] official split-city section snapshot 6/6909 PASS');

    await client.query('BEGIN');
    inTransaction = true;
    await client.query(
      `INSERT INTO eventi (
         id, nome_evento, tipologia_evento, paese_evento,
         giorno_inizio, giorno_fine, tipo_elezione
       ) VALUES ($1,$2,'Elezioni','Italia',$3,$3,'Politiche')`,
      [FIXTURE_EVENT_ID, 'DEMOS E2E F12-13 Politiche 2022', '2022-09-25'],
    );

    const transactionDb = {
      query: (...args) => client.query(...args),
    };
    const imported = await ingestItalianElectionUnitSnapshot({
      db: transactionDb,
      eventId: FIXTURE_EVENT_ID,
      sourceId: SOURCE_ID,
      verifySources: false,
    });
    assertEqual(imported.available, true, 'electoral schema available');
    assertEqual(Number(imported.units || 0), EXPECTED.units, 'imported units');
    assertEqual(Number(imported.mappings || 0), EXPECTED.mappings, 'imported mappings');
    passed += 1;
    logger.log('[staging-electoral-e2e] 296 units + 31,753 mappings imported PASS');

    const status = await getElectionUnitImportStatus(client, {
      eventId: FIXTURE_EVENT_ID,
      sourceId: SOURCE_ID,
    });
    assertEqual(status.complete, true, 'import complete');
    assertEqual(status.units, EXPECTED.units, 'status units');
    assertEqual(status.mappedUnits, EXPECTED.units, 'status mapped units');
    assertEqual(status.eligibilityReadyUnits, EXPECTED.eligibilityReadyUnits, 'municipality-only ready units');
    assertEqual(status.eligibilityResolutionComplete, false, 'split units must still require finer resolution');
    passed += 1;
    logger.log('[staging-electoral-e2e] 296/296 mapped; 254 municipality-ready units PASS');

    const mappings = await client.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE uet.territory_type = 'MUNICIPALITY')::int AS municipality,
         COUNT(*) FILTER (WHERE uet.territory_type = 'SUB_MUNICIPAL_AREA')::int AS sub_municipal,
         COUNT(*) FILTER (WHERE uet.territory_type = 'OFFICIAL_AREA')::int AS official_area
       FROM unita_elettorale_territorio uet
       JOIN unita_elettorale ue ON ue.id = uet.unita_elettorale_id
       WHERE ue.evento_id = $1`,
      [FIXTURE_EVENT_ID],
    );
    const mappingRow = mappings.rows[0] || {};
    assertEqual(Number(mappingRow.total || 0), EXPECTED.mappings, 'mapping total');
    assertEqual(Number(mappingRow.municipality || 0), EXPECTED.municipalityMappings, 'municipality mappings');
    assertEqual(Number(mappingRow.sub_municipal || 0), EXPECTED.subMunicipalMappings, 'sub-municipal mappings');
    assertEqual(Number(mappingRow.official_area || 0), 0, 'official-area placeholders');
    passed += 1;
    logger.log('[staging-electoral-e2e] mapping breakdown 31,085 + 668 + 0 placeholders PASS');

    const officeCounts = await client.query(
      `SELECT metadata->>'officeId' AS office_id, unit_type, COUNT(*)::int AS count
       FROM unita_elettorale
       WHERE evento_id = $1
       GROUP BY metadata->>'officeId', unit_type`,
      [FIXTURE_EVENT_ID],
    );
    const countMap = new Map(officeCounts.rows.map((row) => [`${row.office_id}:${row.unit_type}`, Number(row.count)]));
    assertEqual(countMap.get('it.camera:UNINOMINAL'), 147, 'Camera uninominal');
    assertEqual(countMap.get('it.camera:PLURINOMINAL'), 49, 'Camera plurinominal');
    assertEqual(countMap.get('it.senato:UNINOMINAL'), 74, 'Senato uninominal');
    assertEqual(countMap.get('it.senato:PLURINOMINAL'), 26, 'Senato plurinominal');
    passed += 1;
    logger.log('[staging-electoral-e2e] constitutional unit counts 147/49/74/26 PASS');

    const sectionResolution = await persistItalianElectionSectionResolution(transactionDb, {
      userId: E2E_USER_ID,
      electionEventId: FIXTURE_EVENT_ID,
      sourceId: SOURCE_ID,
      municipalityCode: SPLIT_MUNICIPALITY_CODE,
      sectionNumber: SPLIT_SECTION_NUMBER,
    });
    assertEqual(sectionResolution.resolved, true, 'split city resolution');
    assertEqual(sectionResolution.written, 4, 'split city memberships written');
    assertEqual(sectionResolution.verificationLevel, 'OFFICIAL', 'split city verification level');

    const memberships = await client.query(
      `SELECT political_office_id, verification_level, COUNT(*)::int AS count
       FROM user_electoral_unit_memberships
       WHERE user_id = $1 AND election_event_id = $2 AND source = $3 AND valid_to IS NULL
       GROUP BY political_office_id, verification_level`,
      [E2E_USER_ID, FIXTURE_EVENT_ID, RESOLVER_ID],
    );
    const membershipMap = new Map(memberships.rows.map((row) => [`${row.political_office_id}:${row.verification_level}`, Number(row.count)]));
    assertEqual(membershipMap.get('it.camera:OFFICIAL'), 2, 'Camera official memberships');
    assertEqual(membershipMap.get('it.senato:OFFICIAL'), 2, 'Senato official memberships');
    passed += 1;
    logger.log('[staging-electoral-e2e] split-city OFFICIAL section resolver 4/4 memberships PASS');

    await client.query('ROLLBACK');
    inTransaction = false;
    await cleanupFixture(client);
    await verifyCleanup(client);
    logger.log('[staging-electoral-e2e] cleanup PASS');
    logger.log(`[staging-electoral-e2e] PASS ${passed}/6`);
    return { mode: 'enabled', passed, total: 6 };
  } catch (error) {
    if (inTransaction) await client.query('ROLLBACK').catch(() => {});
    await cleanupFixture(client).catch((cleanupError) => {
      logger.error(`[staging-electoral-e2e] cleanup FAILED: ${cleanupError.message}`);
    });
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runStagingElectoralPerimeterSelfTest().catch((error) => {
    console.error(`[staging-electoral-e2e] FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  FIXTURE_EVENT_ID,
  SOURCE_ID,
  SPLIT_MUNICIPALITY_CODE,
  SPLIT_SECTION_NUMBER,
  EXPECTED,
  runStagingElectoralPerimeterSelfTest,
};
