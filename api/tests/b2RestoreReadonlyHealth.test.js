'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { healthHandler, assertB2StandbyEnvironment, startB2ReadonlyHealth } =
  require('../scripts/b2-restore-readonly-health-server');

const base = Object.freeze({
  B2_RESTORE_READONLY_MODE: 'true',
  AXIOM_ARCHIVE_ENABLED: 'false',
  B2_S3_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com',
  B2_S3_REGION: 'eu-central-003',
  B2_BUCKET_NAME: 'demos-log-archive-eu',
  PORT: '10000'
});
const credentials = {
  B2_S3_ACCESS_KEY_ID: 'synthetic-readonly-id',
  B2_S3_SECRET_ACCESS_KEY: 'synthetic-readonly-key'
};

function readResponse(handler, method, url) {
  const response = { status: null, body: '', headers: {} };
  handler({ method, url }, {
    writeHead(status, headers) { response.status = status; response.headers = headers; },
    end(body) { response.body = body; }
  });
  return response;
}

test('without B2 secrets starts standby only, with health returning 503', async () => {
  let validated = false, handler = null;
  const started = await startB2ReadonlyHealth({
    env: base,
    verify: async () => { validated = true; throw new Error('should not run'); },
    listen: (h, port) => { assert.equal(port, 10000); handler = h; return 'listener'; }
  });
  assert.equal(started.ready, false);
  assert.equal(started.listener, 'listener');
  assert.equal(validated, false);
  assert.equal(readResponse(handler, 'GET', '/healthz').status, 503);
  assert.equal(readResponse(handler, 'GET', '/healthz').body, 'not ready\n');
  assert.equal(readResponse(handler, 'GET', '/').status, 404);
  assert.equal(readResponse(handler, 'POST', '/healthz').status, 404);
});

test('with isolated B2 read-only key verifies both datasets before healthy', async () => {
  const actions = [];
  let handler = null;
  const result = await startB2ReadonlyHealth({
    env: { ...base, ...credentials },
    verify: async ({ env }) => {
      assert.equal(env.B2_BUCKET_NAME, 'demos-log-archive-eu');
      actions.push('verified');
      return { status: 'B2_READONLY_RESTORE_VERIFIED', summaries: [
        { dataset: 'centralized_logs', verifiedEvents: 2 },
        { dataset: 'real-time', verifiedEvents: 0 }
      ] };
    },
    listen: h => { handler = h; actions.push('listening'); return 'listener'; }
  });
  assert.equal(result.ready, true);
  assert.deepEqual(actions, ['verified', 'listening']);
  assert.equal(readResponse(handler, 'GET', '/healthz').status, 200);
  assert.equal(readResponse(handler, 'GET', '/healthz').body, 'ok\n');
  assert.equal(readResponse(handler, 'GET', '/?token=secret').status, 404);
});

test('failed verify never listens or leaks provider exception', async () => {
  let listening = false;
  await assert.rejects(startB2ReadonlyHealth({
    env: { ...base, ...credentials },
    verify: async () => { throw new Error('secret private B2 endpoint info'); },
    listen: () => { listening = true; }
  }));
  assert.equal(listening, false);
  await assert.rejects(startB2ReadonlyHealth({
    env: { ...base, ...credentials },
    verify: async () => ({ status: 'B2_READONLY_RESTORE_VERIFIED', summaries: [] }),
    listen: () => { listening = true; }
  }), /B2_READONLY_HEALTH_VERIFICATION_REJECTED/);
  assert.equal(listening, false);
});

test('rejects partial secrets, production DB, Axiom credentials, wrong bucket, writing mode', async () => {
  const unsafe = [
    { B2_S3_ACCESS_KEY_ID: 'partial' },
    { B2_S3_SECRET_ACCESS_KEY: 'partial' },
    { DATABASE_URL: 'synthetic' },
    { AUDIT_OUTBOX_DATABASE_URL: 'synthetic' },
    { AXIOM_API_TOKEN: 'synthetic' },
    { AXIOM_ARCHIVE_ENABLED: 'true' },
    { B2_BUCKET_NAME: 'another-bucket' },
    { B2_S3_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com' },
    { B2_RESTORE_READONLY_MODE: 'false' },
    { PORT: '99999' }
  ];
  for (const extra of unsafe) {
    assert.throws(() => assertB2StandbyEnvironment({ ...base, ...extra }));
    let started = false;
    await assert.rejects(startB2ReadonlyHealth({
      env: { ...base, ...extra },
      verify: async () => { throw new Error('should not verify'); },
      listen: () => { started = true; }
    }));
    assert.equal(started, false);
  }
});
