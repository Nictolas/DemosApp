const HEALTH_LEVELS = Object.freeze({
  DISABLED: 'gray',
  HEALTHY: 'green',
  DEGRADED: 'orange',
  CRITICAL: 'red'
});

function safeDateMs(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function buildSecurityAgentHealth(runtimeStatus, {
  now = new Date(),
  staleAfterMs,
  stuckAfterMs,
  criticalFailureThreshold = 3
} = {}) {
  const status = runtimeStatus && typeof runtimeStatus === 'object' ? runtimeStatus : {};
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error('invalid health timestamp');

  const intervalMs = positiveInt(status.intervalMs, 60000);
  const staleMs = positiveInt(staleAfterMs, Math.max(intervalMs * 3, 60000));
  const stuckMs = positiveInt(stuckAfterMs, Math.max(intervalMs * 2, 30000));
  const failureThreshold = positiveInt(criticalFailureThreshold, 3);
  const state = String(status.state || 'disabled').slice(0, 32);
  const reasons = [];

  if (state === 'disabled' || state === 'stopped') {
    return Object.freeze({
      level: HEALTH_LEVELS.DISABLED,
      state,
      operational: false,
      reasons: Object.freeze([state]),
      checkedAt: new Date(nowMs).toISOString()
    });
  }

  const inFlightStartedMs = safeDateMs(status.inFlightStartedAt);
  if (status.inFlight === true && inFlightStartedMs !== null && nowMs - inFlightStartedMs > stuckMs) {
    reasons.push('cycle_stuck');
  }

  const consecutiveFailures = Number(status.consecutiveFailures || 0);
  const lastCycleStatus = String(status.lastCycleStatus || 'never').slice(0, 32);
  if (consecutiveFailures >= failureThreshold) reasons.push('repeated_failures');
  else if (lastCycleStatus === 'error' || lastCycleStatus === 'degraded') reasons.push('last_cycle_failed');

  const startedMs = safeDateMs(status.startedAt);
  const lastSuccessMs = safeDateMs(status.lastSuccessAt);
  if (startedMs !== null) {
    const freshnessBase = lastSuccessMs ?? startedMs;
    if (nowMs - freshnessBase > staleMs) reasons.push(lastSuccessMs === null ? 'no_success' : 'stale_success');
  }

  let level = HEALTH_LEVELS.HEALTHY;
  if (reasons.includes('cycle_stuck') || reasons.includes('repeated_failures')) {
    level = HEALTH_LEVELS.CRITICAL;
  } else if (reasons.length > 0 || state === 'ready') {
    level = HEALTH_LEVELS.DEGRADED;
    if (state === 'ready' && reasons.length === 0) reasons.push('not_running');
  }

  return Object.freeze({
    level,
    state,
    operational: state === 'running',
    reasons: Object.freeze([...new Set(reasons)]),
    checkedAt: new Date(nowMs).toISOString()
  });
}

module.exports = {
  HEALTH_LEVELS,
  buildSecurityAgentHealth
};
