'use strict';

/**
 * Share one in-progress AI generation for identical voting identifiers inside
 * a Node process. Different votes can proceed concurrently. A failed or null
 * result is not cached: future requests may retry after limits recover.
 *
 * This is NOT distributed locking and does not persist across a restart.
 */
function createSingleflight() {
  const inFlight = new Map();

  return function runOnce(key, task) {
    if (typeof task !== 'function') {
      throw new TypeError('AI_SINGLEFLIGHT_TASK_REQUIRED');
    }
    const id = key === null || key === undefined ? '' : String(key).trim();
    if (!id) return Promise.resolve().then(task);

    const running = inFlight.get(id);
    if (running) return running;

    const promise = Promise.resolve().then(task);
    inFlight.set(id, promise);

    const clear = () => {
      if (inFlight.get(id) === promise) inFlight.delete(id);
    };
    promise.then(clear, clear);
    return promise;
  };
}

module.exports = { createSingleflight };
