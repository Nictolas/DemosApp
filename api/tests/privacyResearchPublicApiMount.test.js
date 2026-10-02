const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mountResearchPublicApiIfEnabled
} = require('../researchPublicApiMount');

const fakeApp = () => {
  const mounted = [];
  return {
    mounted,
    use(value) { mounted.push(value); }
  };
};

test('Research public API mount is fail-closed when flags or origins are missing', () => {
  const boundary = () => {};
  const router = () => {};
  const errorHandler = () => {};

  for (const policy of [
    { mountAllowed: false, allowedOrigins: ['https://app.example'] },
    { mountAllowed: true, allowedOrigins: [] }
  ]) {
    const app = fakeApp();
    assert.deepEqual(
      mountResearchPublicApiIfEnabled(app, { policy, boundary, router, errorHandler }),
      { mounted: false }
    );
    assert.equal(app.mounted.length, 0);
  }
});

test('Research public API composition orders boundary then router then minimal error handler', () => {
  const app = fakeApp();
  const boundary = () => {};
  const router = () => {};
  const errorHandler = () => {};

  assert.deepEqual(
    mountResearchPublicApiIfEnabled(app, {
      policy: { mountAllowed: true, allowedOrigins: ['https://app.example'] },
      boundary,
      router,
      errorHandler
    }),
    { mounted: true }
  );
  assert.deepEqual(app.mounted, [boundary, router, errorHandler]);
});
