const crypto = require('crypto');
const zlib = require('zlib');
const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3');
const { classifyRecord } = require('../utils/archiveEventClassification');

const DEFAULT_QUERY_LIMIT = 5000;
const DEFAULT_MAX_WINDOW_MINUTES = 15;
const DEFAULT_CHUNK_MINUTES = 15;
const DEFAULT_MAX_CHUNKS_PER_RUN = 24;
const DEFAULT_MIN_WINDOW_MS = 1000;
const DEFAULT_INITIAL_LOOKBACK_HOURS = 24;
const DEFAULT_OVERLAP_SECONDS = 300;
const DEFAULT_SAFETY_LAG_SECONDS = 120;
const DEFAULT_PREFIX = 'demos/axiom-archive/v1';

function parsePositiveInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function validateDatasetName(dataset) {
  if (!/^[A-Za-z0-9._-]+$/.test(dataset)) {
    throw new Error(`Invalid Axiom dataset name: ${dataset}`);
  }
  return dataset;
}

function safeSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, '_');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeAxiomRecords(result) {
  let records = [];
  if (Array.isArray(result)) {
    records = result;
  } else if (Array.isArray(result?.matches)) {
    records = result.matches;
  } else if (Array.isArray(result?.data?.rows)) {
    records = result.data.rows;
  } else if (Array.isArray(result?.rows)) {
    records = result.rows;
  }

  return records.map(record => {
    const originalTime = record?._time || record?._sysTime;
    if (record && record.data !== undefined) {
      try {
        const parsed = typeof record.data === 'string' ? JSON.parse(record.data) : record.data;
        if (parsed && typeof parsed === 'object') {
          const normalized = { ...parsed };
          if (!normalized._time && originalTime) normalized._time = originalTime;
          return normalized;
        }
      } catch (_) {
        // Preserve the original record when an embedded data field is not valid JSON.
      }
    }

    if (record && typeof record === 'object') {
      const normalized = { ...record };
      if (!normalized._time && originalTime) normalized._time = originalTime;
      return normalized;
    }

    return { value: record, _time: originalTime || null };
  });
}

