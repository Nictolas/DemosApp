const DEFAULT_RULES = Object.freeze([
  {
    id: 'DET-AUTH-FAILED-BURST',
    title: 'Burst di autenticazioni fallite',
    severity: 'high',
    windowMs: 5 * 60 * 1000,
    threshold: 10,
    match: event => event.category === 'auth' && event.type === 'login.failed'
  },
  {
    id: 'DET-ADMIN-FAILED-BURST',
    title: 'Tentativi admin falliti ripetuti',
    severity: 'critical',
    windowMs: 5 * 60 * 1000,
    threshold: 5,
    match: event => event.category === 'auth' && event.type === 'admin.login.failed'
  },
  {
    id: 'DET-RATE-LIMIT-SURGE',
    title: 'Aumento rapido dei blocchi rate-limit',
    severity: 'medium',
    windowMs: 5 * 60 * 1000,
    threshold: 20,
    match: event => event.category === 'edge' && event.type === 'rate_limit.triggered'
  },
  {
    id: 'DET-INTEGRITY-FAILURE',
    title: 'Errore di integrità o controllo security',
    severity: 'critical',
    windowMs: 60 * 1000,
    threshold: 1,
    match: event => event.category === 'integrity' && event.type === 'check.failed'
  },
  {
    id: 'DET-TELEMETRY-GAP',
    title: 'Perdita di telemetria security',
    severity: 'high',
    windowMs: 10 * 60 * 1000,
    threshold: 1,
    match: event => event.category === 'telemetry' && event.type === 'heartbeat.missed'
  }
]);

function eventTime(event) {
  return new Date(event.timestamp).getTime();
}

class DetectionEngine {
  constructor({ rules = DEFAULT_RULES } = {}) {
    this.rules = rules;
  }

  evaluate(events, now = new Date()) {
    if (!Array.isArray(events)) throw new TypeError('events must be an array');
    const nowMs = now.getTime();
    const findings = [];

    for (const rule of this.rules) {
      const matches = events.filter(event => {
        const ts = eventTime(event);
        return Number.isFinite(ts) && ts <= nowMs && ts >= nowMs - rule.windowMs && rule.match(event);
      });

      if (matches.length >= rule.threshold) {
        findings.push(Object.freeze({
          findingId: `${rule.id}:${Math.floor(nowMs / rule.windowMs)}`,
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          count: matches.length,
          firstSeen: matches[0]?.timestamp || now.toISOString(),
          lastSeen: matches[matches.length - 1]?.timestamp || now.toISOString(),
          eventIds: Object.freeze(matches.slice(-100).map(event => event.eventId))
        }));
      }
    }

    return findings;
  }
}

module.exports = {
  DEFAULT_RULES,
  DetectionEngine
};
