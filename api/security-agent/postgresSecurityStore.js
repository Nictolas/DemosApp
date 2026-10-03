const {
  DEFAULT_RETENTION_MS,
  sanitizeIncidentForStore,
  sanitizeSourceState
} = require('./securityStore');

const SCHEMA = 'security_agent';
const INCIDENTS_TABLE = `${SCHEMA}.incidents`;
const SOURCE_STATE_TABLE = `${SCHEMA}.source_state`;
const ALLOWED_STATUSES = new Set(['open', 'acknowledged', 'resolved']);
const ALLOWED_SEVERITIES = new Set(['info', 'low', 'medium', 'high', 'critical']);

function validatePool(pool) {
  if (!pool || typeof pool.query !== 'function' || typeof pool.connect !== 'function') {
    throw new TypeError('pg pool with query() and connect() is required');
  }
  return pool;
}

function normalizeFilter(value, allowed, name) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`invalid ${name}`);
  return normalized;
}

function normalizeLimit(value, fallback = 100) {
  if (value === undefined || value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new Error('limit must be an integer between 1 and 1000');
  }
  return parsed;
}

function rowToIncident(row) {
  return {
    incidentId: row.incident_id,
    findingId: row.finding_id,
    ruleId: row.rule_id,
    severity: row.severity,
    status: row.status,
    count: Number(row.event_count || 0),
    firstSeen: new Date(row.first_seen).toISOString(),
    lastSeen: new Date(row.last_seen).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function rowToSourceState(row) {
  if (!row) return null;
  const iso = value => value ? new Date(value).toISOString() : null;
  return {
    enabled: row.enabled === true,
    watermark: iso(row.watermark),
    lastPollStartedAt: iso(row.last_poll_started_at),
    lastSuccessAt: iso(row.last_success_at),
    lastFailureAt: iso(row.last_failure_at),
    consecutiveFailures: Number(row.consecutive_failures || 0),
    totals: {
      polls: Number(row.total_polls || 0),
      fetched: Number(row.total_fetched || 0),
      accepted: Number(row.total_accepted || 0),
      duplicates: Number(row.total_duplicates || 0)
    },
    storedAt: iso(row.stored_at)
  };
}

class PostgresSecurityStore {
  constructor({ pool, retentionMs = DEFAULT_RETENTION_MS } = {}) {
    this.pool = validatePool(pool);
    if (!Number.isInteger(retentionMs) || retentionMs < 60 * 60 * 1000) {
      throw new Error('retentionMs must be an integer >= 3600000');
    }
    this.retentionMs = retentionMs;
  }

  async upsertIncidents(inputs, now = new Date()) {
    if (!Array.isArray(inputs)) throw new TypeError('incidents must be an array');
    if (inputs.length > 1000) throw new Error('too many incidents in one batch');
    if (inputs.length === 0) return [];

    const db = await this.pool.connect();
    const stored = [];
    try {
      await db.query('BEGIN');
      for (const input of inputs) {
        const incident = sanitizeIncidentForStore(input, now);
        const result = await db.query(`
          INSERT INTO ${INCIDENTS_TABLE} (
            incident_id, finding_id, rule_id, severity, status, event_count,
            first_seen, last_seen, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (incident_id) DO UPDATE SET
            finding_id = EXCLUDED.finding_id,
            rule_id = EXCLUDED.rule_id,
            severity = EXCLUDED.severity,
            status = EXCLUDED.status,
            event_count = EXCLUDED.event_count,
            first_seen = LEAST(${INCIDENTS_TABLE}.first_seen, EXCLUDED.first_seen),
            last_seen = GREATEST(${INCIDENTS_TABLE}.last_seen, EXCLUDED.last_seen),
            updated_at = EXCLUDED.updated_at
          RETURNING incident_id, finding_id, rule_id, severity, status, event_count,
                    first_seen, last_seen, created_at, updated_at
        `, [
          incident.incidentId, incident.findingId, incident.ruleId, incident.severity,
          incident.status, incident.count, incident.firstSeen, incident.lastSeen,
          incident.createdAt, incident.updatedAt
        ]);
        stored.push(rowToIncident(result.rows[0]));
      }
      await db.query('COMMIT');
      return stored;
    } catch (error) {
      try { await db.query('ROLLBACK'); } catch (_rollbackError) {}
      throw error;
    } finally {
      if (typeof db.release === 'function') db.release();
    }
  }

  async listIncidents({ status, severity, limit = 100 } = {}) {
    const safeStatus = normalizeFilter(status, ALLOWED_STATUSES, 'status');
    const safeSeverity = normalizeFilter(severity, ALLOWED_SEVERITIES, 'severity');
    const safeLimit = normalizeLimit(limit, 100);
    const clauses = [];
    const values = [];
    if (safeStatus) {
      values.push(safeStatus);
      clauses.push(`status = $${values.length}`);
    }
    if (safeSeverity) {
      values.push(safeSeverity);
      clauses.push(`severity = $${values.length}`);
    }
    values.push(safeLimit);
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.pool.query(`
      SELECT incident_id, finding_id, rule_id, severity, status, event_count,
             first_seen, last_seen, created_at, updated_at
      FROM ${INCIDENTS_TABLE}
      ${where}
      ORDER BY updated_at DESC
      LIMIT $${values.length}
    `, values);
    return result.rows.map(rowToIncident);
  }

  async saveSourceState(sourceName, state, now = new Date()) {
    const name = String(sourceName || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80);
    if (!name) throw new Error('sourceName is required');
    const sanitized = sanitizeSourceState(state, now);
    const result = await this.pool.query(`
      INSERT INTO ${SOURCE_STATE_TABLE} (
        source_name, enabled, watermark, last_poll_started_at, last_success_at,
        last_failure_at, consecutive_failures, total_polls, total_fetched,
        total_accepted, total_duplicates, stored_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (source_name) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        watermark = EXCLUDED.watermark,
        last_poll_started_at = EXCLUDED.last_poll_started_at,
        last_success_at = EXCLUDED.last_success_at,
        last_failure_at = EXCLUDED.last_failure_at,
        consecutive_failures = EXCLUDED.consecutive_failures,
        total_polls = EXCLUDED.total_polls,
        total_fetched = EXCLUDED.total_fetched,
        total_accepted = EXCLUDED.total_accepted,
        total_duplicates = EXCLUDED.total_duplicates,
        stored_at = EXCLUDED.stored_at
      RETURNING source_name, enabled, watermark, last_poll_started_at, last_success_at,
                last_failure_at, consecutive_failures, total_polls, total_fetched,
                total_accepted, total_duplicates, stored_at
    `, [
      name,
      sanitized.enabled,
      sanitized.watermark,
      sanitized.lastPollStartedAt,
      sanitized.lastSuccessAt,
      sanitized.lastFailureAt,
      sanitized.consecutiveFailures,
      sanitized.totals.polls,
      sanitized.totals.fetched,
      sanitized.totals.accepted,
      sanitized.totals.duplicates,
      sanitized.storedAt
    ]);
    return rowToSourceState(result.rows[0]);
  }

  async getSourceState(sourceName) {
    const name = String(sourceName || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80);
    if (!name) return null;
    const result = await this.pool.query(`
      SELECT source_name, enabled, watermark, last_poll_started_at, last_success_at,
             last_failure_at, consecutive_failures, total_polls, total_fetched,
             total_accepted, total_duplicates, stored_at
      FROM ${SOURCE_STATE_TABLE}
      WHERE source_name = $1
      LIMIT 1
    `, [name]);
    return rowToSourceState(result.rows[0]);
  }

  async prune({ now = new Date() } = {}) {
    const threshold = new Date(new Date(now).getTime() - this.retentionMs);
    if (Number.isNaN(threshold.getTime())) throw new Error('invalid prune timestamp');
    const result = await this.pool.query(`
      DELETE FROM ${INCIDENTS_TABLE}
      WHERE updated_at < $1
    `, [threshold.toISOString()]);
    return Number(result.rowCount || 0);
  }

  async stats() {
    const [summary, sources, bySeverity, byStatus] = await Promise.all([
      this.pool.query(`SELECT COUNT(*)::bigint AS incident_count FROM ${INCIDENTS_TABLE}`),
      this.pool.query(`SELECT COUNT(*)::bigint AS source_count FROM ${SOURCE_STATE_TABLE}`),
      this.pool.query(`SELECT severity, COUNT(*)::bigint AS count FROM ${INCIDENTS_TABLE} GROUP BY severity`),
      this.pool.query(`SELECT status, COUNT(*)::bigint AS count FROM ${INCIDENTS_TABLE} GROUP BY status`)
    ]);
    const severity = {};
    const status = {};
    for (const row of bySeverity.rows) severity[row.severity] = Number(row.count || 0);
    for (const row of byStatus.rows) status[row.status] = Number(row.count || 0);
    return {
      incidentCount: Number(summary.rows[0]?.incident_count || 0),
      sourceCount: Number(sources.rows[0]?.source_count || 0),
      bySeverity: severity,
      byStatus: status
    };
  }
}

module.exports = {
  PostgresSecurityStore,
  SCHEMA,
  INCIDENTS_TABLE,
  SOURCE_STATE_TABLE,
  rowToIncident,
  rowToSourceState
};
