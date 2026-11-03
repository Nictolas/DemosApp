'use strict';

// Strictly in-memory operational counters: no tokens, payloads, user IDs,
// IPs, timestamps per event, custom reason strings, or persistent logs.
// Snapshot is withheld below a small-group threshold to reduce disclosure.
const CATEGORIES = Object.freeze(['verified', 'untrusted', 'unavailable', 'disabled']);
const MIN_PUBLIC_SAMPLES = 20;

function createPlayIntegrityAggregate({ minSamples = MIN_PUBLIC_SAMPLES } = {}) {
  if (!Number.isSafeInteger(minSamples) || minSamples < MIN_PUBLIC_SAMPLES) {
    throw new RangeError('Minimum sample size must be at least 20');
  }
  let day = null;
  let total = 0;
  let counts = Object.create(null);

  function record(outcome, now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return false;
    const status = outcome && outcome.status;
    if (typeof status !== 'string' || !CATEGORIES.includes(status)) return false;
    const utcDay = new Date(now).toISOString().slice(0, 10);
    if (utcDay !== day) {
      day = utcDay;
      total = 0;
      counts = Object.create(null);
    }
    if (total < Number.MAX_SAFE_INTEGER) total++;
    counts[status] = Math.min(Number.MAX_SAFE_INTEGER, (counts[status] || 0) + 1);
    return true;
  }

  function snapshot(now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return null;
    if (new Date(now).toISOString().slice(0, 10) !== day || total < minSamples) return null;
    return {
      day,
      total,
      counts: Object.fromEntries(CATEGORIES.map(c => [c, counts[c] || 0]))
    };
  }

  return Object.freeze({ record, snapshot });
}

module.exports = { createPlayIntegrityAggregate, MIN_PUBLIC_SAMPLES };
