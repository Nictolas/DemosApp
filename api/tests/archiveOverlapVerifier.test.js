'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { verifyArchiveOverlap } = require('../services/archiveOverlapVerifier');
const { recordFingerprint } = require('../services/axiomArchiveService');

const dataset = 'real-time';
const prefix = 'demos/axiom-archive/v1';
const firstKey = prefix + '/data/audit/year=2026/month=10/day=21/real-time/window-first.jsonl.gz';
const secondKey = prefix + '/data/audit/year=2026/month=10/day=21/real-time/window-second.jsonl.gz';
const secretEvent = Object.freeze({
  _time: '2026-10-21T12:00:00.000Z',
  log_type: 'audit', action: 'CONSENT_CHANGE', resource: 'users',
  user_id: 'test-private-identifier',
  axiom_delivery_id: '9b5d5063-d6bf-4c23-9bbc-ef979a1c587f'
});

function wrap(event, archivedAt) {
  return {
    archive_event_id: recordFingerprint(dataset, event),
    source_dataset: dataset, category: 'audit',
    event_time: event._time, archived_at: archivedAt, event
  };
}

function objectFromEnvelopes(envelopes) {
  const body = zlib.gzipSync(Buffer.from(envelopes.map(x => JSON.stringify(x)).join('\n') + '\n'));
  return {
    body, metadata: {
      archiveformat: 'demos-axiom-v1',
      sha256: crypto.createHash('sha256').update(body).digest('hex')
    },
    contentEncoding: 'gzip'
  };
}

function fixture(envelopesA, envelopesB) {
  const objects = new Map([
    [firstKey, objectFromEnvelopes(envelopesA)],
    [secondKey, objectFromEnvelopes(envelopesB)]
  ]);
  const calls = [];
  return {
    objects, calls,
    opts: {
      dataset, prefix, keys: [firstKey, secondKey], recordFingerprint,
      load: async key => { calls.push(key); return objects.get(key); }
    }
  };
}

test('read-only overlap verifier reconciles same event across two archive objects', async () => {
  const same = { ...secretEvent };
  const fresh = { ...secretEvent, action: 'DATA_EXPORT',
    axiom_delivery_id: '6a39139f-75af-476f-b01f-6a0f855dd03d' };
  const f = fixture(
    [wrap(same, '2026-10-21T12:10:00Z')],
    [wrap(same, '2026-10-21T12:20:00Z'), wrap(fresh, '2026-10-21T12:20:00Z')]
  );
  const stats = await verifyArchiveOverlap(f.opts);
  assert.deepEqual(stats, {
    dataset: 'real-time', objectsExamined: 2,
    recordsExamined: 3, uniqueEvents: 2, duplicateCopies: 1,
    uniqueCategories: { technical: 0, audit: 2, security: 0 }
  });
  assert.deepEqual(f.calls, [firstKey, secondKey], 'only GET-equivalent operations requested');
  assert.ok(!JSON.stringify(stats).includes('test-private-identifier'));
});

test('tampered compressed bytes fail verification, do not return partially successful report', async () => {
  const f = fixture([wrap(secretEvent, '2026-10-21T12:10:00Z')],
    [wrap(secretEvent, '2026-10-21T12:20:00Z')]);
  f.objects.get(secondKey).body[4] ^= 0x01;
  await assert.rejects(() => verifyArchiveOverlap(f.opts),
    /ARCHIVE_OVERLAP_OBJECT_INVALID/);
});

test('same archive event ID but incompatible payload aborts read-only restore drill', async () => {
  const incompatible = { ...secretEvent, action: 'SECURITY_REVOKE' };
  const f = fixture([wrap(secretEvent, '2026-10-21T12:10:00Z')],
    [wrap(incompatible, '2026-10-21T12:20:00Z')]);
  await assert.rejects(() => verifyArchiveOverlap(f.opts),
    /ARCHIVE_OVERLAP_ID_CONFLICT/);
});

test('invalid source event ID does not pass just because the B2 object SHA256 is valid', async () => {
  const envelope = { ...wrap(secretEvent, '2026-10-21T12:20:00Z'), archive_event_id: 'f'.repeat(64) };
  const f = fixture([wrap(secretEvent, '2026-10-21T12:10:00Z')], [envelope]);
  await assert.rejects(() => verifyArchiveOverlap(f.opts), /ARCHIVE_OVERLAP_RECORD_INVALID/);
});

test('wrong category/dataset/object paths rejected before remote reads', async () => {
  const f = fixture([wrap(secretEvent, '2026-10-21T12:10:00Z')],
    [wrap(secretEvent, '2026-10-21T12:20:00Z')]);
  const examples = [
    '../control/real-time.json',
    prefix + '/control/real-time.json',
    secondKey.replace('/real-time/', '/centralized_logs/'),
    secondKey.replace('/audit/', '/anything/'),
    secondKey.replace('day=21', 'day=99')
  ];
  for (const invalid of examples) {
    await assert.rejects(
      () => verifyArchiveOverlap({ ...f.opts, keys: [firstKey, invalid] }),
      /ARCHIVE_OVERLAP_INVALID_KEY|ARCHIVE_OVERLAP_INVALID_ARGS/
    );
  }
  assert.equal(f.calls.length, 0);
});

test('repeated same key, single key and excessive keys are rejected before reads', async () => {
  const f = fixture([], []);
  const cases = [[firstKey], [firstKey, firstKey],
    Array.from({ length: 13 }, (_, i) => firstKey.replace('first', 'first' + i))];
  for (const keys of cases) {
    await assert.rejects(
      () => verifyArchiveOverlap({ ...f.opts, keys }),
      /ARCHIVE_OVERLAP_INVALID_ARGS/
    );
  }
  assert.equal(f.calls.length, 0);
});

test('gzip decompression bomb is stopped by output size limit', async () => {
  const huge = Buffer.alloc(33 * 1024 * 1024, 'a');
  const body = zlib.gzipSync(huge);
  const object = { body,
    metadata: {
      archiveformat: 'demos-axiom-v1',
      sha256: crypto.createHash('sha256').update(body).digest('hex')
    },
    contentEncoding: 'gzip'
  };
  const f = fixture([], []);
  f.objects.set(secondKey, object);
  await assert.rejects(() => verifyArchiveOverlap(f.opts), /ARCHIVE_OVERLAP_DECODE_FAILED/);
});
