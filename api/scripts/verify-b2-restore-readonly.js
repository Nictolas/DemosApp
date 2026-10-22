'use strict';

// Deliberately independent of the API server, Axiom writes, notifications,
// production database and archive scheduler. Requires a separate B2 key with
// read-only bucket permissions: the SDK wrapper also denies non-read commands.
const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { AxiomArchiveService, createB2Client } = require('../services/axiomArchiveService');

const DATASETS = Object.freeze(['centralized_logs', 'real-time']);
const ENDPOINT = 'https://s3.eu-central-003.backblazeb2.com';
const BUCKET = 'demos-log-archive-eu';
const PREFIX = 'demos/axiom-archive/v1';

function assertReadOnlyB2RestoreEnvironment(env = process.env) {
  const forbidden = [
    'DATABASE_URL', 'AUDIT_OUTBOX_DATABASE_URL',
    'AXIOM_API_TOKEN', 'AXIOM_ORG_ID',
    'B2_APPLICATION_KEY_ID', 'B2_APPLICATION_KEY'
  ];
  if (env.B2_RESTORE_READONLY_MODE !== 'true' ||
      env.AXIOM_ARCHIVE_ENABLED === 'true' ||
      env.B2_S3_ENDPOINT !== ENDPOINT ||
      env.B2_S3_REGION !== 'eu-central-003' ||
      env.B2_BUCKET_NAME !== BUCKET ||
      (env.AXIOM_ARCHIVE_PREFIX && env.AXIOM_ARCHIVE_PREFIX !== PREFIX) ||
      forbidden.some(name => Boolean(env[name])) ||
      !env.B2_S3_ACCESS_KEY_ID || !env.B2_S3_SECRET_ACCESS_KEY) {
    throw new Error('B2_READONLY_RESTORE_CONFIGURATION_REJECTED');
  }
  return true;
}

function readOnlyB2Transport(client) {
  if (!client || typeof client.send !== 'function') {
    throw new Error('B2_READONLY_RESTORE_CLIENT_REJECTED');
  }
  return {
    send: async command => {
      if (!(command instanceof HeadObjectCommand) &&
          !(command instanceof GetObjectCommand)) {
        throw new Error('B2_READONLY_RESTORE_WRITE_REJECTED');
      }
      if (command.input?.Bucket !== BUCKET ||
          typeof command.input?.Key !== 'string' ||
          !command.input.Key.startsWith(PREFIX + '/')) {
        throw new Error('B2_READONLY_RESTORE_TARGET_REJECTED');
      }
      if (command instanceof GetObjectCommand) {
        const match = /^bytes=0-([0-9]{1,9})$/.exec(command.input?.Range || '');
        if (!match || Number(match[1]) >= 8 * 1024 * 1024) {
          throw new Error('B2_READONLY_RESTORE_RANGE_REJECTED');
        }
      }
      return client.send(command);
    }
  };
}

async function verifyB2RestoreReadOnly({
  env = process.env,
  makeClient = () => createB2Client(env),
  makeService = opts => new AxiomArchiveService(opts)
} = {}) {
  assertReadOnlyB2RestoreEnvironment(env);
  const client = readOnlyB2Transport(makeClient());
  const service = makeService({ env, b2Client: client });
  const summaries = [];
  for (const dataset of DATASETS) {
    const result = await service.verifyLatestArchiveBatch(dataset);
    if (result?.dataset !== dataset ||
        !Number.isSafeInteger(result.verifiedObjects) ||
        result.verifiedObjects < 0 || result.verifiedObjects > 3 ||
        !Number.isSafeInteger(result.verifiedEvents) ||
        result.verifiedEvents < 0 ||
        !Number.isFinite(new Date(result.checkpointEnd).getTime())) {
      throw new Error('B2_READONLY_RESTORE_VERIFICATION_REJECTED');
    }
    summaries.push({
      dataset,
      verifiedObjects: result.verifiedObjects,
      verifiedEvents: result.verifiedEvents,
      checkpointEnd: result.checkpointEnd
    });
  }
  return { status: 'B2_READONLY_RESTORE_VERIFIED', summaries };
}

if (require.main === module) {
  verifyB2RestoreReadOnly().then(result => {
    console.log(JSON.stringify(result));
  }).catch(() => {
    // Never log provider errors, object keys, credentials or event bodies.
    console.error('B2_READONLY_RESTORE_FAILED');
    process.exitCode = 1;
  });
}

module.exports = {
  DATASETS, assertReadOnlyB2RestoreEnvironment,
  readOnlyB2Transport, verifyB2RestoreReadOnly
};
