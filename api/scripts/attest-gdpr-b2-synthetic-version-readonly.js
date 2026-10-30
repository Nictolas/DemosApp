'use strict';

// Operator-only fixture verifier. It can read exactly one reserved synthetic
// object version; never a real GDPR event, a listing, or a database record.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  S3Client, GetObjectRetentionCommand, GetObjectCommand
} = require('@aws-sdk/client-s3');
const {
  MARKER: METADATA_MARKER, assertSafeEnvironment
} = require('./attest-gdpr-b2-bucket-readonly');

const MARKER = 'demos-gdpr-b2-synthetic-version-readonly-v1';
const OBJECT_KEY = 'demos/gdpr-erasure/v1/attestation/synthetic/object-lock-probe-v1.json';
const FIXTURE_PATH = path.join(__dirname, '../tests/fixtures/gdpr-b2-synthetic-object-v1.json');
const BAD = 'NO_GO_GDPR_B2_SYNTHETIC_VERSION_PRECHECK_FAILED';
const CLOSED = 'NO_GO_GDPR_B2_SYNTHETIC_VERSION_UNVERIFIED';
const MAX_BYTES = 1024;
// Total wall-clock budget for metadata, version download and stream consumption.
// A stalled read-only preflight must terminate as NO-GO, not hang indefinitely.
const MAX_PROBE_MS = 15000;
const MS_DAY = 86400000;
const ALWAYS_NO_GO = Object.freeze({
  recoveryReady: false,
  completeGdprJournalVerified: false,
  actualGdprEventVersionsVerified: false,
  restoreTestVerified: false,
  externalCheckpointVerified: false,
  scope: 'DEDICATED_GDPR_B2_KNOWN_SYNTHETIC_OBJECT_ONLY'
});
const report = (status, extra = {}) => ({
  status, ...ALWAYS_NO_GO, syntheticVersionVerified: false, ...extra
});

function safeConfig(env) {
  if (!env || env.GDPR_B2_SYNTHETIC_VERSION_PROBE !== MARKER ||
      Object.hasOwn(env, 'GDPR_B2_METADATA_PROBE') ||
      typeof env.GDPR_B2_READONLY_PROBE_VERSION_ID !== 'string' ||
      !/^[A-Za-z0-9._~+=-]{1,256}$/.test(env.GDPR_B2_READONLY_PROBE_VERSION_ID) ||
      !Number.isSafeInteger(Number(env.GDPR_B2_READONLY_MIN_REMAINING_DAYS)) ||
      Number(env.GDPR_B2_READONLY_MIN_REMAINING_DAYS) < 1 ||
      Number(env.GDPR_B2_READONLY_MIN_REMAINING_DAYS) > 3000) {
    throw Error(BAD);
  }
  // Reuse the strict dedicated-bucket/Axiom-separation/official-TLS checks.
  // Own independent marker is checked above before substituting the marker
  // expected by the shared validation function.
  let cfg;
  try {
    cfg = assertSafeEnvironment({...env, GDPR_B2_METADATA_PROBE: METADATA_MARKER});
  } catch (_) { throw Error(BAD); }
  return {
    ...cfg,
    versionId: env.GDPR_B2_READONLY_PROBE_VERSION_ID,
    minRemainingDays: Number(env.GDPR_B2_READONLY_MIN_REMAINING_DAYS)
  };
}

function readOnlyTransport(client, cfg) {
  if (!client || typeof client.send !== 'function') throw Error(BAD);
  return {send(command, options = undefined) {
    const allowedOptions = options === undefined ||
      (options && typeof options === 'object' && !Array.isArray(options) &&
        Object.keys(options).join(',') === 'abortSignal' &&
        options.abortSignal instanceof AbortSignal);
    if (!allowedOptions ||
        !(command instanceof GetObjectRetentionCommand) &&
        !(command instanceof GetObjectCommand) ||
        !command.input || Object.keys(command.input).sort().join(',') !==
          'Bucket,Key,VersionId' ||
        command.input.Bucket !== cfg.bucket ||
        command.input.Key !== OBJECT_KEY ||
        command.input.VersionId !== cfg.versionId) {
      throw Error('NO_GO_GDPR_B2_SYNTHETIC_OPERATION_REJECTED');
    }
    return client.send(command, options);
  }};
}

// Cleanup must never turn a timeout into a thrown, potentially sensitive SDK error.
function destroyBodyQuietly(body) {
  try { body?.destroy?.(); } catch (_) { /* already NO-GO */ }
}

async function boundedBytes(body) {
  if (!body || typeof body[Symbol.asyncIterator] !== 'function') {
    throw Error(CLOSED);
  }
  const parts = [];
  let size = 0;
  for await (const part of body) {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part);
    size += buffer.length;
    if (size > MAX_BYTES) {
      destroyBodyQuietly(body);
      throw Error(CLOSED);
    }
    parts.push(buffer);
  }
  return Buffer.concat(parts, size);
}

