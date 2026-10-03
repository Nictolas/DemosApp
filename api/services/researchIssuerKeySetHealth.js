const PUBLIC_NOT_READY_REASONS = new Set([
  'recovery-failed',
  'freshness-window',
  'missing',
  'expired',
  'unavailable',
  'invalid-clock',
  'invalid-snapshot-state'
]);

const toResearchIssuerKeySetHealth = (readiness, { recoveryFailed = false } = {}) => {
  if (recoveryFailed) {
    return Object.freeze({ ready: false, reason: 'recovery-failed' });
  }
  if (!readiness || typeof readiness !== 'object') {
    return Object.freeze({ ready: false, reason: 'unavailable' });
  }
  if (readiness.ready === true) {
    return Object.freeze({ ready: true });
  }
  const reason = PUBLIC_NOT_READY_REASONS.has(readiness.reason)
    ? readiness.reason
    : 'unavailable';
  return Object.freeze({ ready: false, reason });
};

module.exports = {
  toResearchIssuerKeySetHealth
};
