const OPINION_ID_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

const quotePgIdentifier = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!OPINION_ID_PATTERN.test(normalized)) {
    return null;
  }
  return `"${normalized}"`;
};

const ensureOpinionResponseColumn = async ({ pool, opinionId }) => {
  if (!pool || typeof pool.query !== 'function') {
    throw new Error('PostgreSQL pool is required');
  }

  const safeIdentifier = quotePgIdentifier(opinionId);
  if (!safeIdentifier) {
    return { created: false, reason: 'invalid_identifier' };
  }

  const columnCheck = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'opinioni_risposte'
      AND column_name = $1
  `, [opinionId]);

  if (columnCheck.rows.length > 0) {
    return { created: false, reason: 'already_exists' };
  }

  await pool.query(
    `ALTER TABLE opinioni_risposte ADD COLUMN ${safeIdentifier} TEXT`
  );

  return { created: true };
};

module.exports = {
  OPINION_ID_PATTERN,
  quotePgIdentifier,
  ensureOpinionResponseColumn
};
