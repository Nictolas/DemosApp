'use strict';

// A conservative PER-PROCESS safety brake for optional Play Integrity decoding.
// This intentionally does NOT pretend to enforce a shared Google Cloud quota:
// multiple Render instances can each spend this allowance. Before activating
// Integrity, use Google quota limits/alerts and a distributed hard global budget.
// No Redis/database/external APIs are contacted by this module.
const DEFAULT_MAX_DECODE_PER_DAY_PER_PROCESS = 50;

function createLocalDecodeBudget({ maxDaily = DEFAULT_MAX_DECODE_PER_DAY_PER_PROCESS } = {}) {
  if (!Number.isSafeInteger(maxDaily) || maxDaily < 0 || maxDaily > 1000) {
    throw new RangeError('Invalid per-process Play Integrity quota');
  }
  let day = null;
  let used = 0;

  function reserve(now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return false;
    const nextDay = new Date(now).toISOString().slice(0, 10);
    // Never reset a consumed per-process allowance if UTC time moves back.
    // Advancing clocks, restarts and multiple processes still bypass local limits.
    if (day && nextDay < day) return false;
    if (day !== nextDay) {
      day = nextDay;
      used = 0;
    }
    if (used >= maxDaily) return false;
    used++;
    return true;
  }

  // Counts can be inspected for local diagnostics but are never persisted.
  function remaining(now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return 0;
    const today = new Date(now).toISOString().slice(0, 10);
    if (day && today < day) return 0;
    return day === today ? Math.max(0, maxDaily - used) : maxDaily;
  }

  return Object.freeze({ reserve, remaining, maxDaily });
}

const localDecodeBudget = createLocalDecodeBudget();
module.exports = { createLocalDecodeBudget, localDecodeBudget, DEFAULT_MAX_DECODE_PER_DAY_PER_PROCESS };
