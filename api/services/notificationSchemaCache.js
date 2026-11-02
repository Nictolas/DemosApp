'use strict';

// Cache only structural PostgreSQL metadata, never notifications or user data.
// Schema changes are rare; cached misses and failed lookups are NOT retained.
const TABLES = new Set(['notifiche_comunali', 'notifiche_avvistamenti']);

function createNotificationColumnCache({ ttlMs = 300000, now = () => Date.now() } = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error('INVALID_SCHEMA_CACHE_TTL');
  const completed = new Map();
  const inFlight = new Map();

  async function columns(pool, table) {
    if (!TABLES.has(table)) throw new Error('INVALID_NOTIFICATION_TABLE');
    const cached = completed.get(table);
    if (cached && now() < cached.expiresAt) return cached.value.slice();
    if (inFlight.has(table)) return (await inFlight.get(table)).slice();

    const promise = (async () => {
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      );
      const names = (result.rows || [])
        .map(row => row.column_name)
        .filter(name => typeof name === 'string');
      // A missing table can be created shortly after a migration. Don't cache misses.
      if (names.length) completed.set(table, {
        value: names.slice(),
        expiresAt: now() + ttlMs
      });
      return names;
    })();

    inFlight.set(table, promise);
    try {
      return (await promise).slice();
    } finally {
      inFlight.delete(table);
    }
  }

  function invalidate(table) {
    if (!TABLES.has(table)) throw new Error('INVALID_NOTIFICATION_TABLE');
    completed.delete(table);
  }

  return { columns, invalidate };
}

const notificationSchemaCache = createNotificationColumnCache();
module.exports = { createNotificationColumnCache, notificationSchemaCache };
