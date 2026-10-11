'use strict';

const { getPool } = require('../config/database');
const ministeroSync = require('../services/ministeroSync');
const { syncItalianPopularInitiativesSources } = require('../services/italianPopularInitiativesParliamentSyncService');
const { E2E_USER_ID, E2E_ADMIN_USER_ID } = require('./stagingMigrate');

const SYNTHETIC_TITLE = 'DEMOS STAGING F12-23 realization E2E';
const SYNTHETIC_NORMALIZED_TITLE = 'demos staging f12 23 realization e2e';

async function requestJson(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  let body = null;
  try { body = await response.json(); } catch (_) {}
  return { response, body };
}

async function diagnoseIdentifierConflict(pool, error) {
  const identifiers = Array.isArray(error?.officialIdentifiers) ? error.officialIdentifiers : [];
  const source = await pool.query(
    `SELECT csr.id AS source_record_id, csr.civic_process_id, cp.canonical_title,
            cp.official_reference, csr.source_title
       FROM civic_process_source_records csr
       JOIN civic_processes cp ON cp.id = csr.civic_process_id
      WHERE csr.source_id = $1 AND csr.external_id = $2
      LIMIT 1`,
    [error.sourceId, error.externalId]
  );

  const ownership = [];
  for (const identifier of identifiers) {
    const result = await pool.query(
      `SELECT cpi.namespace, cpi.value, cpi.civic_process_id,
              cp.canonical_title, cp.official_reference
         FROM civic_process_identifiers cpi
         JOIN civic_processes cp ON cp.id = cpi.civic_process_id
        WHERE cpi.namespace = $1 AND cpi.value = $2
        LIMIT 1`,
      [identifier.namespace, identifier.value]
    );
    ownership.push({ identifier, owner: result.rows[0] || null });
  }

  return { existingSource: source.rows[0] || null, identifierOwnership: ownership };
}

