'use strict';

const zlib = require('node:zlib');
const crypto = require('node:crypto');

// Conservative bounds for an operator-invoked, read-only overlap drill.
// The tool never writes restored user event bodies to disk or stdout.
const MAX_OBJECTS = 12;
const MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_EVENTS = 60000;
const CATEGORIES = Object.freeze(['technical', 'audit', 'security']);

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map(canonicalize));
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalize(value[k])]));
  }
  return value;
}

function checkArgs({ dataset, prefix, keys, load, recordFingerprint }) {
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(dataset || '') ||
      !/^[A-Za-z0-9._/-]{1,200}$/.test(prefix || '') ||
      prefix.includes('..') || prefix.startsWith('/') || prefix.endsWith('/') ||
      !Array.isArray(keys) || keys.length < 2 || keys.length > MAX_OBJECTS ||
      new Set(keys).size !== keys.length ||
      typeof load !== 'function' || typeof recordFingerprint !== 'function') {
    throw new Error('ARCHIVE_OVERLAP_INVALID_ARGS');
  }
  for (const key of keys) {
    if (typeof key !== 'string' || key.length > 512 ||
        !key.startsWith(`${prefix}/data/`) || key.includes('..') ||
        key.includes('\\') || key.includes('//')) {
      throw new Error('ARCHIVE_OVERLAP_INVALID_KEY');
    }
    const parts = key.slice(prefix.length + 1).split('/');
    if (parts.length !== 7 || parts[0] !== 'data' ||
        !CATEGORIES.includes(parts[1]) ||
        !/^year=[0-9]{4}$/.test(parts[2]) ||
        !/^month=(0[1-9]|1[0-2])$/.test(parts[3]) ||
        !/^day=(0[1-9]|[12][0-9]|3[01])$/.test(parts[4]) ||
        parts[5] !== dataset || !/^[A-Za-z0-9._-]+\.jsonl\.gz$/.test(parts[6])) {
      throw new Error('ARCHIVE_OVERLAP_INVALID_KEY');
    }
  }
}

async function verifyArchiveOverlap({ dataset, prefix, keys, load, recordFingerprint }) {
  checkArgs({ dataset, prefix, keys, load, recordFingerprint });

  const seen = new Map();
  let examinedEvents = 0;
  let duplicates = 0;
  const uniqueCategories = { technical: 0, audit: 0, security: 0 };

  for (const key of keys) {
    const category = CATEGORIES.find(c => key.startsWith(`${prefix}/data/${c}/`));
    const { body, metadata, contentEncoding } = await load(key);
    if (!Buffer.isBuffer(body) || body.length > MAX_COMPRESSED_BYTES ||
        metadata?.archiveformat !== 'demos-axiom-v1' || metadata.sha256 !== hash(body) ||
        (contentEncoding && contentEncoding !== 'gzip')) {
      throw new Error('ARCHIVE_OVERLAP_OBJECT_INVALID');
    }

    let decoded;
    try {
      decoded = zlib.gunzipSync(body, { maxOutputLength: MAX_DECOMPRESSED_BYTES });
    } catch (_error) {
      throw new Error('ARCHIVE_OVERLAP_DECODE_FAILED');
    }

    const lines = decoded.toString('utf8').split('\n').filter(Boolean);
    if (examinedEvents + lines.length > MAX_EVENTS) {
      throw new Error('ARCHIVE_OVERLAP_EVENT_LIMIT');
    }
    for (const line of lines) {
      let envelope;
      try {
        envelope = JSON.parse(line);
      } catch (_error) {
        throw new Error('ARCHIVE_OVERLAP_RECORD_INVALID');
      }
      if (!envelope || envelope.source_dataset !== dataset ||
          envelope.category !== category || typeof envelope.event !== 'object' ||
          envelope.event === null ||
          typeof envelope.archive_event_id !== 'string' ||
          !/^[a-f0-9]{64}$/.test(envelope.archive_event_id) ||
          recordFingerprint(dataset, envelope.event) !== envelope.archive_event_id) {
        throw new Error('ARCHIVE_OVERLAP_RECORD_INVALID');
      }

      const payloadHash = hash(canonicalStringify(envelope.event));
      const previous = seen.get(envelope.archive_event_id);
      if (previous) {
        if (previous.payloadHash !== payloadHash || previous.category !== category) {
          // No full event or identifiers in the exception text.
          throw new Error('ARCHIVE_OVERLAP_ID_CONFLICT');
        }
        duplicates++;
      } else {
        seen.set(envelope.archive_event_id, { payloadHash, category });
        uniqueCategories[category]++;
      }
      examinedEvents++;
    }
  }

  return {
    dataset,
    objectsExamined: keys.length,
    recordsExamined: examinedEvents,
    uniqueEvents: seen.size,
    duplicateCopies: duplicates,
    uniqueCategories
  };
}

module.exports = { verifyArchiveOverlap, MAX_OBJECTS, MAX_EVENTS };
