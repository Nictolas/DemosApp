const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');

const {
  AxiomArchiveService,
  classifyRecord,
  recordFingerprint,
  stableStringify
} = require('../services/axiomArchiveService');

class MemoryB2Client {
  constructor({ failHead = false } = {}) {
    this.objects = new Map();
    this.failHead = failHead;
  }

  async send(command) {
    const name = command.constructor.name;
    const input = command.input;

    if (name === 'GetObjectCommand') {
      const entry = this.objects.get(input.Key);
      if (!entry) {
        const error = new Error('NoSuchKey');
        error.name = 'NoSuchKey';
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }
      return {
        Body: {
          transformToByteArray: async () => Uint8Array.from(entry.body)
        },
        Metadata: entry.metadata,
        ContentEncoding: entry.contentEncoding,
        ContentType: entry.contentType
      };
    }

    if (name === 'PutObjectCommand') {
      const body = Buffer.isBuffer(input.Body) ? Buffer.from(input.Body) : Buffer.from(input.Body || '');
      this.objects.set(input.Key, {
        body,
        metadata: input.Metadata || {},
        contentEncoding: input.ContentEncoding,
        contentType: input.ContentType,
        serverSideEncryption: input.ServerSideEncryption
      });
      return {};
    }

    if (name === 'HeadObjectCommand') {
      if (this.failHead) return { ContentLength: -1, Metadata: {} };
      const entry = this.objects.get(input.Key);
      if (!entry) {
        const error = new Error('NoSuchKey');
        error.name = 'NoSuchKey';
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }
      return {
        ContentLength: entry.body.length,
        Metadata: entry.metadata
      };
    }

    throw new Error(`Unexpected command: ${name}`);
  }
}

function makeEnv(overrides = {}) {
  return {
    AXIOM_ARCHIVE_ENABLED: 'true',
    AXIOM_API_TOKEN: 'test-token',
    AXIOM_ORG_ID: 'test-org',
    AXIOM_REGION: 'eu',
    AXIOM_DATASET: 'centralized_logs',
    AXIOM_REALTIME_DATASET: 'real-time',
    AXIOM_ARCHIVE_INITIAL_LOOKBACK_HOURS: '1',
    AXIOM_ARCHIVE_OVERLAP_SECONDS: '300',
    AXIOM_ARCHIVE_SAFETY_LAG_SECONDS: '0',
    AXIOM_ARCHIVE_MAX_WINDOW_MINUTES: '15',
    AXIOM_ARCHIVE_CHUNK_MINUTES: '15',
    AXIOM_ARCHIVE_MAX_CHUNKS_PER_RUN: '24',
    AXIOM_ARCHIVE_QUERY_LIMIT: '10',
    AXIOM_ARCHIVE_MIN_WINDOW_MS: '1000',
    B2_BUCKET_NAME: 'demos-log-archive-test',
    B2_S3_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com',
    B2_S3_REGION: 'eu-central-003',
    B2_S3_ACCESS_KEY_ID: 'test-key-id',
    B2_S3_SECRET_ACCESS_KEY: 'test-secret',
    ...overrides
  };
}

test('stableStringify and record fingerprints are deterministic', () => {
  const a = { b: 2, a: { z: 3, y: 1 } };
  const b = { a: { y: 1, z: 3 }, b: 2 };
  assert.equal(stableStringify(a), stableStringify(b));
  assert.equal(recordFingerprint('real-time', a), recordFingerprint('real-time', b));
});

test('record classifier separates security, audit and technical events', () => {
  assert.equal(classifyRecord({ type: 'failed_login', severity: 'high' }), 'security');
  assert.equal(classifyRecord({ action: 'DATA_ACCESS', resource: 'opinions' }), 'audit');
  assert.equal(classifyRecord({ level: 'ERROR', message: 'boom' }), 'technical');
});

test('adaptive query splitting avoids silently accepting a saturated result', async () => {
  const calls = [];
  const axiomClient = {
    async query(_apl, options) {
      const start = new Date(options.startTime).getTime();
      const end = new Date(options.endTime).getTime();
      calls.push([start, end]);
      if (end - start > 1000) {
        return { matches: Array.from({ length: 10 }, (_, i) => ({ _time: new Date(start + i).toISOString(), i })) };
      }
      return { matches: [{ _time: new Date(start).toISOString(), start }] };
    }
  };
  const service = new AxiomArchiveService({
    env: makeEnv({ AXIOM_ARCHIVE_QUERY_LIMIT: '10', AXIOM_ARCHIVE_MIN_WINDOW_MS: '1000' }),
    axiomClient,
    b2Client: new MemoryB2Client()
  });

  const result = await service.fetchAdaptiveWindow('real-time', new Date(0), new Date(4000));
  assert.ok(calls.length > 1);
  assert.ok(result.length >= 2);
});

