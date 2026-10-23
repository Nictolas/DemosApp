'use strict';

const { HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

// Restrict B2 costs and memory *before* downloading any archive object.
// The HEAD is read-only and the subsequent GET is range-bounded.
const MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;

async function boundedBodyToBuffer(body, expectedSize) {
  const chunks = [];
  let total = 0;
  if (!body || typeof body[Symbol.asyncIterator] !== 'function') {
    // Refuse byte-array helpers: they may buffer an unbounded response before
    // our size guard runs. Node's S3 body supports async iteration.
    throw new Error('ARCHIVE_OVERLAP_B2_BODY_UNAVAILABLE');
  }
  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > expectedSize) throw new Error('ARCHIVE_OVERLAP_B2_SIZE_CHANGED');
    chunks.push(buffer);
  }
  if (total !== expectedSize) throw new Error('ARCHIVE_OVERLAP_B2_SIZE_CHANGED');
  return Buffer.concat(chunks, total);
}

function createReadOnlyOverlapLoader({ client, bucket, maxBytes = MAX_COMPRESSED_BYTES }) {
  if (!client || typeof client.send !== 'function' ||
      typeof bucket !== 'string' || !/^[A-Za-z0-9.-]{3,128}$/.test(bucket) ||
      !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_COMPRESSED_BYTES) {
    throw new Error('ARCHIVE_OVERLAP_B2_INVALID_CONFIGURATION');
  }
  return async function load(key) {
    // Key validation in archiveOverlapVerifier happens before invoking load.
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const byteLength = Number(head.ContentLength);
    if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > maxBytes ||
        head.Metadata?.archiveformat !== 'demos-axiom-v1' ||
        typeof head.Metadata.sha256 !== 'string' ||
        !/^[a-f0-9]{64}$/.test(head.Metadata.sha256)) {
      throw new Error('ARCHIVE_OVERLAP_B2_HEAD_INVALID');
    }
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: `bytes=0-${byteLength - 1}`
    }));
    const body = await boundedBodyToBuffer(response.Body, byteLength);
    return {
      body,
      metadata: head.Metadata,
      contentEncoding: head.ContentEncoding || response.ContentEncoding
    };
  };
}

module.exports = { createReadOnlyOverlapLoader, MAX_COMPRESSED_BYTES, boundedBodyToBuffer };