async function verifySyntheticVersion({
  env = process.env,
  clock = () => new Date(),
  timeoutMs = MAX_PROBE_MS,
  makeClient = cfg => new S3Client({
    endpoint: cfg.endpoint, region: cfg.region, forcePathStyle: true,
    maxAttempts: 2,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey}
  })
} = {}) {
  let cfg;
  try {
    cfg = safeConfig(env);
    if (!Number.isSafeInteger(timeoutMs) ||
        timeoutMs < 1 || timeoutMs > MAX_PROBE_MS) throw Error(BAD);
  } catch (_) { return report(BAD); }
  let client;
  let activeBody;
  const controller = new AbortController();
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      destroyBodyQuietly(activeBody);
      reject(Error(CLOSED));
    }, timeoutMs);
  });
  try {
    // Exact committed fixture bytes only. No caller-supplied user data,
    // object path, SQL connection or arbitrary keys are accepted.
    const fixture = fs.readFileSync(FIXTURE_PATH);
    if (fixture.length > MAX_BYTES || fixture.length === 0) throw Error(CLOSED);
    const expectedHash = crypto.createHash('sha256').update(fixture).digest('hex');
    const started = clock();
    if (!(started instanceof Date) || !Number.isFinite(started.getTime())) throw Error(CLOSED);
    client = makeClient(cfg);
    const reader = readOnlyTransport(client, cfg);
    const retention = await Promise.race([reader.send(new GetObjectRetentionCommand({
      Bucket: cfg.bucket, Key: OBJECT_KEY, VersionId: cfg.versionId
    }), {abortSignal: controller.signal}), deadline]);
    const until = new Date(retention?.Retention?.RetainUntilDate);
    if (retention?.Retention?.Mode !== 'COMPLIANCE' ||
        !Number.isFinite(until.getTime()) ||
        until.getTime() < started.getTime() + cfg.minRemainingDays * MS_DAY) {
      throw Error(CLOSED);
    }
    const response = await Promise.race([reader.send(new GetObjectCommand({
      Bucket: cfg.bucket, Key: OBJECT_KEY, VersionId: cfg.versionId
    }), {abortSignal: controller.signal}), deadline]);
    activeBody = response?.Body;
    // The response must identify the exact version that was requested.
    // Matching fixture bytes alone cannot prove which immutable version was
    // served by a gateway; missing identity metadata also fails closed.
    const responseRetainUntil = response.ObjectLockRetainUntilDate == null
      ? null : new Date(response.ObjectLockRetainUntilDate);
    if (response.VersionId !== cfg.versionId ||
        response.DeleteMarker === true ||
        (response.ObjectLockMode != null &&
          response.ObjectLockMode !== 'COMPLIANCE') ||
        (responseRetainUntil !== null &&
          (!Number.isFinite(responseRetainUntil.getTime()) ||
            responseRetainUntil.getTime() !== until.getTime())) ||
        (response.ContentLength != null &&
          (!Number.isSafeInteger(response.ContentLength) ||
            response.ContentLength < 0 || response.ContentLength > MAX_BYTES))) {
      destroyBodyQuietly(response.Body);
      throw Error(CLOSED);
    }
    const actual = await Promise.race([boundedBytes(response.Body), deadline]);
    // Contradictory provider length metadata is not a valid attestation even
    // if the downloaded bytes happen to match the committed fixture.
    if (response.ContentLength != null &&
        response.ContentLength !== actual.length) throw Error(CLOSED);
    const actualHash = crypto.createHash('sha256').update(actual).digest('hex');
    const ended = clock();
    if (!(ended instanceof Date) || !Number.isFinite(ended.getTime()) ||
        ended.getTime() < started.getTime() ||
        until.getTime() <= ended.getTime() || actualHash !== expectedHash ||
        !actual.equals(fixture)) throw Error(CLOSED);
    return report('READONLY_SYNTHETIC_VERSION_VERIFIED_NOT_RECOVERY', {
      syntheticVersionVerified: true,
      versionRetentionComplianceVerified: true,
      fixtureSha256Verified: true
    });
  } catch (_) { return report(CLOSED); }
  finally {
    clearTimeout(timeout);
    controller.abort();
    destroyBodyQuietly(activeBody);
    try { client?.destroy?.(); } catch (_) { /* already NO-GO */ }
  }
}

if (require.main === module) {
  verifySyntheticVersion().then(output => {
    console.log(JSON.stringify(output));
    // A synthetic version read cannot qualify GDPR recovery as ready.
    process.exitCode = 2;
  }).catch(() => {
    console.log(JSON.stringify(report(CLOSED)));
    process.exitCode = 2;
  });
}
module.exports = {
  MARKER, OBJECT_KEY, BAD, CLOSED, safeConfig, readOnlyTransport,
  boundedBytes, MAX_PROBE_MS, verifySyntheticVersion
};
