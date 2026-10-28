'use strict';

// A public statistics endpoint must never interpolate an untrusted column name.
// Use the canonical opinion ID only after validating its shape and checking
// that the opinion is published and has a matching answer column.
const { isPublishedOpinionId } = require('../services/opinionCatalog');

async function resolvePublishedOpinionColumn(pool, opinionId) {
  if (typeof opinionId !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(opinionId)) {
    return null;
  }

  if (!isPublishedOpinionId(opinionId)) return null;
  // This schema check is still needed: a catalog entry without a response
  // column must not become a SQL identifier. It is not a catalog table read.
  const result = await pool.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'opinioni_risposte'
      AND column_name = $1 LIMIT 1
  `, [opinionId]);

  return result.rows.length ? opinionId : null;
}

module.exports = { resolvePublishedOpinionColumn };
