'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HeadObjectCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const {
  DATASETS, assertReadOnlyB2RestoreEnvironment,
  readOnlyB2Transport, verifyB2RestoreReadOnly
} = require('../scripts/verify-b2-restore-readonly');

const env = Object.freeze({
  B2_RESTORE_READONLY_MODE: 'true',
  AXIOM_ARCHIVE_ENABLED: 'false',
  B2_S3_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com',
  B2_S3_REGION: 'eu-central-003',
  B2_BUCKET_NAME: 'demos-log-archive-eu',
  B2_S3_ACCESS_KEY_ID: 'synthetic-key',
  B2_S3_SECRET_ACCESS_KEY: 'synthetic-secret'
});
const key = 'demos/axiom-archive/v1/control/centralized_logs.json';

test('B2 restore requires isolated, exact EU bucket and read-only mode', () => {
  assert.equal(assertReadOnlyB2RestoreEnvironment(env), true);
  const bad = [
    { B2_RESTORE_READONLY_MODE: 'false' },
    { AXIOM_ARCHIVE_ENABLED: 'true' },
    { B2_BUCKET_NAME: 'some-other-bucket' },
    { B2_S3_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com' },
    { B2_S3_REGION: 'us-west-004' },
    { B2_S3_ACCESS_KEY_ID: '' },
    { B2_S3_SECRET_ACCESS_KEY: '' },
    { DATABASE_URL: 'synthetic' },
    { AUDIT_OUTBOX_DATABASE_URL: 'synthetic' },
    { AXIOM_API_TOKEN: 'synthetic' },
    { AXIOM_ORG_ID: 'synthetic' },
    { B2_APPLICATION_KEY: 'synthetic' },
    { AXIOM_ARCHIVE_PREFIX: 'foreign/prefix' }
  ];
  for (const changes of bad) {
    assert.throws(() => assertReadOnlyB2RestoreEnvironment({ ...env, ...changes }),
      /B2_READONLY_RESTORE_CONFIGURATION_REJECTED/);
  }
});

test('B2 transport allows only HEAD/GET in the pinned bucket and prefix', async () => {
  const commands = [];
  const gateway = readOnlyB2Transport({
    send: async cmd => { commands.push(cmd.constructor.name); return { status: 'ok' }; }
  });
  const input = { Bucket: env.B2_BUCKET_NAME, Key: key };
  await gateway.send(new HeadObjectCommand(input));
  await gateway.send(new GetObjectCommand({ ...input, Range: 'bytes=0-9' }));
  assert.deepEqual(commands, ['HeadObjectCommand', 'GetObjectCommand']);
  for (const command of [
    new PutObjectCommand({ ...input, Body: 'no-write' }),
    new DeleteObjectCommand(input),
    new GetObjectCommand(input),
    new GetObjectCommand({ ...input, Range: 'bytes=0-8388608' }),
    new HeadObjectCommand({ Bucket: 'other-bucket', Key: key }),
    new GetObjectCommand({ Bucket: env.B2_BUCKET_NAME, Key: 'other/prefix' })
  ]) {
    await assert.rejects(gateway.send(command),
      /B2_READONLY_RESTORE_WRITE_REJECTED|B2_READONLY_RESTORE_TARGET_REJECTED|B2_READONLY_RESTORE_RANGE_REJECTED/);
  }
  assert.equal(commands.length, 2, 'forbidden commands never reach the client');
});

test('both latest datasets are checked, returning counts without object keys or tokens', async () => {
  const called = [];
  const result = await verifyB2RestoreReadOnly({
    env,
    makeClient: () => ({ send: async () => { throw new Error('not expected'); } }),
    makeService: ({ b2Client }) => {
      assert.ok(b2Client);
      return { verifyLatestArchiveBatch: async dataset => {
        called.push(dataset);
        return { dataset, verifiedObjects: dataset === 'real-time' ? 0 : 2,
          verifiedEvents: dataset === 'real-time' ? 0 : 4,
          checkpointEnd: '2026-10-22T00:00:00.000Z',
          key: 'SECRET_KEY_MUST_NOT_APPEAR' };
      } };
    }
  });
  assert.deepEqual(called, DATASETS);
  assert.equal(result.status, 'B2_READONLY_RESTORE_VERIFIED');
  assert.equal(result.summaries.length, 2);
  assert.ok(!JSON.stringify(result).includes('synthetic-secret'));
  assert.ok(!JSON.stringify(result).includes('SECRET_KEY_MUST_NOT_APPEAR'));
});

test('does not claim a real restore when only empty checkpoints and manifests were read', async () => {
  await assert.rejects(verifyB2RestoreReadOnly({
    env,
    makeClient: () => ({ send: async () => { throw new Error('network prohibited in test'); } }),
    makeService: () => ({
      verifyLatestArchiveBatch: async dataset => ({
        dataset, verifiedObjects: 0, verifiedEvents: 0,
        checkpointEnd: '2026-10-22T00:00:00.000Z'
      })
    })
  }), /B2_READONLY_RESTORE_NO_DATA_OBJECT_VERIFIED/);
});

test('refuses invalid summary instead of claiming an unverified restore', async () => {
  await assert.rejects(verifyB2RestoreReadOnly({
    env,
    makeClient: () => ({ send: async () => ({}) }),
    makeService: () => ({ verifyLatestArchiveBatch: async dataset =>
      ({ dataset, verifiedObjects: 5, verifiedEvents: 0, checkpointEnd: 'not-a-date' }) })
  }), /B2_READONLY_RESTORE_VERIFICATION_REJECTED/);
});
