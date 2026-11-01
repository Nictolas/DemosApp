'use strict';

/**
 * Research-only, schema-metadata-only preflight. Not used by any runtime route.
 * The caller must supply an explicit historical manifest including tombstones.
 * This performs exactly ONE read of information_schema and no response-row reads.
 */
const {assertLegacySchemaInventory} = require('./opinionAnswersV2BackfillCandidate');

const SCHEMA_SQL = `
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'opinioni_risposte'
ORDER BY ordinal_position
`;

async function inspectLegacyOpinionAnswerSchema(readOnlyDb, immutableHistoricalIds) {
  if (!readOnlyDb || typeof readOnlyDb.query !== 'function') {
    throw new TypeError('Read-only query interface required');
  }
  if (!Array.isArray(immutableHistoricalIds) || immutableHistoricalIds.length === 0) {
    throw new TypeError('Explicit immutable historical ID manifest required');
  }
  const result = await readOnlyDb.query(SCHEMA_SQL);
  if (!result || !Array.isArray(result.rows)) {
    throw new TypeError('Invalid information_schema response');
  }
  const coverage = assertLegacySchemaInventory(immutableHistoricalIds,result.rows);
  return Object.freeze({
    checkedAnswerColumns:coverage.coveredIds,
    checkedServiceColumns:coverage.serviceColumns.length,
    catalogReadFromSql:false,
    personalAnswersRead:false,
    schemaChangesMade:false
  });
}
module.exports={inspectLegacyOpinionAnswerSchema,SCHEMA_SQL};
