'use strict';

// Emits a bounded operational signal when remote log delivery fails.
// Never include the request, token, user IDs, URL, event payload, or error.message.
function createFailureReporter({
  emit = console.error,
  clock = Date.now,
  intervalMs = 5 * 60 * 1000
} = {}) {
  let lastEmittedAt = null;
  let failuresSinceLastWarning = 0;

  return function reportFailure(httpStatus) {
    failuresSinceLastWarning += 1;
    const now = clock();
    if (lastEmittedAt !== null && now - lastEmittedAt < intervalMs) {
      return false;
    }

    const safeStatus = Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599
      ? httpStatus
      : null;

    emit('AXIOM_INGEST_FAILURE', {
      httpStatus: safeStatus,
      failedAttemptsSinceLastWarning: failuresSinceLastWarning
    });

    lastEmittedAt = now;
    failuresSinceLastWarning = 0;
    return true;
  };
}

module.exports = { createFailureReporter };
