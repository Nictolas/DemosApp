'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createReadOnlyOverlapLoader } = require('../services/archiveOverlapB2Reader');
const { verifyArchiveOverlap } = require('../services/archiveOverlapVerifier');
const { recordFingerprint } = require('../services/axiomArchiveService');
const zlib = require('node:zlib');

const bucket = 'demos-log-archive-test';
const keyBase = 'demos/axiom-archive/v1/data/audit/year=2026/month=10/day=21/real-time/';
const key1 = keyBase + 'chunk-one.jsonl.gz';
const key2 = keyBase + 'chunk-two.jsonl.gz';
const event = {
  _time: '2026-10-21T12:00:00.000Z',
  log_type: 'audit', action: 'SYNTHETIC_ACTION', resource: 'test',
  axiom_delivery_id: '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f'
};

function makeRecordObject() {
  const line = {
    archive_event_id: recordFingerprint('real-time', event),
    source_dataset: 'real-time', category: 'audit', event
  };
  const body = zlib.gzipSync(Buffer.from(JSON.stringify(line) + '\n'));
  return {
    body,
    head: {
      ContentLength: body.length,
      ContentEncoding: 'gzip',
      Metadata: {
        archiveformat: 'demos-axiom-v1',
        sha256: crypto.createHash('sha256').update(body).digest('hex')
      }
    }
  };
}

function makeClient({ head, body, chunkSize = 7 }) {
  const calls = [];
  const client = {
    async send(command) {
      const name = command.constructor.name;
      calls.push({ name, input: command.input });
      if (name === 'HeadObjectCommand') return head;
      if (name === 'GetObjectCommand') {
        async function* stream() {
          for (let offset = 0; offset < body.length; offset += chunkSize) {
            yield body.subarray(offset, offset + chunkSize);
          }
        }
        return { Body: stream(), ContentEncoding: 'gzip' };
      }
      throw new Error('UNEXPECTED_B2_COMMAND');
    }
  };
  return { client, calls };
}

test('HEAD checks exact compressed size and GET uses a bounded byte range', async () => {
  const fixture = makeRecordObject();
  const { client, calls } = makeClient(fixture);
  const load = createReadOnlyOverlapLoader({ client, bucket });
  const res = await load(key1);
  assert.deepEqual(res.body, fixture.body);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, 'HeadObjectCommand');
  assert.equal(calls[1].name, 'GetObjectCommand');
  assert.equal(calls[1].input.Range, `bytes=0-${fixture.body.length - 1}`);
  assert.deepEqual(calls.map(x => x.input.Bucket), [bucket, bucket]);
});

test('oversized object is rejected after HEAD; no GET or event download', async () => {
  const f = makeRecordObject();
  const head = { ...f.head, ContentLength: 9 * 1024 * 1024 };
  const { client, calls } = makeClient({ head, body: f.body });
  const load = createReadOnlyOverlapLoader({ client, bucket });
  await assert.rejects(() => load(key1), /ARCHIVE_OVERLAP_B2_HEAD_INVALID/);
  assert.deepEqual(calls.map(x => x.name), ['HeadObjectCommand']);
});

test('truncated or oversized network response fails without partial result', async () => {
  const f = makeRecordObject();
  const shortClient = makeClient({ head: f.head, body: f.body.subarray(0, -1) });
  await assert.rejects(
    () => createReadOnlyOverlapLoader({ client: shortClient.client, bucket })(key1),
    /ARCHIVE_OVERLAP_B2_SIZE_CHANGED/
  );
  const longClient = makeClient({ head: f.head, body: Buffer.concat([f.body, Buffer.alloc(5)]) });
  await assert.rejects(
    () => createReadOnlyOverlapLoader({ client: longClient.client, bucket })(key1),
    /ARCHIVE_OVERLAP_B2_SIZE_CHANGED/
  );
});

test('refuses non-streaming bodies that might buffer an oversized object', async () => {
  const f = makeRecordObject();
  const client = {
    async send(command) {
      if (command.constructor.name === 'HeadObjectCommand') return f.head;
      return { Body: { transformToByteArray: async () => f.body } };
    }
  };
  await assert.rejects(
    () => createReadOnlyOverlapLoader({ client, bucket })(key1),
    /ARCHIVE_OVERLAP_B2_BODY_UNAVAILABLE/
  );
});

test('range-bounded HEAD+GET operations reconcile two objects end-to-end', async () => {
  const f = makeRecordObject();
  const { client, calls } = makeClient(f);
  const result = await verifyArchiveOverlap({
    dataset: 'real-time',
    prefix: 'demos/axiom-archive/v1',
    keys: [key1, key2],
    recordFingerprint,
    load: createReadOnlyOverlapLoader({ client, bucket })
  });
  assert.equal(result.recordsExamined, 2);
  assert.equal(result.uniqueEvents, 1);
  assert.equal(result.duplicateCopies, 1);
  assert.deepEqual(calls.map(x => x.name),
    ['HeadObjectCommand', 'GetObjectCommand', 'HeadObjectCommand', 'GetObjectCommand']);
});

test('reader disallows missing credentials/client and invalid max size', () => {
  assert.throws(() => createReadOnlyOverlapLoader({ client: null, bucket }), /INVALID_CONFIGURATION/);
  assert.throws(() => createReadOnlyOverlapLoader({ client: {}, bucket }), /INVALID_CONFIGURATION/);
  assert.throws(() => createReadOnlyOverlapLoader({ client: { send() {} }, bucket, maxBytes: 99999999 }),
    /INVALID_CONFIGURATION/);
});
