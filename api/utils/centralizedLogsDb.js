/**
 * Dopo la migrazione dei log su Axiom la tabella PostgreSQL `centralized_logs` può non esistere.
 * Questo modulo evita INSERT/query sul DB quando la tabella manca (es. AXIOM_ENABLED=false).
 */
const { pool } = require('../middleware/auth');

let cachedExists = null;
let cachedAt = 0;
const TTL_MS = 60 * 1000;

/**
 * @returns {Promise<boolean>}
 */
async function isCentralizedLogsTableAvailable() {
  const now = Date.now();
  if (cachedExists !== null && now - cachedAt < TTL_MS) {
    return cachedExists;
  }
  try {
    const r = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'centralized_logs'
      ) AS exists;
    `);
    cachedExists = !!r.rows[0].exists;
    cachedAt = now;
    return cachedExists;
  } catch {
    cachedExists = false;
    cachedAt = now;
    return false;
  }
}

function invalidateCentralizedLogsDbCache() {
  cachedExists = null;
  cachedAt = 0;
}

module.exports = {
  isCentralizedLogsTableAvailable,
  invalidateCentralizedLogsDbCache
};
