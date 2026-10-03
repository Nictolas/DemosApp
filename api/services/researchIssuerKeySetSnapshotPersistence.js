const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const fsConstants = require('node:fs').constants;
const path = require('node:path');

const MAX_PERSISTED_SNAPSHOT_BYTES = 64 * 1024;

const normalizeSnapshotBytes = (snapshotJson) => {
  if (!Buffer.isBuffer(snapshotJson) && typeof snapshotJson !== 'string') {
    throw new Error('Authenticated issuer key-set snapshot JSON is required');
  }
  const bytes = Buffer.isBuffer(snapshotJson)
    ? Buffer.from(snapshotJson)
    : Buffer.from(snapshotJson, 'utf8');
  if (bytes.length === 0 || bytes.length > MAX_PERSISTED_SNAPSHOT_BYTES) {
    throw new Error('Invalid authenticated issuer key-set snapshot size');
  }
  return bytes;
};

const readEmbeddedSequence = (bytes) => {
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new Error('Invalid authenticated issuer key-set snapshot JSON');
  }
  const sequence = parsed?.payload?.sequence;
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error('Invalid authenticated issuer key-set snapshot sequence');
  }
  return sequence;
};

const assertSequence = (sequence, label = 'issuer key-set sequence') => {
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new Error(`Invalid ${label}`);
  }
  return sequence;
};

const assertHighWaterMarkStore = (store) => {
  if (
    !store ||
    typeof store.readMinimumSequence !== 'function' ||
    typeof store.advanceTo !== 'function'
  ) {
    throw new Error('Independent issuer key-set high-water mark store is required');
  }
  return store;
};

const createResearchIssuerKeySetSnapshotPersistence = ({
  snapshotPath,
  highWaterMarkStore,
  io = fs,
  randomBytes = crypto.randomBytes
} = {}) => {
  if (typeof snapshotPath !== 'string' || !path.isAbsolute(snapshotPath)) {
    throw new Error('Absolute issuer key-set snapshot path is required');
  }
  if (!io || typeof io.open !== 'function' || typeof io.rename !== 'function') {
    throw new Error('Issuer key-set persistence IO is required');
  }
  if (typeof randomBytes !== 'function') {
    throw new Error('Issuer key-set persistence randomness is required');
  }
  const highWater = assertHighWaterMarkStore(highWaterMarkStore);
  const directory = path.dirname(snapshotPath);

  let writeInProgress = false;

  const readFloor = async () => assertSequence(
    await highWater.readMinimumSequence(),
    'issuer key-set high-water mark'
  );

  const syncDirectory = async () => {
    const handle = await io.open(directory, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  };

  const persistAuthenticatedSnapshot = async ({ snapshotJson, sequence }) => {
    if (writeInProgress) {
      throw new Error('Issuer key-set persistence write already in progress');
    }
    writeInProgress = true;
    try {
    const bytes = normalizeSnapshotBytes(snapshotJson);
    const embeddedSequence = readEmbeddedSequence(bytes);
    assertSequence(sequence);
    if (embeddedSequence !== sequence) {
      throw new Error('Authenticated issuer key-set sequence mismatch');
    }

    const floor = await readFloor();
    if (sequence <= floor) {
      throw new Error('Issuer key-set rollback or replay rejected by persistence');
    }

    await io.mkdir(directory, { recursive: true, mode: 0o700 });
    const suffix = Buffer.from(randomBytes(12)).toString('hex');
    const temporaryPath = `${snapshotPath}.tmp-${process.pid}-${suffix}`;
    let temporaryHandle;
    try {
      temporaryHandle = await io.open(temporaryPath, 'wx', 0o600);
      await temporaryHandle.writeFile(bytes);
      await temporaryHandle.sync();
      await temporaryHandle.close();
      temporaryHandle = null;

      // Advance the independently protected monotonic floor before exposing the
      // replacement. A crash after this point but before rename fails closed on
      // recovery instead of silently accepting the older snapshot.
      await highWater.advanceTo(sequence);
      const advancedFloor = await readFloor();
      if (advancedFloor < sequence) {
        throw new Error('Issuer key-set high-water mark did not advance durably');
      }

      await io.rename(temporaryPath, snapshotPath);
      await syncDirectory();
    } catch (error) {
      if (temporaryHandle) {
        try { await temporaryHandle.close(); } catch {}
      }
      try { await io.unlink(temporaryPath); } catch {}
      throw error;
    }

    return Object.freeze({
      sequence,
      digest: crypto.createHash('sha256').update(bytes).digest('base64url')
    });
    } finally {
      writeInProgress = false;
    }
  };

  const recoverAuthenticatedSnapshot = async ({ revalidate }) => {
    if (typeof revalidate !== 'function') {
      throw new Error('Issuer key-set recovery revalidator is required');
    }
    const floor = await readFloor();
    if (floor < 1) {
      throw new Error('Issuer key-set recovery requires an established high-water mark');
    }

    const noFollow = fsConstants.O_NOFOLLOW || 0;
    const handle = await io.open(snapshotPath, fsConstants.O_RDONLY | noFollow);
    let bytes;
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_PERSISTED_SNAPSHOT_BYTES) {
        throw new Error('Invalid persisted issuer key-set snapshot file');
      }
      if ((stat.mode & 0o077) !== 0) {
        throw new Error('Persisted issuer key-set snapshot permissions are too broad');
      }
      bytes = await handle.readFile();
    } finally {
      await handle.close();
    }

    const sequence = readEmbeddedSequence(bytes);
    if (sequence !== floor) {
      throw new Error('Persisted issuer key-set snapshot does not match high-water mark');
    }

    const validation = await revalidate(bytes.toString('utf8'));
    if (
      !validation ||
      validation.ready !== true ||
      validation.sequence !== sequence
    ) {
      throw new Error('Persisted issuer key-set snapshot failed restart revalidation');
    }

    return Object.freeze({
      snapshotJson: bytes.toString('utf8'),
      sequence,
      ...(Number.isSafeInteger(validation.expiresAt)
        ? { expiresAt: validation.expiresAt }
        : {})
    });
  };

  return Object.freeze({
    persistAuthenticatedSnapshot,
    recoverAuthenticatedSnapshot
  });
};

module.exports = {
  MAX_PERSISTED_SNAPSHOT_BYTES,
  normalizeSnapshotBytes,
  readEmbeddedSequence,
  createResearchIssuerKeySetSnapshotPersistence
};
