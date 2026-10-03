const DEFAULT_MINIMUM_BATCH_SIZE = 8;

const parseTimestamp = (value, field) => {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('Invalid relay ' + field);
  return parsed;
};

const validateDuration = (value, field, { allowZero = false } = {}) => {
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new Error('Invalid relay ' + field);
  }
};

const evaluateDelayedRelayCohort = ({
  requests,
  now = new Date(),
  minimumBatchSize = DEFAULT_MINIMUM_BATCH_SIZE,
  minimumDelayMs,
  maximumHoldMs
}) => {
  if (!Array.isArray(requests)) throw new Error('Invalid relay queue snapshot');
  if (!Number.isSafeInteger(minimumBatchSize) || minimumBatchSize < 2) throw new Error('Invalid relay batch threshold');
  validateDuration(minimumDelayMs, 'minimum delay', { allowZero: true });
  validateDuration(maximumHoldMs, 'maximum hold');
  if (maximumHoldMs <= minimumDelayMs) throw new Error('Relay maximum hold must exceed minimum delay');

  const current = parseTimestamp(now, 'current time');
  const seenAccounts = new Set();
  const normalized = requests.map((request) => {
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Invalid relay queue request');
    const keys = Object.keys(request).sort();
    if (keys.length !== 2 || keys[0] !== 'accountId' || keys[1] !== 'queuedAt') {
      throw new Error('Relay delay queue may contain only Identity reference and queuedAt');
    }
    if (typeof request.accountId !== 'string' || request.accountId.length === 0) throw new Error('Invalid relay account reference');
    if (seenAccounts.has(request.accountId)) throw new Error('Duplicate relay account reference');
    seenAccounts.add(request.accountId);

    const queuedAt = parseTimestamp(request.queuedAt, 'queuedAt');
    if (queuedAt > current) throw new Error('Future relay queuedAt forbidden');
    return { accountId: request.accountId, queuedAt, ageMs: current - queuedAt };
  });

  normalized.sort((left, right) => left.queuedAt - right.queuedAt);
  const eligible = normalized.filter((request) => request.ageMs >= minimumDelayMs);
  if (eligible.length >= minimumBatchSize) {
    return {
      dispatch: true,
      reason: 'BATCH_READY',
      requiresIntervention: false,
      accountIds: eligible.slice(0, minimumBatchSize).map((request) => request.accountId)
    };
  }

  const oldestAgeMs = normalized.length === 0 ? 0 : normalized[0].ageMs;
  if (oldestAgeMs >= maximumHoldMs) {
    return {
      dispatch: false,
      reason: 'PRIVACY_THRESHOLD_BLOCKS_BOUNDED_LATENCY',
      requiresIntervention: true,
      accountIds: []
    };
  }

  return {
    dispatch: false,
    reason: 'WAIT_FOR_DELAY_OR_COHORT',
    requiresIntervention: false,
    accountIds: []
  };
};

module.exports = {
  DEFAULT_MINIMUM_BATCH_SIZE,
  evaluateDelayedRelayCohort
};