async function runStagingCivicSourcesSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  logger = console,
} = {}) {
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_CIVIC_SOURCES_E2E is allowed only with NODE_ENV=staging');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging civic sources E2E');

  const pool = getPool();
  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const baseUrl = `http://127.0.0.1:${port}`;

  const ministry = await ministeroSync.syncAll();
  const ministryProcessed = Number(ministry?.created || 0) + Number(ministry?.updated || 0);
  if (Number(ministry?.errors || 0) !== 0 || ministryProcessed <= 0) {
    throw new Error(`F12-23 Ministero sync failed: processed=${ministryProcessed}, errors=${ministry?.errors ?? 'n/a'}`);
  }
  logger.log(`[staging-civic-sources-e2e] Ministero official sync PASS processed=${ministryProcessed}`);

  const canonical = await syncItalianPopularInitiativesSources({ pool });
  const ministeroStats = canonical?.sources?.ministero;
  if (!ministeroStats || ministeroStats.fetched <= 0 || ministeroStats.ingested !== ministeroStats.fetched || ministeroStats.errors?.length) {
    throw new Error(`F12-23 canonical Ministero ingest failed: ${JSON.stringify(ministeroStats || null)}`);
  }
  logger.log(`[staging-civic-sources-e2e] canonical Ministero ingest PASS ${ministeroStats.ingested}/${ministeroStats.fetched}`);

  for (const source of ['camera', 'senato']) {
    const stats = canonical?.sources?.[source];
    if (!stats || stats.fetched <= 0 || stats.ingested <= 0) {
      throw new Error(`F12-23 ${source} official source unavailable: ${JSON.stringify(stats || null)}`);
    }
    if (stats.errors?.length) {
      logger.warn(`[staging-civic-sources-e2e] ${source} partial errors: ${JSON.stringify(stats.errors)}`);
      for (const error of stats.errors) {
        if (error.code === 'CIVIC_IDENTIFIER_CONFLICT' && error.sourceId && error.externalId) {
          const diagnostic = await diagnoseIdentifierConflict(pool, error);
          logger.warn(`[staging-civic-sources-e2e] identifier conflict diagnostic: ${JSON.stringify(diagnostic)}`);
        }
      }
    }
    logger.log(`[staging-civic-sources-e2e] ${source} official ingest PASS ${stats.ingested}/${stats.fetched}`);
  }

  const sourceStatus = await pool.query(`
    SELECT
      COUNT(*)::int AS source_records,
      COUNT(*) FILTER (
        WHERE cp.process_type_id = 'it.popular_law_initiative'
          AND csr.source_stage IN ('collection_closed','qualified')
          AND COALESCE((csr.payload_metadata->>'signatures')::int, 0) >= 50000
          AND COALESCE((csr.payload_metadata->>'quorumReached')::boolean, false) = true
      )::int AS priority_source_records
    FROM civic_process_source_records csr
    JOIN civic_processes cp ON cp.id = csr.civic_process_id
    WHERE csr.source_id = 'it.justice.signature_portal'
  `);
  const sourceRow = sourceStatus.rows[0] || {};
  if (Number(sourceRow.source_records || 0) <= 0) {
    throw new Error('F12-23 canonical signature source contains no records');
  }
  logger.log(`[staging-civic-sources-e2e] canonical signature records PASS total=${sourceRow.source_records} priority=${sourceRow.priority_source_records}`);

  await pool.query(
    `DELETE FROM civic_processes
      WHERE jurisdiction_id='it' AND process_type_id='it.popular_law_initiative' AND canonical_title=$1`,
    [SYNTHETIC_TITLE]
  );

  const inserted = await pool.query(
    `INSERT INTO civic_processes (
       jurisdiction_id, process_type_id, canonical_title, normalized_title, canonical_stage
     ) VALUES ('it','it.popular_law_initiative',$1,$2,'collection_closed')
     RETURNING id`,
    [SYNTHETIC_TITLE, SYNTHETIC_NORMALIZED_TITLE]
  );
  const processId = inserted.rows[0]?.id;
  if (!processId) throw new Error('F12-23 failed to create synthetic realization fixture');

  try {
    const regularToken = makeToken({ userId: E2E_USER_ID });
    const adminToken = makeToken({ userId: E2E_ADMIN_USER_ID });
    const path = `/api/admin/civic-processes/${encodeURIComponent(processId)}/realization`;
    const common = { 'Content-Type': 'application/json' };

    const denied = await requestJson(fetchImpl, `${baseUrl}${path}`, {
      method: 'PATCH',
      headers: { ...common, Authorization: `Bearer ${regularToken}` },
      body: JSON.stringify({ realized: true, lawReference: 'STAGING-F12-23-DENIED' }),
    });
    if (denied.response.status !== 403) {
      throw new Error(`F12-23 realization non-Admin expected 403, got ${denied.response.status}`);
    }
    logger.log('[staging-civic-sources-e2e] realization non-Admin 403 PASS');

    const marked = await requestJson(fetchImpl, `${baseUrl}${path}`, {
      method: 'PATCH',
      headers: { ...common, Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ realized: true, lawReference: 'STAGING-F12-23-LAW' }),
    });
    if (marked.response.status !== 200 || marked.body?.process?.realized !== true
      || marked.body?.process?.realized_law_reference !== 'STAGING-F12-23-LAW'
      || String(marked.body?.process?.realized_verified_by_user_id || '') !== E2E_ADMIN_USER_ID) {
      throw new Error(`F12-23 Admin realization mark failed: status=${marked.response.status}`);
    }
    logger.log('[staging-civic-sources-e2e] Admin realization + law reference PASS');

    const reverted = await requestJson(fetchImpl, `${baseUrl}${path}`, {
      method: 'PATCH',
      headers: { ...common, Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ realized: false }),
    });
    if (reverted.response.status !== 200 || reverted.body?.process?.realized !== false
      || reverted.body?.process?.realized_law_reference !== null
      || reverted.body?.process?.realized_verified_by_user_id !== null) {
      throw new Error(`F12-23 Admin realization reversal failed: status=${reverted.response.status}`);
    }
    logger.log('[staging-civic-sources-e2e] Admin realization reversal PASS');
  } finally {
    await pool.query('DELETE FROM civic_processes WHERE id=$1', [processId]).catch(() => {});
  }

  logger.log('[staging-civic-sources-e2e] PASS 7/7');
  return {
    passed: 7,
    total: 7,
    ministryProcessed,
    canonicalSources: canonical.sources,
    signatureSourceRecords: Number(sourceRow.source_records || 0),
    prioritySourceRecords: Number(sourceRow.priority_source_records || 0),
  };
}

module.exports = { diagnoseIdentifierConflict, runStagingCivicSourcesSelfTest };
