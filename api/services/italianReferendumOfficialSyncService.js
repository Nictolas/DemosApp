'use strict';

const {
  fetchOfficialGazetteReferendumRecords,
  writeSyncState,
} = require('./civicSources/italyOfficialGazetteReferendumAdapter');
const { ingestCivicSourceRecord } = require('./civicProcessPersistenceService');

async function ingestOne(pool, record) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await ingestCivicSourceRecord(client, record);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function syncItalianOfficialReferendumSources({
  pool,
  fetchGazette = fetchOfficialGazetteReferendumRecords,
} = {}) {
  if (!pool?.connect || !pool?.query) throw new Error('DATABASE_POOL_REQUIRED');

  let sourceResult;
  try {
    sourceResult = await fetchGazette({ pool });
  } catch (error) {
    await writeSyncState(pool, {
      success: false,
      errorMessage: error.message,
    }).catch(() => {});
    return {
      gazzetta: {
        fetched: 0,
        ingested: 0,
        scannedIssues: 0,
        referendumCandidates: 0,
        errors: [{ code: error.code || 'GAZETTE_FETCH_FAILED', error: error.message }],
      },
    };
  }

  const records = Array.isArray(sourceResult.records) ? sourceResult.records : [];
  const errors = Array.isArray(sourceResult.errors) ? [...sourceResult.errors] : [];
  let ingested = 0;

  for (const record of records) {
    try {
      await ingestOne(pool, record);
      ingested += 1;
    } catch (error) {
      errors.push({
        stage: 'ingest',
        externalId: record.externalId,
        code: error.code || error.message || 'INGEST_FAILED',
        error: error.message,
      });
    }
  }

  const success = errors.length === 0 && ingested === records.length;
  await writeSyncState(pool, {
    success,
    errorMessage: success ? null : errors.slice(0, 3).map((entry) => entry.error || entry.code).join(' | '),
    now: sourceResult.scanCompletedAt ? new Date(sourceResult.scanCompletedAt) : new Date(),
  });

  return {
    gazzetta: {
      fetched: records.length,
      ingested,
      scannedIssues: Number(sourceResult.scannedIssues || 0),
      referendumCandidates: Number(sourceResult.referendumCandidates || 0),
      cutoff: sourceResult.cutoff || null,
      lastSuccessfulSyncAt: success
        ? (sourceResult.scanCompletedAt || null)
        : (sourceResult.lastSuccessfulSyncAt || null),
      errors,
    },
  };
}

module.exports = {
  ingestOne,
  syncItalianOfficialReferendumSources,
};
