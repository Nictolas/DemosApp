const ALERT_POLICY_VERSION = 'v0.11';
const PRIORITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const TELEMETRY_ATTENTION = new Set(['degraded', 'stale', 'unknown']);

function safeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function makeAlert(priority, code, scope, { count = 1, state = null } = {}) {
  if (!Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, priority)) {
    throw new Error('invalid alert priority');
  }
  return Object.freeze({
    priority,
    code,
    scope,
    count: Math.max(1, safeCount(count)),
    state: state === null ? null : String(state).slice(0, 32)
  });
}

function buildSecurityAlerts({ agentHealth = {}, telemetry = {}, openBySeverity = {} } = {}) {
  const alerts = [];
  const critical = safeCount(openBySeverity.critical);
  const high = safeCount(openBySeverity.high);
  const medium = safeCount(openBySeverity.medium);
  const low = safeCount(openBySeverity.low);
  const info = safeCount(openBySeverity.info);
  const healthLevel = String(agentHealth.level || 'gray');
  const telemetryStatus = String(telemetry.status || 'unknown');

  if (critical > 0) alerts.push(makeAlert('P0', 'OPEN_CRITICAL_INCIDENT', 'incidents', { count: critical, state: 'critical' }));
  if (healthLevel === 'red') alerts.push(makeAlert('P1', 'SECURITY_AGENT_CRITICAL', 'agent', { state: agentHealth.state || 'unknown' }));
  if (high > 0) alerts.push(makeAlert('P1', 'OPEN_HIGH_INCIDENT', 'incidents', { count: high, state: 'high' }));
  if (healthLevel === 'orange') alerts.push(makeAlert('P2', 'SECURITY_AGENT_DEGRADED', 'agent', { state: agentHealth.state || 'unknown' }));
  if (TELEMETRY_ATTENTION.has(telemetryStatus)) alerts.push(makeAlert('P2', 'SECURITY_TELEMETRY_DEGRADED', 'telemetry', { state: telemetryStatus }));
  if (medium > 0) alerts.push(makeAlert('P2', 'OPEN_MEDIUM_INCIDENT', 'incidents', { count: medium, state: 'medium' }));
  if (low > 0) alerts.push(makeAlert('P3', 'OPEN_LOW_INCIDENT', 'incidents', { count: low, state: 'low' }));
  if (info > 0) alerts.push(makeAlert('P3', 'OPEN_INFO_INCIDENT', 'incidents', { count: info, state: 'info' }));
  if (healthLevel === 'gray') alerts.push(makeAlert('P3', 'SECURITY_AGENT_INACTIVE', 'agent', { state: agentHealth.state || 'disabled' }));

  alerts.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.code.localeCompare(b.code));

  return Object.freeze({
    policyVersion: ALERT_POLICY_VERSION,
    highestPriority: alerts[0]?.priority || null,
    activeCount: alerts.length,
    alerts: Object.freeze(alerts)
  });
}

module.exports = {
  ALERT_POLICY_VERSION,
  PRIORITY_ORDER,
  buildSecurityAlerts
};