function getRecordTime(record) {
  const candidate = record?._time || record?.timestamp || record?.created_at || record?.createdAt;
  const date = candidate ? new Date(candidate) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function recordFingerprint(dataset, record) {
  return sha256Hex(`${dataset}\n${stableStringify(record)}`);
}

function sortAndDedupe(dataset, records) {
  const byId = new Map();
  for (const record of records) {
    const id = recordFingerprint(dataset, record);
    if (!byId.has(id)) byId.set(id, { id, record });
  }

  return [...byId.values()].sort((a, b) => {
    const aTime = getRecordTime(a.record) || '';
    const bTime = getRecordTime(b.record) || '';
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return a.id.localeCompare(b.id);
  });
}

function formatKeyTime(date) {
  return new Date(date).toISOString().replace(/[:.]/g, '-');
}

function createAxiomClient(env = process.env) {
  const Axiom = require('@axiomhq/axiom-node');
  return new Axiom.Client({
    token: env.AXIOM_API_TOKEN,
    orgId: env.AXIOM_ORG_ID,
    region: (env.AXIOM_REGION || 'eu').toLowerCase()
  });
}

function createB2Client(env = process.env) {
  const endpoint = env.B2_S3_ENDPOINT;
  const region = env.B2_S3_REGION;
  const accessKeyId = env.B2_S3_ACCESS_KEY_ID || env.B2_APPLICATION_KEY_ID;
  const secretAccessKey = env.B2_S3_SECRET_ACCESS_KEY || env.B2_APPLICATION_KEY;

  return new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    maxAttempts: 3,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

async function bodyToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  if (typeof body.transformToString === 'function') {
    return Buffer.from(await body.transformToString());
  }

  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

class AxiomArchiveService {
  constructor({ env = process.env, axiomClient = null, b2Client = null, clock = () => new Date() } = {}) {
    this.env = env;
    this.clock = clock;
    this.queryLimit = parsePositiveInt(env.AXIOM_ARCHIVE_QUERY_LIMIT, DEFAULT_QUERY_LIMIT, { min: 10, max: 100000 });
    this.maxWindowMs = parsePositiveInt(
      env.AXIOM_ARCHIVE_MAX_WINDOW_MINUTES,
      DEFAULT_MAX_WINDOW_MINUTES,
      { min: 1, max: 1440 }
    ) * 60 * 1000;
    this.chunkMs = parsePositiveInt(
      env.AXIOM_ARCHIVE_CHUNK_MINUTES,
      DEFAULT_CHUNK_MINUTES,
      { min: 1, max: 1440 }
    ) * 60 * 1000;
    this.maxChunksPerRun = parsePositiveInt(
      env.AXIOM_ARCHIVE_MAX_CHUNKS_PER_RUN,
      DEFAULT_MAX_CHUNKS_PER_RUN,
      { min: 1, max: 1000 }
    );
    this.minWindowMs = parsePositiveInt(env.AXIOM_ARCHIVE_MIN_WINDOW_MS, DEFAULT_MIN_WINDOW_MS, { min: 1, max: 60000 });
    this.initialLookbackMs = parsePositiveInt(
      env.AXIOM_ARCHIVE_INITIAL_LOOKBACK_HOURS,
      DEFAULT_INITIAL_LOOKBACK_HOURS,
      { min: 1, max: 24 * 90 }
    ) * 60 * 60 * 1000;
    this.overlapMs = parsePositiveInt(env.AXIOM_ARCHIVE_OVERLAP_SECONDS, DEFAULT_OVERLAP_SECONDS, { min: 0, max: 3600 }) * 1000;
    this.safetyLagMs = parsePositiveInt(env.AXIOM_ARCHIVE_SAFETY_LAG_SECONDS, DEFAULT_SAFETY_LAG_SECONDS, { min: 0, max: 3600 }) * 1000;
    this.prefix = String(env.AXIOM_ARCHIVE_PREFIX || DEFAULT_PREFIX).replace(/^\/+|\/+$/g, '');
    this.bucket = env.B2_BUCKET_NAME;

    const configuredDatasets = parseCsv(env.AXIOM_ARCHIVE_DATASETS);
    const defaultDatasets = [env.AXIOM_DATASET || 'centralized_logs', env.AXIOM_REALTIME_DATASET || 'real-time'];
    this.datasets = unique(configuredDatasets.length ? configuredDatasets : defaultDatasets).map(validateDatasetName);

    this.axiomClient = axiomClient;
    this.b2Client = b2Client;
  }

  validateAxiomConfiguration() {
    const missing = [];
    if (!this.env.AXIOM_API_TOKEN) missing.push('AXIOM_API_TOKEN');
    if (!this.env.AXIOM_ORG_ID) missing.push('AXIOM_ORG_ID');
    if (missing.length) {
      throw new Error(`Axiom archive source configuration incomplete: ${missing.join(', ')}`);
    }
  }

  validateB2Configuration() {
    const missing = [];
    if (!this.bucket) missing.push('B2_BUCKET_NAME');
    if (!this.env.B2_S3_ENDPOINT) missing.push('B2_S3_ENDPOINT');
    if (!this.env.B2_S3_REGION) missing.push('B2_S3_REGION');
    if (!(this.env.B2_S3_ACCESS_KEY_ID || this.env.B2_APPLICATION_KEY_ID)) missing.push('B2_S3_ACCESS_KEY_ID');
    if (!(this.env.B2_S3_SECRET_ACCESS_KEY || this.env.B2_APPLICATION_KEY)) missing.push('B2_S3_SECRET_ACCESS_KEY');
    if (missing.length) {
      throw new Error(`Axiom archive B2 configuration incomplete: ${missing.join(', ')}`);
    }
  }

  validateConfiguration() {
    if (this.env.AXIOM_ARCHIVE_ENABLED !== 'true') {
      throw new Error('Axiom archive is disabled: set AXIOM_ARCHIVE_ENABLED=true intentionally');
    }
    this.validateAxiomConfiguration();
    this.validateB2Configuration();
  }

  getAxiomClient() {
    if (!this.axiomClient) this.axiomClient = createAxiomClient(this.env);
    return this.axiomClient;
  }

  getB2Client() {
    if (!this.b2Client) this.b2Client = createB2Client(this.env);
    return this.b2Client;
  }

  checkpointKey(dataset) {
    return `${this.prefix}/control/${safeSegment(dataset)}.json`;
  }

  async getObject(key) {
    const response = await this.getB2Client().send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));
    return {
      body: await bodyToBuffer(response.Body),
      metadata: response.Metadata || {},
      contentEncoding: response.ContentEncoding,
      contentType: response.ContentType
    };
  }

  async loadCheckpoint(dataset) {
    const key = this.checkpointKey(dataset);
    try {
      const { body } = await this.getObject(key);
      const parsed = JSON.parse(body.toString('utf8'));
      if (!parsed.lastSuccessfulEnd || !Number.isFinite(new Date(parsed.lastSuccessfulEnd).getTime())) {
        throw new Error(`Invalid archive checkpoint at ${key}`);
      }
      return parsed;
    } catch (error) {
      const status = error?.$metadata?.httpStatusCode;
      if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || status === 404) return null;
      throw error;
    }
  }

  async putVerifiedObject({ key, body, contentType, contentEncoding = undefined, metadata = {} }) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const hash = sha256Hex(buffer);
    const objectMetadata = {
      ...metadata,
      sha256: hash,
      archiveformat: 'demos-axiom-v1'
    };

    await this.getB2Client().send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentEncoding: contentEncoding,
      ServerSideEncryption: 'AES256',
      Metadata: objectMetadata
    }));

    const head = await this.getB2Client().send(new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key
    }));

    const remoteHash = head.Metadata?.sha256;
    if (remoteHash !== hash || Number(head.ContentLength) !== buffer.length) {
      throw new Error(`B2 integrity verification failed for ${key}`);
    }

    return { key, sha256: hash, bytes: buffer.length };
  }

  async putJson(key, value, metadata = {}) {
    const body = Buffer.from(`${stableStringify(value)}\n`, 'utf8');
    return this.putVerifiedObject({
      key,
      body,
      contentType: 'application/json',
      metadata
    });
  }

  async queryAxiomWindow(dataset, startTime, endTime) {
    validateDatasetName(dataset);
    const apl = `['${dataset}'] | order by _time asc | limit ${this.queryLimit}`;
    const result = await this.getAxiomClient().query(apl, {
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      timeout: parsePositiveInt(this.env.AXIOM_ARCHIVE_QUERY_TIMEOUT_MS, 30000, { min: 1000, max: 120000 })
    });
    return normalizeAxiomRecords(result);
  }

  async fetchAdaptiveWindow(dataset, startTime, endTime, depth = 0) {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];
    if (depth > 40) throw new Error(`Archive query split depth exceeded for ${dataset}`);

    const records = await this.queryAxiomWindow(dataset, new Date(startMs), new Date(endMs));
    if (records.length < this.queryLimit) return records;

    const span = endMs - startMs;
    if (span <= this.minWindowMs) {
      throw new Error(
        `Axiom archive query saturated at ${records.length} records inside ${span} ms for ${dataset}; refusing to advance checkpoint`
      );
    }

    const midpoint = startMs + Math.floor(span / 2);
    const left = await this.fetchAdaptiveWindow(dataset, new Date(startMs), new Date(midpoint), depth + 1);
    const right = await this.fetchAdaptiveWindow(dataset, new Date(midpoint), new Date(endMs), depth + 1);
    return [...left, ...right];
  }

  async fetchRange(dataset, startTime, endTime) {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    const records = [];

    for (let cursor = startMs; cursor < endMs; cursor += this.maxWindowMs) {
      const windowEnd = Math.min(cursor + this.maxWindowMs, endMs);
      records.push(...await this.fetchAdaptiveWindow(dataset, new Date(cursor), new Date(windowEnd)));
    }

    return sortAndDedupe(dataset, records);
  }

  buildArchiveGroups(dataset, dedupedRecords, archivedAt) {
    const groups = new Map([
      ['technical', []],
      ['audit', []],
      ['security', []]
    ]);

    for (const { id, record } of dedupedRecords) {
      const category = classifyRecord(record);
      groups.get(category).push({
        archive_event_id: id,
        source_dataset: dataset,
        category,
        event_time: getRecordTime(record),
        archived_at: archivedAt.toISOString(),
        event: record
      });
    }
    return groups;
  }

  archiveObjectKey({ dataset, category, startTime, endTime, contentHash }) {
    const end = new Date(endTime);
    const yyyy = end.getUTCFullYear();
    const mm = String(end.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(end.getUTCDate()).padStart(2, '0');
    const windowName = `${formatKeyTime(startTime)}_${formatKeyTime(endTime)}_${contentHash.slice(0, 16)}.jsonl.gz`;
    return `${this.prefix}/data/${category}/year=${yyyy}/month=${mm}/day=${dd}/${safeSegment(dataset)}/${windowName}`;
  }

  manifestKey(dataset, endTime, manifestHash) {
    const end = new Date(endTime);
    const yyyy = end.getUTCFullYear();
    const mm = String(end.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(end.getUTCDate()).padStart(2, '0');
    return `${this.prefix}/manifests/year=${yyyy}/month=${mm}/day=${dd}/${safeSegment(dataset)}/${formatKeyTime(endTime)}_${manifestHash.slice(0, 16)}.json`;
  }

  async archiveGroup({ dataset, category, records, startTime, endTime }) {
    if (!records.length) return null;
    const jsonl = `${records.map(record => stableStringify(record)).join('\n')}\n`;
    const compressed = zlib.gzipSync(Buffer.from(jsonl, 'utf8'), { level: 9 });
    const contentHash = sha256Hex(compressed);
    const key = this.archiveObjectKey({ dataset, category, startTime, endTime, contentHash });
    const uploaded = await this.putVerifiedObject({
      key,
      body: compressed,
      contentType: 'application/x-ndjson',
      contentEncoding: 'gzip',
      metadata: {
        dataset: safeSegment(dataset),
        category,
        count: String(records.length)
      }
    });
    return { ...uploaded, category, count: records.length };
  }

  async archiveWindow({ dataset, startTime, endTime, archivedAt }) {
    const deduped = await this.fetchRange(dataset, startTime, endTime);
    // Use the deterministic window end in archive envelopes so a retry of the same chunk
    // produces the same compressed object/key instead of creating duplicate retry objects.
    const groups = this.buildArchiveGroups(dataset, deduped, new Date(endTime));
    const objects = [];

    for (const [category, records] of groups.entries()) {
      const result = await this.archiveGroup({ dataset, category, records, startTime, endTime });
      if (result) objects.push(result);
    }

    const categories = Object.fromEntries([...groups.entries()].map(([name, records]) => [name, records.length]));
    const manifest = {
      version: 1,
      source: 'axiom',
      dataset,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      recordCount: deduped.length,
      categories,
      objects,
      // Deterministic for idempotent retry of an already-uploaded-but-not-checkpointed chunk.
      generatedAt: new Date(endTime).toISOString()
    };

    const manifestHash = sha256Hex(stableStringify(manifest));
    const manifestObject = await this.putJson(
      this.manifestKey(dataset, endTime, manifestHash),
      manifest,
      { dataset: safeSegment(dataset), kind: 'manifest' }
    );

    const nextCheckpoint = {
      version: 1,
      dataset,
      lastSuccessfulEnd: new Date(endTime).toISOString(),
      lastManifestKey: manifestObject.key,
      lastManifestSha256: manifestObject.sha256,
      updatedAt: archivedAt.toISOString()
    };

    await this.putJson(this.checkpointKey(dataset), nextCheckpoint, {
      dataset: safeSegment(dataset),
      kind: 'checkpoint'
    });

    return {
      count: deduped.length,
      categories,
      objects,
      manifest: manifestObject,
      checkpoint: nextCheckpoint
    };
  }

  async processDataset(dataset, now = this.clock()) {
    const safeNow = new Date(now);
    const targetEnd = new Date(safeNow.getTime() - this.safetyLagMs);
    const checkpoint = await this.loadCheckpoint(dataset);
    const checkpointEnd = checkpoint ? new Date(checkpoint.lastSuccessfulEnd) : null;
    const initialStart = new Date(targetEnd.getTime() - this.initialLookbackMs);
    const startTime = checkpointEnd
      ? new Date(Math.max(0, checkpointEnd.getTime() - this.overlapMs))
      : initialStart;

    if (startTime >= targetEnd) {
      return {
        dataset,
        skipped: true,
        reason: 'up-to-date',
        startTime,
        endTime: targetEnd,
        targetEnd,
        caughtUp: true,
        chunks: 0,
        count: 0,
        categories: { technical: 0, audit: 0, security: 0 },
        objects: []
      };
    }

    let cursor = new Date(startTime);
    let chunks = 0;
    let count = 0;
    const categories = { technical: 0, audit: 0, security: 0 };
    const objects = [];
    let manifest = null;
    let nextCheckpoint = checkpoint;

    while (cursor < targetEnd && chunks < this.maxChunksPerRun) {
      const chunkEnd = new Date(Math.min(cursor.getTime() + this.chunkMs, targetEnd.getTime()));
      const result = await this.archiveWindow({
        dataset,
        startTime: cursor,
        endTime: chunkEnd,
        archivedAt: safeNow
      });

      count += result.count;
      for (const category of Object.keys(categories)) categories[category] += result.categories[category] || 0;
      objects.push(...result.objects);
      manifest = result.manifest;
      nextCheckpoint = result.checkpoint;
      cursor = chunkEnd;
      chunks += 1;
    }

    const caughtUp = cursor >= targetEnd;
    return {
      dataset,
      skipped: false,
      startTime,
      endTime: new Date(cursor),
      targetEnd,
      caughtUp,
      remainingMs: Math.max(0, targetEnd.getTime() - cursor.getTime()),
      chunks,
      count,
      categories,
      objects,
      manifest,
      checkpoint: nextCheckpoint
    };
  }

  async verifyArchiveObject(key) {
    this.validateB2Configuration();
    const { body, metadata, contentEncoding } = await this.getObject(key);
    const actualHash = sha256Hex(body);
    if (!metadata?.sha256) {
      throw new Error(`Archive SHA-256 metadata missing for ${key}`);
    }
    if (metadata.sha256 !== actualHash) {
      throw new Error(`Archive SHA-256 mismatch for ${key}`);
    }
    if (metadata.archiveformat !== 'demos-axiom-v1') {
      throw new Error(`Unexpected archive format metadata for ${key}`);
    }

    const decoded = contentEncoding === 'gzip' || key.endsWith('.gz') ? zlib.gunzipSync(body) : body;
    const lines = decoded.toString('utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      const envelope = JSON.parse(line);
      if (!envelope.archive_event_id || !envelope.source_dataset || !envelope.category || !('event' in envelope)) {
        throw new Error(`Invalid archive envelope in ${key}`);
      }
      const expectedId = recordFingerprint(envelope.source_dataset, envelope.event);
      if (expectedId !== envelope.archive_event_id) {
        throw new Error(`Archive event fingerprint mismatch in ${key}`);
      }
    }

    return { key, sha256: actualHash, recordCount: lines.length, bytes: body.length };
  }

  async runOnce({ now = this.clock() } = {}) {
    this.validateConfiguration();
    const results = [];
    for (const dataset of this.datasets) {
      results.push(await this.processDataset(dataset, now));
    }
    return results;
  }
}

module.exports = {
  AxiomArchiveService,
  bodyToBuffer,
  canonicalize,
  classifyRecord,
  createAxiomClient,
  createB2Client,
  getRecordTime,
  normalizeAxiomRecords,
  recordFingerprint,
  sha256Hex,
  sortAndDedupe,
  stableStringify,
  validateDatasetName
};
