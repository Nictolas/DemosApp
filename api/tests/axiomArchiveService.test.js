const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');

const {
  AxiomArchiveService,
  classifyRecord,
  recordFingerprint,
  sortAndDedupe,
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
  assert.equal(classifyRecord({ log_type: 'security', message: 'Evento di sicurezza: access' }), 'security');
  assert.equal(classifyRecord({ log_type: 'audit', message: 'Audit: update su users' }), 'audit');
  assert.equal(classifyRecord({ message: 'Evento di sicurezza: access' }), 'security');
  assert.equal(classifyRecord({ message: 'Audit: update su users' }), 'audit');
  assert.equal(classifyRecord({ level: 'ERROR', message: 'boom' }), 'technical');
  assert.equal(classifyRecord({ log_type: 'technical', message: 'GET /api/health' }), 'technical');
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

test('archive restore verification rejects modified object bytes', async () => {
  const b2Client = new MemoryB2Client();
  const service = new AxiomArchiveService({ env: makeEnv(), b2Client });
  const event = { _time: '2026-10-06T15:05:00.000Z', level: 'INFO' };
  const envelope = {
    archive_event_id: recordFingerprint('centralized_logs', event),
    source_dataset: 'centralized_logs',
    category: 'technical',
    event
  };
  const key = 'test/data/technical/verified.jsonl.gz';
  await service.putVerifiedObject({
    key,
    body: zlib.gzipSync(Buffer.from(JSON.stringify(envelope) + '\n')),
    contentType: 'application/x-ndjson',
    contentEncoding: 'gzip'
  });
  assert.equal((await service.verifyArchiveObject(key)).recordCount, 1);
  const entry = b2Client.objects.get(key);
  entry.body[0] ^= 0x01;
  await assert.rejects(() => service.verifyArchiveObject(key), /SHA-256 mismatch/);
});

test('archive restore verification rejects modified event fingerprints even with matching object hash', async () => {
  const b2Client = new MemoryB2Client();
  const service = new AxiomArchiveService({ env: makeEnv(), b2Client });
  const event = { _time: '2026-10-06T15:05:00.000Z', level: 'INFO' };
  const key = 'test/data/technical/forged.jsonl.gz';
  await service.putVerifiedObject({
    key,
    body: zlib.gzipSync(Buffer.from(JSON.stringify({
      archive_event_id: 'invalid-fingerprint',
      source_dataset: 'centralized_logs',
      category: 'technical',
      event
    }) + '\n')),
    contentType: 'application/x-ndjson',
    contentEncoding: 'gzip'
  });
  await assert.rejects(() => service.verifyArchiveObject(key), /fingerprint mismatch/);
});

test('read-only recovery drill verifies latest checkpoint, manifest and gzipped events', async () => {
  const b2Client = new MemoryB2Client();
  const env = makeEnv({
    AXIOM_ARCHIVE_DATASETS: 'centralized_logs',
    AXIOM_ARCHIVE_INITIAL_LOOKBACK_HOURS: '1',
    AXIOM_ARCHIVE_SAFETY_LAG_SECONDS: '120'
  });
  const sourceTime = '2026-10-06T15:50:00.000Z';
  const axiomClient = {
    async query(_apl, options) {
      return {
        matches: new Date(options.startTime).getTime() <= Date.parse(sourceTime) &&
          Date.parse(sourceTime) < new Date(options.endTime).getTime()
          ? [{ _time: sourceTime, level: 'INFO', message: 'synthetic event' }]
          : []
      };
    }
  };
  const service = new AxiomArchiveService({
    env,
    axiomClient,
    b2Client,
    clock: () => new Date('2026-10-06T16:00:00.000Z')
  });
  await service.runOnce();
  const before = b2Client.objects.size;
  const verified = await service.verifyLatestArchiveBatch('centralized_logs');
  assert.equal(verified.dataset, 'centralized_logs');
  assert.equal(verified.checkpointEnd, '2026-10-06T15:58:00.000Z');
  assert.equal(verified.verifiedEvents, 1);
  assert.equal(verified.categories.technical, 1);
  assert.equal(verified.verifiedObjects, 1);
  assert.equal(b2Client.objects.size, before, 'read-only drill must not upload objects');
});

test('recovery drill fails closed if latest B2 manifest bytes were changed', async () => {
  const b2Client = new MemoryB2Client();
  const env = makeEnv({ AXIOM_ARCHIVE_DATASETS: 'centralized_logs', AXIOM_ARCHIVE_INITIAL_LOOKBACK_HOURS: '1' });
  const service = new AxiomArchiveService({
    env,
    axiomClient: { async query() { return { matches: [] }; } },
    b2Client,
    clock: () => new Date('2026-10-06T16:00:00.000Z')
  });
  await service.runOnce();
  const checkpoint = await service.loadCheckpoint('centralized_logs');
  const entry = b2Client.objects.get(checkpoint.lastManifestKey);
  entry.body[0] ^= 0x01;
  await assert.rejects(() => service.verifyLatestArchiveBatch('centralized_logs'), /manifest integrity verification failed/);
});

test('recovery drill fails closed without a B2 checkpoint', async () => {
  const service = new AxiomArchiveService({
    env: makeEnv(),
    b2Client: new MemoryB2Client()
  });
  await assert.rejects(() => service.verifyLatestArchiveBatch('centralized_logs'), /checkpoint not found/);
});

test('replayed audit events dedupe on stable delivery UUID despite Axiom ingestion metadata', () => {
  const deliveryId = '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f';
  const original = {
    _time: '2026-10-21T12:00:00.000Z', log_type: 'audit',
    action: 'DATA_ACCESS', resource: 'users', success: true,
    axiom_delivery_id: deliveryId,
    _id: 'axiom-record-001',
    _sysTime: '2026-10-21T12:00:01.000Z'
  };
  const retry = { ...original,
    _id: 'axiom-record-002',
    _sysTime: '2026-10-21T12:01:44.000Z',
    axiom_delivery_id: deliveryId.toUpperCase()
  };
  assert.equal(recordFingerprint('real-time', original), recordFingerprint('real-time', retry));
  assert.notEqual(recordFingerprint('centralized_logs', original), recordFingerprint('real-time', retry));
  const stored = sortAndDedupe('real-time', [original, retry]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].record.axiom_delivery_id, deliveryId);
  assert.equal(stored[0].record._id, undefined);
  assert.equal(stored[0].record._sysTime, undefined);
  assert.equal(classifyRecord(stored[0].record), 'audit');
});

