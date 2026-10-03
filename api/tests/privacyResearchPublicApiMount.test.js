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


test('Research public mount source stays detached from Identity sessions and the primary database', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const files = [
    'researchPublicApiMount.js',
    'middleware/researchPublicBoundary.js',
    'routes/researchPublicRouter.js'
  ];
  const source = files.map((file) =>
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  ).join('\n');

  assert.doesNotMatch(
    source,
    /middleware\/auth|identityAuth|sessionService|jsonwebtoken|DATABASE_URL|Authorization|Access-Control-Allow-Credentials/i
  );
  assert.doesNotMatch(source, /\bcookie(?:s|Parser)?\b/i);
});

test('Research public mount never invokes boundary/router when exposure policy is fail-closed', () => {
  let boundaryCalls = 0;
  let routerCalls = 0;
  let errorCalls = 0;
  const app = fakeApp();
  const result = mountResearchPublicApiIfEnabled(app, {
    policy: { mountAllowed: false, allowedOrigins: ['https://app.example'] },
    boundary: () => { boundaryCalls += 1; },
    router: () => { routerCalls += 1; },
    errorHandler: () => { errorCalls += 1; }
  });

  assert.deepEqual(result, { mounted: false });
  assert.equal(app.mounted.length, 0);
  assert.equal(boundaryCalls, 0);
  assert.equal(routerCalls, 0);
  assert.equal(errorCalls, 0);
});
