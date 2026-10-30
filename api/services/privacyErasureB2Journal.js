'use strict';

// DRAFT, operator-invoked only. This is an immutable *copy* of committed GDPR
// events, NOT a transactionally complete recovery authority / checkpoint.
const crypto = require('node:crypto');
const {normalizeLedgerTimestamp} = require('./privacyLedgerTimestamp');
const {
  S3Client, GetObjectLockConfigurationCommand, HeadObjectCommand,
  GetObjectCommand, GetObjectRetentionCommand, PutObjectCommand
} = require('@aws-sdk/client-s3');

const TYPES = new Set(['account_deleted', 'political_consent_revoked', 'political_consent_granted']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MS_DAY = 86400000;
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  }
  return value;
}
function normalizeEvent(row) {
  if (!row || !UUID.test(row.event_key || '') ||
      typeof row.subject_user_id !== 'string' ||
      row.subject_user_id.length === 0 || row.subject_user_id.length > 128 ||
      !TYPES.has(row.event_type)) throw Error('Invalid GDPR ledger event');
  const when = normalizeLedgerTimestamp(row.occurred_at);
  // A missing JSONB payload is invalid, not an empty event to sign or archive.
  const details = row.details;
  if (typeof details !== 'object' || !details || Array.isArray(details)) {
    throw Error('Invalid GDPR ledger details');
  }
  const event = {
    event_key: row.event_key,
    subject_user_id: row.subject_user_id,
    event_type: row.event_type,
    occurred_at: when,
    details: stable(details)
  };
  if (Buffer.byteLength(JSON.stringify(event)) > 8192) {
    throw Error('GDPR ledger event exceeds minimization limit');
  }
  return event;
}
function checksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
const MAX_EVENT_BYTES = 8192;
async function bytesOf(body) {
  // AWS SDK Node GetObject.Body is an async iterable. Do not call
  // transformToByteArray() first: it buffers the entire remote object and
  // lets an oversized/malicious B2 response exhaust recovery memory.
  if (body && typeof body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let size = 0;
    for await (const part of body) {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      size += chunk.length;
      if (size > MAX_EVENT_BYTES) {
        if (typeof body.destroy === 'function') body.destroy();
        throw Error('B2 archived event exceeds bounded read limit');
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, size);
  }
  // Never call transformToByteArray() on an untrusted remote response:
  // it may allocate an arbitrary amount of memory before the size check.
  // Node AWS SDK S3 GetObject.Body must support streaming; reject
  // non-streaming SDK variants instead of pretending the cap is enforced.
  const buffer = Buffer.isBuffer(body) ? body
    : typeof body === 'string' ? Buffer.from(body) : null;
  if (!buffer) throw Error('B2 read response must be a bounded Node stream');
  if (buffer.length > MAX_EVENT_BYTES) {
    throw Error('B2 archived event exceeds bounded read limit');
  }
  return buffer;
}
function notFound(error) {
  return error && (
    error.name === 'NotFound' || error.name === 'NoSuchKey' ||
    error.$metadata?.httpStatusCode === 404
  );
}
function validatedConfig(env) {
  if (env.GDPR_LEDGER_B2_ENABLED !== 'true') {
    throw Error('GDPR immutable B2 ledger exporter is disabled');
  }
  const bucket = env.GDPR_LEDGER_B2_BUCKET;
  const region = env.GDPR_LEDGER_B2_REGION;
  const endpoint = env.GDPR_LEDGER_B2_ENDPOINT;
  const accessKeyId = env.GDPR_LEDGER_B2_ACCESS_KEY_ID;
  const secretAccessKey = env.GDPR_LEDGER_B2_SECRET_ACCESS_KEY;
  const retentionDays = Number(env.GDPR_LEDGER_B2_RETENTION_DAYS);
  if (!/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket || '') ||
      !region || !accessKeyId || !secretAccessKey ||
      !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3000 ||
      bucket === env.B2_BUCKET_NAME) {
    throw Error('Dedicated GDPR B2 bucket, explicit retention and credentials required');
  }
  let url;
  try { url = new URL(endpoint); } catch (_) { throw Error('Invalid B2 endpoint'); }
  // Signing with a different region from the official endpoint causes
  // authentication failures and can strand GDPR outbox deliveries. Validate
  // the pair before opening PostgreSQL or constructing an S3 network client.
  const endpointRegion = /^s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(url.hostname);
  if (url.protocol !== 'https:' || !endpointRegion ||
      !/^[a-z0-9-]+$/.test(region) || endpointRegion[1] !== region ||
      url.port !== '' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw Error('Only the official TLS Backblaze S3 endpoint matching the configured region is allowed');
  }
  return { bucket, region, endpoint, accessKeyId, secretAccessKey, retentionDays };
}
function keyFor(event) {
  const month = event.occurred_at.slice(0, 7).replace('-', '/');
  return 'demos/gdpr-erasure/v1/events/' + month + '/' + event.event_key + '.json';
}
class PrivacyErasureB2Journal {
  constructor({env = process.env, client = null, clock = () => new Date(), readbackTimeoutMs = 15000} = {}) {
    if (!Number.isSafeInteger(readbackTimeoutMs) || readbackTimeoutMs < 1 || readbackTimeoutMs > 15000) {
      throw Error('Invalid bounded B2 readback timeout');
    }
    this.env = env;
    this.client = client;
    this.clock = clock;
    this.readbackTimeoutMs = readbackTimeoutMs;
    // In-memory safety latch only. An uncertain remote PUT must not be
    // retried by this exporter instance without independent reconciliation.
    // This cannot protect a process restart or another worker.
    this.uncertainWrite = false;
  }
  async sendBounded(client, command, timeoutCode) {
    const abort = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(Error(timeoutCode));
      }, this.readbackTimeoutMs);
    });
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => client.send(command, {abortSignal: abort.signal})),
        deadline
      ]);
      if (abort.signal.aborted) throw Error(timeoutCode);
      return result;
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  }
  config() { return validatedConfig(this.env); }
  s3(cfg) {
    if (this.client) return this.client;
    this.client = new S3Client({
      endpoint: cfg.endpoint, region: cfg.region, forcePathStyle: true,
      // A retried PUT could create a second COMPLIANCE-locked version after
      // a lost acknowledgement. Do not allow automatic SDK-level retries.
      maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey}
    });
    return this.client;
  }
  async assertBucketCompliance(client, cfg) {
    // The bucket preflight precedes version readback. A stalled provider here
    // must not bypass the bounded readback timeout or hang a manual recovery
    // verifier indefinitely. This is a separate local deadline; a real B2
    // request that ignores AbortSignal still remains NO-GO after timeout.
    const abort = new AbortController();
    let timeoutId;
    const deadline = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abort.abort();
        reject(Error('GDPR_B2_BUCKET_COMPLIANCE_TIMEOUT'));
      }, this.readbackTimeoutMs);
    });
    try {
      const response = await Promise.race([
        client.send(new GetObjectLockConfigurationCommand({
          Bucket: cfg.bucket
        }), {abortSignal: abort.signal}),
        deadline
      ]);
      if (abort.signal.aborted) throw Error('GDPR_B2_BUCKET_COMPLIANCE_TIMEOUT');
      const lock = response?.ObjectLockConfiguration || {};
      const retention = lock.Rule?.DefaultRetention;
      // Refuse the existing Axiom log bucket or any unlocked/governance store.
      // No code path silently enables lock or changes a bucket policy.
      if (lock.ObjectLockEnabled !== 'Enabled' ||
          retention?.Mode !== 'COMPLIANCE' ||
          !Number.isInteger(retention.Days) ||
          retention.Days < cfg.retentionDays) {
        throw Error('B2 bucket must have sufficient COMPLIANCE Object Lock default retention');
      }
    } finally {
      clearTimeout(timeoutId);
      abort.abort();
    }
  }
  async readVerified(client, cfg, key, event, expectedHash, versionId, requiredUntil) {
    // Bound retention and object readback; a stalled provider or body cannot hang recovery.
    const abort = new AbortController();
    let body = null;
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        abort.abort();
        try { body?.destroy?.(); } catch (_) { /* fail closed */ }
        reject(Error('GDPR_B2_READBACK_TIMEOUT'));
      }, this.readbackTimeoutMs);
    });
    const readback = (async () => {
    // Metadata/headers are not enough: download the chosen object *version*.
    if (!versionId) throw Error('B2 object version ID required');
    if (!(requiredUntil instanceof Date) || !Number.isFinite(requiredUntil.getTime())) {
      throw Error('Invalid clock');
    }
    // Check retention BEFORE opening the object body. In addition to
    // failing closed, this avoids fetching/abandoning a stream when the
    // immutable version is not legally retained.
    const retained = await client.send(new GetObjectRetentionCommand({
      Bucket: cfg.bucket, Key: key, VersionId: versionId
    }), {abortSignal: abort.signal});
    if (abort.signal.aborted) throw Error('GDPR_B2_READBACK_TIMEOUT');
    const retentionUntil = new Date(retained.Retention?.RetainUntilDate);
    if (retained.Retention?.Mode !== 'COMPLIANCE' ||
        !Number.isFinite(retentionUntil.getTime()) ||
        retentionUntil < requiredUntil) {
      throw Error('B2 event object is not retained in COMPLIANCE mode');
    }
    const read = await client.send(new GetObjectCommand({
      Bucket: cfg.bucket, Key: key, VersionId: versionId
    }), {abortSignal: abort.signal});
    body = read.Body;
    // A client may ignore abortSignal and resolve after the deadline.
    if (abort.signal.aborted) {
      try { body?.destroy?.(); } catch (_) { /* fail closed */ }
      throw Error('GDPR_B2_READBACK_TIMEOUT');
    }
    // S3 can return the requested bytes under another version ID. The
    // immutable receipt is version-specific: matching bytes are not enough.
    // Fail BEFORE reading the body if its provider identity or metadata is
    // missing, contradictory or does not match the retained version.
    const readRetentionUntil = read.ObjectLockRetainUntilDate == null
      ? null : new Date(read.ObjectLockRetainUntilDate);
    if (read.VersionId !== versionId || read.DeleteMarker === true ||
        (read.ObjectLockMode != null && read.ObjectLockMode !== 'COMPLIANCE') ||
        (readRetentionUntil !== null &&
          (!Number.isFinite(readRetentionUntil.getTime()) ||
           readRetentionUntil.getTime() !== retentionUntil.getTime())) ||
        !Number.isSafeInteger(read.ContentLength) ||
        read.ContentLength < 0 || read.ContentLength > MAX_EVENT_BYTES) {
      if (typeof read.Body?.destroy === 'function') read.Body.destroy();
      throw Error('B2 archived event version or metadata mismatch');
    }
    const payload = await bytesOf(read.Body);
    if (read.ContentLength !== payload.length) {
      throw Error('B2 archived event length mismatch');
    }
    if (checksum(payload) !== expectedHash) {
      throw Error('B2 archived event hash mismatch');
    }
    const candidate = normalizeEvent(JSON.parse(payload.toString('utf8')));
    if (JSON.stringify(candidate) !== JSON.stringify(event)) {
      throw Error('B2 archived event content differs from PostgreSQL ledger');
    }
    // The object can be valid when retention is first checked yet expire
    // while its body is streamed. Never declare recovery readiness on a
    // receipt whose COMPLIANCE lock has expired by the end of readback.
    const finishedAt = this.clock();
    if (!(finishedAt instanceof Date) || !Number.isFinite(finishedAt.getTime())) {
      throw Error('Invalid clock');
    }
    if (retentionUntil <= finishedAt) {
      throw Error('B2 event object retention expired during readback');
    }
    // The recovery verifier needs the expiry of every version, not just
    // the fact that each one was retained at its individual readback time.
    return {sha256:expectedHash, versionId, retentionUntil:retentionUntil.toISOString()};
    })();
    try {
      return await Promise.race([readback, timeout]);
    } finally {
      clearTimeout(timeoutId);
      abort.abort();
    }
  }
  async verifyArchivedReceipt(raw, receipt) {
    // Strictly read-only: a recovery readiness check must NEVER repair a
    // missing archive by uploading it; that would hide a lost external copy.
    const cfg = this.config();
    const event = normalizeEvent(raw);
    if (!receipt || typeof receipt.versionId !== 'string' ||
        receipt.versionId.length === 0 ||
        receipt.versionId.length > 256 ||
        !/^[0-9a-f]{64}$/.test(receipt.sha256 || '')) {
      throw Error('GDPR B2 receipt missing or invalid');
    }
    const hash = checksum(Buffer.from(JSON.stringify(event)));
    if (hash !== receipt.sha256) {
      throw Error('GDPR B2 receipt does not match local ledger event');
    }
    const checkedAt = this.clock();
    if (!(checkedAt instanceof Date) || !Number.isFinite(checkedAt.getTime())) {
      throw Error('Invalid clock');
    }
    const client = this.s3(cfg);
    await this.assertBucketCompliance(client, cfg);
    return this.readVerified(
      client, cfg, keyFor(event), event, hash, receipt.versionId, checkedAt
    );
  }

  // A durable pre-PUT claim has NOT been implemented. A wrapped S3Client
  // can evade instanceof, so arbitrary injected clients must NOT enable
  // a direct write from an application/CLI process. Permit the old mock
  // transport ONLY in explicitly isolated GitHub Actions test processes.
  // This is a temporary negative gate, NOT a proof that CI mocks are real
  // provider attestations or a production-grade capability mechanism.
  assertNoRealWriteTransport() {
    const invocation = typeof process.argv[1] === 'string'
      ? process.argv[1].replaceAll(String.fromCharCode(92), '/') : '';
    const segments = invocation.split('/');
    const isTestFile = /^[A-Za-z0-9_.-]+[.]test[.]js$/.test(segments.at(-1) || '');
    const isolatedTest = process.env.GITHUB_ACTIONS === 'true' &&
      segments.at(-3) === 'api' && segments.at(-2) === 'tests' && isTestFile;
    if (!isolatedTest || !this.client || this.client instanceof S3Client) {
      throw Error('GDPR_B2_DURABLE_PUT_CLAIM_NOT_IMPLEMENTED');
    }
  }
  async archiveEvent(raw) {
    if (this.uncertainWrite) {
      throw Error('GDPR_B2_PUT_OUTCOME_UNKNOWN_REQUIRES_RECONCILIATION');
    }
    const cfg = this.config();
    const event = normalizeEvent(raw);
    this.assertNoRealWriteTransport();
    // The existing uncertainWrite latch starts only *after* HEAD. Without
    // this synchronous gate two parallel calls can both observe HEAD=404 and
    // issue irreversible COMPLIANCE PUTs from the SAME process.
    if (this.writeInProgress) {
      throw Error('GDPR_B2_CONCURRENT_ARCHIVE_NOT_ALLOWED');
    }
    this.writeInProgress = true;
    try {
    const client = this.s3(cfg);
    await this.assertBucketCompliance(client, cfg);
    const key = keyFor(event);
    const payload = Buffer.from(JSON.stringify(event));
    const hash = checksum(payload);
    const now = this.clock();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw Error('Invalid clock');
    const until = new Date(now.getTime() + cfg.retentionDays * MS_DAY);
    let head;
    try {
      head = await this.sendBounded(client,
        new HeadObjectCommand({Bucket:cfg.bucket,Key:key}),
        'GDPR_B2_HEAD_TIMEOUT');
    } catch (error) {
      if (!notFound(error)) throw error;
    }
    if (head) {
      if (head.Metadata?.sha256 !== hash || head.ContentLength !== payload.length) {
        throw Error('B2 event key already exists with different content');
      }
      // Preexisting locked version may be older than an unrelated retention
      // setting, so the claimed retention must be checked independently.
      return {eventKey:event.event_key,key,reused:true,
        ...(await this.readVerified(client,cfg,key,event,hash,head.VersionId,now))};
    }
    // From this point an acknowledgement can be lost AFTER the provider
    // has committed an immutable version. Never retry PUT automatically in
    // this process, even if the transport reports an error or readback fails.
    this.uncertainWrite = true;
    const uploaded = await this.sendBounded(client, new PutObjectCommand({
      Bucket:cfg.bucket, Key:key, Body:payload, ContentType:'application/json',
      ServerSideEncryption:'AES256', ObjectLockMode:'COMPLIANCE',
      ObjectLockRetainUntilDate:until,
      Metadata:{sha256:hash}
    }), 'GDPR_B2_PUT_OUTCOME_UNKNOWN');
    const versionId = uploaded?.VersionId;
    const verified = await this.readVerified(client,cfg,key,event,hash,versionId,until);
    this.uncertainWrite = false;
    return {eventKey:event.event_key,key,reused:false,...verified};
    } finally {
      this.writeInProgress = false;
    }
  }
  async archiveBatch(db, {after = null, limit = 100} = {}) {
    this.config(); // Refuse before even reading the database.
    this.assertNoRealWriteTransport(); // No SQL reads before direct write NO-GO.
    if (!db || typeof db.query !== 'function' ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw Error('Explicit database connection and bounded GDPR batch required');
    }
    // PostgreSQL timestamps retain microseconds, whereas JS Date/toISOString()
    // truncates to milliseconds. Truncating a page cursor can revisit the same
    // row on the next batch (even indefinitely with limit=1).
    // Preserve the exact UTC timestamp text emitted by PostgreSQL.
    // Accept ONLY the lossless cursor returned by archiveBatch. In
    // particular, never accept a JS Date or a millisecond-only timestamp:
    // either would silently truncate PostgreSQL microseconds on resume.
    const cursor = after == null ? null : {
      occurred_at: after.occurred_at,
      event_key: after.event_key
    };
    if (cursor && (typeof cursor.event_key !== 'string' ||
        !UUID.test(cursor.event_key) ||
        typeof cursor.occurred_at !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(cursor.occurred_at) ||
        !Number.isFinite(Date.parse(cursor.occurred_at)) ||
        new Date(cursor.occurred_at).toISOString() !==
          cursor.occurred_at.slice(0, -4) + 'Z')) {
      throw Error('Invalid archive cursor: exact six-digit PostgreSQL timestamp required');
    }
    // An RLS-filtered operator previously received a valid-looking partial
    // batch (or 0 rows) and could mistake it for the complete immutable
    // journal. Prove the SQL role has UNFILTERED ledger access in the SAME
    // statement/snapshot as the page. Two separate pool.query calls can
    // borrow different SQL sessions, so a standalone preflight is insufficient.
    // The LEFT JOIN returns a sentinel row for an actually empty page.
    const result = await db.query(
      'WITH visibility AS MATERIALIZED (' +
      "SELECT NOT pg_catalog.row_security_active(" +
      "'public.privacy_erasure_ledger'::regclass) AS complete_visibility) " +
      'SELECT visibility.complete_visibility, page.event_key, ' +
      'page.subject_user_id,page.event_type,page.occurred_at,page.details, ' +
      'page.cursor_occurred_at FROM visibility LEFT JOIN LATERAL (' +
      'SELECT event_key,subject_user_id,event_type,occurred_at,details, ' +
      "to_char(occurred_at AT TIME ZONE 'UTC', " +
      `'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_occurred_at ` +
      // Explicit schema prevents pg_temp/search_path shadowing during export.
      'FROM public.privacy_erasure_ledger ' +
      'WHERE ($1::timestamptz IS NULL OR (occurred_at,event_key) > ($1::timestamptz,$2::text)) ' +
      'ORDER BY occurred_at ASC,event_key ASC LIMIT $3' +
      ') AS page ON visibility.complete_visibility',
      [cursor?.occurred_at || null,cursor?.event_key || null,limit]
    );
    if (result.rows?.[0]?.complete_visibility !== true ||
        result.rows.some(row => row.complete_visibility !== true)) {
      throw Error('GDPR_B2_ARCHIVE_INCOMPLETE_VISIBILITY');
    }
    const page = result.rows.filter(row => row.event_key != null);
    if (page.length > limit) throw Error('GDPR_B2_ARCHIVE_INVALID_PAGE');
    let last = cursor;
    for (const raw of page) {
      // pg Date loses microseconds. Use exact SQL text for B2 and cursor.
      const exactTimestamp = raw.cursor_occurred_at;
      if (typeof exactTimestamp !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(exactTimestamp) ||
          !Number.isFinite(Date.parse(exactTimestamp))) {
        throw Error('GDPR archive batch requires exact PostgreSQL timestamp cursor');
      }
      const event = normalizeEvent({...raw, occurred_at: exactTimestamp});
      // Do not advance the return cursor until the B2 object was read back
      // and its exact immutable version retention was checked.
      await this.archiveEvent(event);
      last = {occurred_at:exactTimestamp,event_key:event.event_key};
    }
    // A cursor/empty page proves only this SQL query's visible suffix.
    // Late commits with earlier occurred_at, stale restores and lost SQL
    // history can make the scan incomplete even with unrestricted RLS.
    // Never expose a positive completion/recovery attestation here.
    return {exported:page.length, cursor:last,
      complete:false, recoveryReady:false};
  }
}
module.exports = {PrivacyErasureB2Journal, normalizeEvent, validatedConfig, keyFor};