test('conflicting audit events sharing a delivery UUID abort archival without leaking content', () => {
  const id = '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f';
  const first = {
    _time: '2026-10-21T12:00:00.000Z', log_type: 'audit',
    axiom_delivery_id: id,
    action: 'DATA_ACCESS', resource: 'users'
  };
  const incompatible = { ...first, action: 'SECRET_PERSONAL_MESSAGE' };
  assert.throws(() => sortAndDedupe('real-time', [first, incompatible]),
    error => error.message === 'AXIOM_ARCHIVE_DELIVERY_ID_CONFLICT');
});

test('legacy/non-audit events keep content fingerprints rather than trusting unvalidated UUID', () => {
  const deliveryId = '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f';
  const base = {
    _time: '2026-10-21T12:00:00.000Z',
    log_type: 'technical', axiom_delivery_id: deliveryId,
    _sysTime: '2026-10-21T12:00:01Z'
  };
  const other = { ...base, _sysTime: '2026-10-21T12:10:00Z' };
  assert.notEqual(recordFingerprint('real-time', base), recordFingerprint('real-time', other));
  assert.equal(sortAndDedupe('real-time', [base, other]).length, 2);
  const invalid = { ...base, log_type: 'audit', axiom_delivery_id: 'invalid-id' };
  assert.notEqual(recordFingerprint('real-time', invalid),
    recordFingerprint('real-time', { ...invalid, _sysTime: 'other' }));
});

test('audit archive groups contain one copy after replayed Axiom ingestion', () => {
  const id = '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f';
  const first = {
    _time: '2026-10-21T12:00:00.000Z', log_type: 'audit',
    axiom_delivery_id: id, action: 'CONSENT_CHANGE',
    resource: 'users', _id: 'ingest-1'
  };
  const replay = { ...first, _id: 'ingest-2' };
  const b2 = new MemoryB2Client();
  const service = new AxiomArchiveService({
    env: makeEnv(),
    axiomClient: { query: async () => ({ matches: [] }) },
    b2Client: b2
  });
  const deduped = sortAndDedupe('real-time', [first, replay]);
  const groups = service.buildArchiveGroups('real-time', deduped, new Date('2026-10-21T12:20:00.000Z'));
  assert.equal(groups.get('audit').length, 1);
  assert.equal(groups.get('security').length, 0);
  assert.equal(groups.get('audit')[0].archive_event_id, recordFingerprint('real-time', replay));
});
