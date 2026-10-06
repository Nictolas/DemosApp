const ALLOWED_HEALTH_REASONS = new Set([
  'recovery-failed',
  'freshness-window',
  'missing',
  'expired',
  'unavailable',
  'invalid-clock',
  'invalid-snapshot-state'
]);

const canResearchUseIssuerKeySet = (health) => {
  if (!health || typeof health !== 'object' || Array.isArray(health)) {
    return false;
  }
  const keys = Object.keys(health).sort();
  if (health.ready === true) {
    return keys.length === 1 && keys[0] === 'ready';
  }
  if (health.ready !== false || keys.length !== 2 ||
      keys[0] !== 'ready' || keys[1] !== 'reason') {
    return false;
  }
  return false;
};

const classifyResearchIssuerKeySetHealth = (health) => {
  if (canResearchUseIssuerKeySet(health)) {
    return Object.freeze({ usable: true });
  }
  const reason = health && typeof health === 'object' &&
    ALLOWED_HEALTH_REASONS.has(health.reason)
    ? health.reason
    : 'unavailable';
  return Object.freeze({ usable: false, reason });
};

module.exports = {
  canResearchUseIssuerKeySet,
  classifyResearchIssuerKeySetHealth
};
