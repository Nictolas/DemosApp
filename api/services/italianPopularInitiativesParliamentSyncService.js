'use strict';

const { loadMinisteroPopularInitiatives } = require('./civicSources/italyMinisteroPopularInitiativesAdapter');
const { fetchCameraPopularInitiatives } = require('./civicSources/italyCameraPopularInitiativesAdapter');
const { fetchSenatoPopularInitiatives } = require('./civicSources/italySenatoPopularInitiativesAdapter');
const { ingestCivicSourceRecord } = require('./civicProcessPersistenceService');
const { reconcileStrongIdentifierBridge } = require('./civicStrongIdentifierReconciliationService');

async function ingestRecordInTransaction(pool, record) {
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

async function ingestRecordWithStrongReconciliation(pool, record) {
  try {
    return await ingestRecordInTransaction(pool, record);
  } catch (error) {
    const code = error.code || error.message || 'INGEST_FAILED';
    if (code !== 'CIVIC_IDENTIFIER_CONFLICT') throw error;

    const reconciliation = await reconcileStrongIdentifierBridge(pool, record);
    if (!reconciliation?.merged) throw error;

    console.warn(
      `[civic-source-sync] strong identifier bridge merged ${reconciliation.mergedProcessIds.join(',')} ` +
      `into ${reconciliation.targetProcessId} (${reconciliation.officialReference})`
    );
    return ingestRecordInTransaction(pool, record);
  }
}

async function ingestRecords(pool, records) {
  const results = [];
  const errors = [];
  for (const record of records) {
    try {
      results.push(await ingestRecordWithStrongReconciliation(pool, record));
    } catch (error) {
      errors.push({
        sourceId: record.sourceId,
        externalId: record.externalId,
        code: error.code || error.message || 'INGEST_FAILED',
        title: record.title || null,
        officialReference: record.officialReference || null,
        officialIdentifiers: Array.isArray(record.officialIdentifiers) ? record.officialIdentifiers : [],
        metadata: record.metadata && typeof record.metadata === 'object' ? record.metadata : {},
      });
    }
  }
  return { results, errors };
}

async function runSourcePlan(pool, sourceResult) {
  if (sourceResult.status === 'rejected') {
    return {
      fetched: 0,
      ingested: 0,
      errors: [{ code: sourceResult.reason?.message || 'SOURCE_FETCH_FAILED' }],
    };
  }

  const records = Array.isArray(sourceResult.value) ? sourceResult.value : [];
  const ingest = await ingestRecords(pool, records);
  return {
    fetched: records.length,
    ingested: ingest.results.length,
    errors: ingest.errors,
  };
}

async function syncItalianPopularInitiativesSources({
  pool,
  legislature = 19,
  cameraLimit = 500,
  senatoLimit = 1000,
  loadMinistero = loadMinisteroPopularInitiatives,
  fetchCamera = fetchCameraPopularInitiatives,
  fetchSenato = fetchSenatoPopularInitiatives,
} = {}) {
  if (!pool?.connect || !pool?.query) throw new Error('DATABASE_POOL_REQUIRED');

  // Tre fonti indipendenti. Nessuna viene usata come fallback inventato per un'altra.
  const [ministeroResult, cameraResult, senatoResult] = await Promise.allSettled([
    loadMinistero(pool),
    fetchCamera({ legislature, limit: cameraLimit }),
    fetchSenato({ legislature, limit: senatoLimit }),
  ]);

  return {
    legislature,
    sources: {
      ministero: await runSourcePlan(pool, ministeroResult),
      camera: await runSourcePlan(pool, cameraResult),
      senato: await runSourcePlan(pool, senatoResult),
    },
  };
}

async function syncItalianPopularInitiativesParliament(options = {}) {
  return syncItalianPopularInitiativesSources(options);
}

module.exports = {
  ingestRecordInTransaction,
  ingestRecordWithStrongReconciliation,
  ingestRecords,
  runSourcePlan,
  syncItalianPopularInitiativesSources,
  syncItalianPopularInitiativesParliament,
};
