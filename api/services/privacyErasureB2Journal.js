'use strict';

// DRAFT, operator-invoked only. This is an immutable *copy* of committed GDPR
// events, NOT a transactionally complete recovery authority / checkpoint.
const crypto = require('node:crypto');
const {
  S3Client, GetObjectLockConfigurationCommand, HeadObjectCommand,
  GetObjectCommand, GetObjectRetentionCommand, PutObjectCommand
} = require('@aws-sdk/client-s3');

const TYPES = new Set(['account_deleted', 'political_consent_revoked', 'political_consent_granted']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  const when = new Date(row.occurred_at);
  if (!Number.isFinite(when.getTime())) throw Error('Invalid GDPR ledger timestamp');
  const details = row.details == null ? {} : row.details;
  if (typeof details !== 'object' || !details || Array.isArray(details)) {
    throw Error('Invalid GDPR ledger details');
  }
  const event = {
    event_key: row.event_key.toLowerCase(),
    subject_user_id: row.subject_user_id,
    event_type: row.event_type,
    occurred_at: when.toISOString(),
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
function bytesOf(body) {
  if (Buffer.isBuffer(body)) return Promise.resolve(body);
  if (typeof body === 'string') return Promise.resolve(Buffer.from(body));
  if (body && typeof body.transformToByteArray === 'function') {
    return body.transformToByteArray().then(x => Buffer.from(x));
  }
  throw Error('Unsupported B2 read response');
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
  if (url.protocol !== 'https:' ||
      !/^s3\.[a-z0-9-]+\.backblazeb2\.com$/.test(url.hostname) ||
      url.pathname !== '/' || url.search || url.hash) {
    throw Error('Only the official TLS Backblaze S3 endpoint is allowed');
  }
  return { bucket, region, endpoint, accessKeyId, secretAccessKey, retentionDays };
}
function keyFor(event) {
  const month = event.occurred_at.slice(0, 7).replace('-', '/');
  return 'demos/gdpr-erasure/v1/events/' + month + '/' + event.event_key + '.json';
}
class PrivacyErasureB2Journal {
  constructor({env = process.env, client = null, clock = () => new Date()} = {}) {
    this.env = env;
    this.client = client;
    this.clock = clock;
  }
  config() { return validatedConfig(this.env); }
  s3(cfg) {
    if (this.client) return this.client;
    this.client = new S3Client({
      endpoint: cfg.endpoint, region: cfg.region, forcePathStyle: true,
      maxAttempts: 2, requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey}
    });
    return this.client;
  }
  async assertBucketCompliance(client, cfg) {
    const response = await client.send(
      new GetObjectLockConfigurationCommand({Bucket: cfg.bucket})
    );
    const lock = response.ObjectLockConfiguration || {};
    const retention = lock.Rule?.DefaultRetention;
    // Refuse the existing Axiom log bucket or any unlocked/governance store.
    // No code path silently enables lock or changes a bucket policy.
    if (lock.ObjectLockEnabled !== 'Enabled' ||
        retention?.Mode !== 'COMPLIANCE' ||
        !Number.isInteger(retention.Days) ||
        retention.Days < cfg.retentionDays) {
      throw Error('B2 bucket must have sufficient COMPLIANCE Object Lock default retention');
    }
  }
  async readVerified(client, cfg, key, event, expectedHash, versionId, requiredUntil) {
    // Metadata/headers are not enough: download the chosen object *version*.
    if (!versionId) throw Error('B2 object version ID required');
    const [retained, read] = await Promise.all([
      client.send(new GetObjectRetentionCommand({
        Bucket: cfg.bucket, Key: key, VersionId: versionId
      })),
      client.send(new GetObjectCommand({
        Bucket: cfg.bucket, Key: key, VersionId: versionId
      }))
    ]);
    if (retained.Retention?.Mode !== 'COMPLIANCE' ||
        !Number.isFinite(new Date(retained.Retention.RetainUntilDate).getTime()) ||
        new Date(retained.Retention.RetainUntilDate) < requiredUntil) {
      throw Error('B2 event object is not retained in COMPLIANCE mode');
    }
    const payload = await bytesOf(read.Body);
    if (payload.length > 8192 || checksum(payload) !== expectedHash) {
      throw Error('B2 archived event hash mismatch');
    }
    const candidate = normalizeEvent(JSON.parse(payload.toString('utf8')));
    if (JSON.stringify(candidate) !== JSON.stringify(event)) {
      throw Error('B2 archived event content differs from PostgreSQL ledger');
    }
    return {sha256:expectedHash, versionId};
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
    const client = this.s3(cfg);
    await this.assertBucketCompliance(client, cfg);
    return this.readVerified(
      client, cfg, keyFor(event), event, hash, receipt.versionId, this.clock()
    );
  }

  async archiveEvent(raw) {
    const cfg = this.config();
    const event = normalizeEvent(raw);
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
      head = await client.send(new HeadObjectCommand({Bucket:cfg.bucket,Key:key}));
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
    const uploaded = await client.send(new PutObjectCommand({
      Bucket:cfg.bucket, Key:key, Body:payload, ContentType:'application/json',
      ServerSideEncryption:'AES256', ObjectLockMode:'COMPLIANCE',
      ObjectLockRetainUntilDate:until,
      Metadata:{sha256:hash}
    }));
    const versionId = uploaded.VersionId;
    const verified = await this.readVerified(client,cfg,key,event,hash,versionId,until);
    return {eventKey:event.event_key,key,reused:false,...verified};
  }
  async archiveBatch(db, {after = null, limit = 100} = {}) {
    this.config(); // Refuse before even reading the database.
    if (!db || typeof db.query !== 'function' ||
        !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw Error('Explicit database connection and bounded GDPR batch required');
    }
    const cursor = after == null ? null : {
      occurred_at: new Date(after.occurred_at).toISOString(),
      event_key: String(after.event_key || '')
    };
    if (cursor && !UUID.test(cursor.event_key)) throw Error('Invalid archive cursor');
    // This query intentionally does not create or mutate database tables.
    // Newly committed events after this snapshot need subsequent batches.
    const result = await db.query(
      'SELECT event_key,subject_user_id,event_type,occurred_at,details ' +
      'FROM privacy_erasure_ledger ' +
      'WHERE ($1::timestamptz IS NULL OR (occurred_at,event_key) > ($1::timestamptz,$2::text)) ' +
      'ORDER BY occurred_at ASC,event_key ASC LIMIT $3',
      [cursor?.occurred_at || null,cursor?.event_key || null,limit]
    );
    let last = cursor;
    for (const raw of result.rows) {
      const event = normalizeEvent(raw);
      // Do not advance the return cursor until the B2 object was read back
      // and its exact immutable version retention was checked.
      await this.archiveEvent(event);
      last = {occurred_at:event.occurred_at,event_key:event.event_key};
    }
    return {exported:result.rows.length, cursor:last};
  }
}
module.exports = {PrivacyErasureB2Journal, normalizeEvent, validatedConfig, keyFor};
