const { MAX_SNAPSHOT_VALIDITY_MS } = require('./researchSignedIssuerKeySetStore');

const assertFreshnessMargin = (minimumRemainingValidityMs) => {
  if (
    !Number.isSafeInteger(minimumRemainingValidityMs) ||
    minimumRemainingValidityMs <= 0 ||
    minimumRemainingValidityMs > MAX_SNAPSHOT_VALIDITY_MS
  ) {
    throw new Error('Invalid issuer key-set freshness margin');
  }
  return minimumRemainingValidityMs;
};

const createResearchIssuerKeySetFreshnessGate = ({
  snapshotStore,
  minimumRemainingValidityMs,
  now = () => Date.now()
}) => {
  if (
    !snapshotStore ||
    typeof snapshotStore.readiness !== 'function' ||
    typeof snapshotStore.resolve !== 'function'
  ) {
    throw new Error('Issuer key-set snapshot store is required');
  }
  if (typeof now !== 'function') {
    throw new Error('Issuer key-set freshness clock is required');
  }

  const freshnessMargin = assertFreshnessMargin(minimumRemainingValidityMs);

  const readiness = () => {
    const observedNow = now();
    if (!Number.isSafeInteger(observedNow)) {
      return Object.freeze({ ready: false, reason: 'invalid-clock' });
    }

    const snapshotReadiness = snapshotStore.readiness();
    if (!snapshotReadiness || typeof snapshotReadiness !== 'object') {
      return Object.freeze({ ready: false, reason: 'invalid-snapshot-state' });
    }
    if (snapshotReadiness.ready !== true) {
      const reason = snapshotReadiness.reason === 'missing' || snapshotReadiness.reason === 'expired'
        ? snapshotReadiness.reason
        : 'unavailable';
      return Object.freeze({ ready: false, reason });
    }
    if (
      !Number.isSafeInteger(snapshotReadiness.sequence) ||
      snapshotReadiness.sequence < 1 ||
      !Number.isSafeInteger(snapshotReadiness.expiresAt)
    ) {
      return Object.freeze({ ready: false, reason: 'invalid-snapshot-state' });
    }

    const remainingValidityMs = snapshotReadiness.expiresAt - observedNow;
    if (remainingValidityMs <= 0) {
      return Object.freeze({ ready: false, reason: 'expired' });
    }
    if (remainingValidityMs < freshnessMargin) {
      return Object.freeze({
        ready: false,
        reason: 'freshness-window',
        sequence: snapshotReadiness.sequence,
        expiresAt: snapshotReadiness.expiresAt
      });
    }

    return Object.freeze({
      ready: true,
      sequence: snapshotReadiness.sequence,
      expiresAt: snapshotReadiness.expiresAt
    });
  };

  return Object.freeze({
    readiness,
    resolve(input) {
      const beforeResolve = readiness();
      if (!beforeResolve.ready) return null;

      const resolved = snapshotStore.resolve(input);
      if (resolved == null) return null;

      const afterResolve = readiness();
      if (
        !afterResolve.ready ||
        afterResolve.sequence !== beforeResolve.sequence ||
        afterResolve.expiresAt !== beforeResolve.expiresAt
      ) {
        return null;
      }
      return resolved;
    }
  });
};

module.exports = {
  assertFreshnessMargin,
  createResearchIssuerKeySetFreshnessGate
};
