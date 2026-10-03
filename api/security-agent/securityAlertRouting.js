const ROUTING_POLICY_VERSION = 'v0.12';
const PRIORITY_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

const ROUTES = Object.freeze({
  P0: Object.freeze({
    channels: Object.freeze(['security_center', 'push', 'email', 'external_secondary']),
    cooldownMs: 5 * 60 * 1000,
    acknowledgeWithinMs: 10 * 60 * 1000,
    escalationChannels: Object.freeze(['push', 'email', 'external_secondary'])
  }),
  P1: Object.freeze({
    channels: Object.freeze(['security_center', 'push']),
    cooldownMs: 15 * 60 * 1000,
    acknowledgeWithinMs: 30 * 60 * 1000,
    escalationChannels: Object.freeze(['email'])
  }),
  P2: Object.freeze({
    channels: Object.freeze(['security_center', 'summary']),
    cooldownMs: 60 * 60 * 1000,
    acknowledgeWithinMs: null,
    escalationChannels: Object.freeze([])
  }),
  P3: Object.freeze({
    channels: Object.freeze(['security_center', 'summary']),
    cooldownMs: 6 * 60 * 60 * 1000,
    acknowledgeWithinMs: null,
    escalationChannels: Object.freeze([])
  })
});

function safeToken(value, fallback = 'unknown', max = 80) {
  const text = String(value ?? fallback).replace(/[^A-Za-z0-9_.:-]/g, '_');
  return (text || fallback).slice(0, max);
}

function safeFingerprintKey(value) {
  const text = String(value ?? '').replace(/[^A-Za-z0-9_.:|\-]/g, '_');
  return text.slice(0, 240);
}

function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
}

function alertFingerprint(alert = {}) {
  return [
    safeToken(alert.code),
    safeToken(alert.scope),
    safeToken(alert.state, 'none', 32)
  ].join('|');
}

function normalizeRoutingState(input = {}) {
  const records = input && typeof input === 'object' ? input : {};
  const normalized = {};
  for (const [fingerprint, record] of Object.entries(records)) {
    if (!record || typeof record !== 'object') continue;
    normalized[safeFingerprintKey(fingerprint) || 'invalid'] = {
      priority: Object.prototype.hasOwnProperty.call(PRIORITY_RANK, record.priority) ? record.priority : 'P3',
      firstSeenAt: record.firstSeenAt || null,
      lastRoutedAt: record.lastRoutedAt || null,
      acknowledgedAt: record.acknowledgedAt || null,
      routeCount: Number.isInteger(record.routeCount) && record.routeCount >= 0 ? record.routeCount : 0,
      escalationCount: Number.isInteger(record.escalationCount) && record.escalationCount >= 0 ? record.escalationCount : 0
    };
  }
  return normalized;
}

function buildAlertRoutingPlan({ alerts = [], routingState = {}, now = new Date() } = {}) {
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('invalid routing timestamp');
  const currentMs = current.getTime();
  const state = normalizeRoutingState(routingState);
  const routes = [];
  const nextState = { ...state };

  for (const raw of Array.isArray(alerts) ? alerts : []) {
    const priority = String(raw?.priority || '');
    if (!Object.prototype.hasOwnProperty.call(ROUTES, priority)) continue;
    const policy = ROUTES[priority];
    const fingerprint = alertFingerprint(raw);
    const previous = state[fingerprint] || null;
    const previousRoutedMs = previous?.lastRoutedAt ? new Date(previous.lastRoutedAt).getTime() : Number.NaN;
    const firstSeenMs = previous?.firstSeenAt ? new Date(previous.firstSeenAt).getTime() : currentMs;
    const acknowledged = Boolean(previous?.acknowledgedAt);
    const priorityEscalated = previous && PRIORITY_RANK[priority] < PRIORITY_RANK[previous.priority];
    const cooldownExpired = !Number.isFinite(previousRoutedMs) || currentMs - previousRoutedMs >= policy.cooldownMs;
    const shouldRoute = !previous || priorityEscalated || (!acknowledged && cooldownExpired);
    const ackDeadlinePassed = !acknowledged && policy.acknowledgeWithinMs !== null && currentMs - firstSeenMs >= policy.acknowledgeWithinMs;
    const shouldEscalate = Boolean(previous) && ackDeadlinePassed && cooldownExpired && policy.escalationChannels.length > 0;

    let decision = 'suppressed_cooldown';
    let channels = [];
    if (acknowledged) {
      decision = 'acknowledged';
      channels = ['security_center'];
    } else if (shouldEscalate) {
      decision = 'escalate_simulated';
      channels = ['security_center', ...policy.escalationChannels];
    } else if (shouldRoute) {
      decision = 'route_simulated';
      channels = [...policy.channels];
    }

    const routeRecord = {
      fingerprint,
      priority,
      code: safeToken(raw.code),
      scope: safeToken(raw.scope),
      state: raw.state == null ? null : safeToken(raw.state, 'unknown', 32),
      count: safeCount(raw.count),
      decision,
      channels: Object.freeze([...new Set(channels)]),
      requiresAcknowledgment: policy.acknowledgeWithinMs !== null,
      acknowledgeWithinMs: policy.acknowledgeWithinMs,
      cooldownMs: policy.cooldownMs
    };
    routes.push(Object.freeze(routeRecord));

    const routed = decision === 'route_simulated' || decision === 'escalate_simulated';
    nextState[fingerprint] = {
      priority,
      firstSeenAt: previous?.firstSeenAt || current.toISOString(),
      lastRoutedAt: routed ? current.toISOString() : (previous?.lastRoutedAt || null),
      acknowledgedAt: previous?.acknowledgedAt || null,
      routeCount: (previous?.routeCount || 0) + (routed ? 1 : 0),
      escalationCount: (previous?.escalationCount || 0) + (decision === 'escalate_simulated' ? 1 : 0)
    };
  }

  routes.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.code.localeCompare(b.code));
  return Object.freeze({
    policyVersion: ROUTING_POLICY_VERSION,
    simulated: true,
    generatedAt: current.toISOString(),
    routes: Object.freeze(routes),
    state: Object.freeze(nextState)
  });
}

function acknowledgeAlert({ routingState = {}, fingerprint, now = new Date() } = {}) {
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('invalid acknowledgment timestamp');
  const state = normalizeRoutingState(routingState);
  const key = safeFingerprintKey(fingerprint);
  if (!key || !state[key]) return Object.freeze({ changed: false, state: Object.freeze(state) });
  state[key] = { ...state[key], acknowledgedAt: current.toISOString() };
  return Object.freeze({ changed: true, state: Object.freeze(state) });
}

module.exports = {
  ROUTING_POLICY_VERSION,
  ROUTES,
  alertFingerprint,
  buildAlertRoutingPlan,
  acknowledgeAlert
};
