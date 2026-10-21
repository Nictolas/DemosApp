'use strict';

// A public statistics endpoint must never interpolate an untrusted column name.
// Use the canonical opinion ID only after validating its shape and checking
// that the opinion is published and has a matching answer column.
async function resolvePublishedOpinionColumn(pool, opinionId) {
  if (typeof opinionId !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/.test(opinionId)) {
    return null;
  }

  const result = await pool.query(`
    SELECT d.id
    FROM public.opinioni_domande d
    WHERE d.id = $1
      AND NOT ('da approvare' = ANY(d.gradi_opinione))
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'opinioni_risposte'
          AND c.column_name = d.id
      )
    LIMIT 1
  `, [opinionId]);

  return result.rows.length ? opinionId : null;
}

module.exports = { resolvePublishedOpinionColumn };