test('one archive run writes gzipped category data, manifest and checkpoint with verified hashes', async () => {
  const b2Client = new MemoryB2Client();
  const sourceEvents = {
    centralized_logs: [
      { _time: '2026-10-06T15:05:00.000Z', level: 'ERROR', message: 'technical event' }
    ],
    'real-time': [
      { _time: '2026-10-06T15:20:00.000Z', action: 'DATA_ACCESS', resource: 'opinions', success: true },
      { _time: '2026-10-06T15:21:00.000Z', type: 'failed_login', severity: 'high' }
    ]
  };
  const axiomClient = {
    async query(apl, options) {
      const dataset = apl.includes("['centralized_logs']") ? 'centralized_logs' : 'real-time';
      const start = new Date(options.startTime).getTime();
      const end = new Date(options.endTime).getTime();
      return {
        matches: sourceEvents[dataset].filter(event => {
          const time = new Date(event._time).getTime();
          return time >= start && time < end;
        })
      };
    }
  };

  const now = new Date('2026-10-06T16:00:00.000Z');
  const service = new AxiomArchiveService({ env: makeEnv(), axiomClient, b2Client, clock: () => now });
  const results = await service.runOnce({ now });

  assert.equal(results.length, 2);
  assert.equal(results[0].count, 1);
  assert.equal(results[1].count, 2);

  const keys = [...b2Client.objects.keys()];
  assert.ok(keys.some(key => key.includes('/data/technical/')));
  assert.ok(keys.some(key => key.includes('/data/audit/')));
  assert.ok(keys.some(key => key.includes('/data/security/')));
  assert.equal(keys.filter(key => key.includes('/control/')).length, 2);
  assert.equal(keys.filter(key => key.includes('/manifests/')).length, 8);

  const archiveKey = keys.find(key => key.endsWith('.jsonl.gz'));
  const archiveEntry = b2Client.objects.get(archiveKey);
  assert.equal(archiveEntry.serverSideEncryption, 'AES256');
  const decoded = zlib.gunzipSync(archiveEntry.body).toString('utf8');
  const envelope = JSON.parse(decoded.trim());
  assert.ok(envelope.archive_event_id);
  assert.equal(envelope.source_dataset, 'centralized_logs');

  const verified = await service.verifyArchiveObject(archiveKey);
  assert.equal(verified.recordCount, 1);
});

test('checkpoint is not advanced when B2 post-upload integrity verification fails', async () => {
  const b2Client = new MemoryB2Client({ failHead: true });
  const axiomClient = {
    async query() {
      return { matches: [{ _time: '2026-10-06T15:30:00.000Z', level: 'INFO', message: 'x' }] };
    }
  };
  const service = new AxiomArchiveService({
    env: makeEnv({ AXIOM_ARCHIVE_DATASETS: 'centralized_logs' }),
    axiomClient,
    b2Client,
    clock: () => new Date('2026-10-06T16:00:00.000Z')
  });

  await assert.rejects(() => service.runOnce(), /integrity verification failed/);
  assert.equal([...b2Client.objects.keys()].some(key => key.includes('/control/')), false);
});


test('max chunks per run bounds backfill work and advances checkpoint incrementally', async () => {
  const b2Client = new MemoryB2Client();
  const axiomClient = {
    async query(_apl, options) {
      return { matches: [{ _time: new Date(options.startTime).toISOString(), level: 'INFO', message: 'chunk' }] };
    }
  };
  const now = new Date('2026-10-06T16:00:00.000Z');
  const service = new AxiomArchiveService({
    env: makeEnv({
      AXIOM_ARCHIVE_DATASETS: 'centralized_logs',
      AXIOM_ARCHIVE_INITIAL_LOOKBACK_HOURS: '1',
      AXIOM_ARCHIVE_CHUNK_MINUTES: '15',
      AXIOM_ARCHIVE_MAX_CHUNKS_PER_RUN: '2'
    }),
    axiomClient,
    b2Client,
    clock: () => now
  });

  const [result] = await service.runOnce({ now });
  assert.equal(result.chunks, 2);
  assert.equal(result.caughtUp, false);
  assert.equal(result.endTime.toISOString(), '2026-10-06T15:30:00.000Z');
  assert.equal(result.checkpoint.lastSuccessfulEnd, '2026-10-06T15:30:00.000Z');
  assert.equal(result.remainingMs, 30 * 60 * 1000);
});


test('retrying the same chunk is idempotent at the B2 data-object key level', async () => {
  const b2Client = new MemoryB2Client();
  const axiomClient = {
    async query() {
      return { matches: [{ _time: '2026-10-06T15:05:00.000Z', level: 'INFO', message: 'same event' }] };
    }
  };
  const env = makeEnv({
    AXIOM_ARCHIVE_DATASETS: 'centralized_logs',
    AXIOM_ARCHIVE_INITIAL_LOOKBACK_HOURS: '1',
    AXIOM_ARCHIVE_CHUNK_MINUTES: '15',
    AXIOM_ARCHIVE_MAX_CHUNKS_PER_RUN: '1'
  });
  const service = new AxiomArchiveService({ env, axiomClient, b2Client });
  const start = new Date('2026-10-06T15:00:00.000Z');
  const end = new Date('2026-10-06T15:15:00.000Z');

  const first = await service.archiveWindow({
    dataset: 'centralized_logs',
    startTime: start,
    endTime: end,
    archivedAt: new Date('2026-10-06T16:00:00.000Z')
  });
  const firstDataKey = first.objects[0].key;

  const second = await service.archiveWindow({
    dataset: 'centralized_logs',
    startTime: start,
    endTime: end,
    archivedAt: new Date('2026-10-06T16:05:00.000Z')
  });
  const secondDataKey = second.objects[0].key;

  assert.equal(secondDataKey, firstDataKey);
});
