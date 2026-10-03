const SEVERITY_ORDER = Object.freeze({
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
});

const SAFE_INCIDENT_KEYS = Object.freeze([
  'incidentId',
  'findingId',
  'ruleId',
  'severity',
  'status',
  'count',
  'firstSeen',
  'lastSeen',
  'createdAt',
  'updatedAt'
]);

function pickIncident(input = {}) {
  const safe = {};
  for (const key of SAFE_INCIDENT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) safe[key] = input[key];
  }
  return safe;
}

function countOpenBySeverity(incidents) {
  const counts = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  for (const incident of incidents) {
    if (incident.status !== 'open') continue;
    if (Object.prototype.hasOwnProperty.call(counts, incident.severity)) {
      counts[incident.severity] += 1;
    }
  }
  return counts;
}

function latestOpenSeverity(counts) {
  return Object.keys(SEVERITY_ORDER)
    .filter(severity => counts[severity] > 0)
    .sort((a, b) => SEVERITY_ORDER[b] - SEVERITY_ORDER[a])[0] || null;
}

function sourceHealth(sourceState, now, staleAfterMs) {
  if (!sourceState) {
    return {
      status: 'unknown',
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      ageMs: null
    };
  }

  const lastSuccessMs = sourceState.lastSuccessAt
    ? new Date(sourceState.lastSuccessAt).getTime()
    : Number.NaN;
  const ageMs = Number.isFinite(lastSuccessMs) ? Math.max(0, now.getTime() - lastSuccessMs) : null;
  const failures = Number(sourceState.consecutiveFailures || 0);

  let status = 'healthy';
  if (sourceState.enabled !== true) status = 'disabled';
  else if (failures > 0) status = 'degraded';
  else if (ageMs === null || ageMs > staleAfterMs) status = 'stale';

  return {
    status,
    lastSuccessAt: sourceState.lastSuccessAt || null,
    lastFailureAt: sourceState.lastFailureAt || null,
    consecutiveFailures: Number.isFinite(failures) && failures >= 0 ? Math.floor(failures) : 0,
    ageMs,
    totals: {
      polls: Number(sourceState.totals?.polls || 0),
      fetched: Number(sourceState.totals?.fetched || 0),
      accepted: Number(sourceState.totals?.accepted || 0),
      duplicates: Number(sourceState.totals?.duplicates || 0)
    }
  };
}

function deriveShield({ runnerStatus, telemetry, openBySeverity }) {
  if (runnerStatus?.enabled !== true) {
    return { color: 'gray', state: 'disabled', reason: 'runner_disabled' };
  }
  if (openBySeverity.critical > 0) {
    return { color: 'red', state: 'critical', reason: 'open_critical_incident' };
  }
  if (runnerStatus?.lastRunStatus === 'error') {
    return { color: 'red', state: 'error', reason: 'runner_error' };
  }
  if (
    openBySeverity.high > 0 ||
    runnerStatus?.lastRunStatus === 'degraded' ||
    ['degraded', 'stale', 'unknown'].includes(telemetry.status)
  ) {
    return { color: 'orange', state: 'attention', reason: 'security_attention_required' };
  }
  return { color: 'green', state: 'healthy', reason: 'no_high_or_critical_incidents' };
}

function buildSecurityCenterOverview({
  runnerStatus = {},
  sourceState = null,
  storeStats = {},
  incidents = [],
  now = new Date(),
  staleAfterMs = 10 * 60 * 1000,
  recentLimit = 10
} = {}) {
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('invalid overview timestamp');
  if (!Number.isInteger(staleAfterMs) || staleAfterMs < 60 * 1000) {
    throw new Error('staleAfterMs must be an integer >= 60000');
  }
  if (!Number.isInteger(recentLimit) || recentLimit < 1 || recentLimit > 100) {
    throw new Error('recentLimit must be an integer between 1 and 100');
  }

  const safeIncidents = Array.isArray(incidents) ? incidents.map(pickIncident) : [];
  const openBySeverity = countOpenBySeverity(safeIncidents);
  const telemetry = sourceHealth(sourceState, current, staleAfterMs);
  const shield = deriveShield({ runnerStatus, telemetry, openBySeverity });

  return {
    generatedAt: current.toISOString(),
    shield,
    agent: {
      enabled: runnerStatus?.enabled === true,
      running: runnerStatus?.running === true,
      inFlight: runnerStatus?.inFlight === true,
      lastRunAt: runnerStatus?.lastRunAt || null,
      lastRunStatus: String(runnerStatus?.lastRunStatus || 'never').slice(0, 32),
      runCount: Number(runnerStatus?.runCount || 0),
      failureCount: Number(runnerStatus?.failureCount || 0)
    },
    telemetry,
    incidents: {
      total: Number(storeStats?.incidentCount ?? safeIncidents.length),
      open: Object.values(openBySeverity).reduce((sum, count) => sum + count, 0),
      highestOpenSeverity: latestOpenSeverity(openBySeverity),
      openBySeverity,
      byStatus: { ...(storeStats?.byStatus || {}) },
      recent: safeIncidents
        .slice()
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .slice(0, recentLimit)
    }
  };
}

module.exports = {
  SAFE_INCIDENT_KEYS,
  buildSecurityCenterOverview,
  pickIncident
};
