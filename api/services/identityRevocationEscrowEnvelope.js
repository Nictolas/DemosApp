import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_CAPABILITY_BYTES = 32;

function asBuffer(value, name) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError(`${name} must be bytes`);
}

function aadFor(accountId, keyVersion) {
  if (typeof accountId !== 'string' || accountId.trim() === '') {
    throw new TypeError('accountId is required');
  }
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
    throw new TypeError('keyVersion must be a positive integer');
  }
  return Buffer.from(`demos:identity-revocation-escrow:v1:${keyVersion}:${accountId}`, 'utf8');
}

export function sealRevocationCapability({ capability, accountId, key, keyVersion }) {
  const plaintext = asBuffer(capability, 'capability');
  const encryptionKey = asBuffer(key, 'key');
  if (plaintext.length < MIN_CAPABILITY_BYTES) throw new TypeError('capability must contain at least 256 bits');
  if (encryptionKey.length !== 32) throw new TypeError('key must be exactly 256 bits');

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aadFor(accountId, keyVersion));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    keyVersion,
    iv: iv.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authTag: authTag.toString('base64url'),
  };
}

export function openRevocationCapability({ envelope, accountId, key }) {
  if (!envelope || envelope.version !== 1) throw new TypeError('unsupported escrow envelope');
  const encryptionKey = asBuffer(key, 'key');
  if (encryptionKey.length !== 32) throw new TypeError('key must be exactly 256 bits');

  const iv = Buffer.from(envelope.iv ?? '', 'base64url');
  const ciphertext = Buffer.from(envelope.ciphertext ?? '', 'base64url');
  const authTag = Buffer.from(envelope.authTag ?? '', 'base64url');
  if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES || ciphertext.length < MIN_CAPABILITY_BYTES) {
    throw new TypeError('invalid escrow envelope');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(aadFor(accountId, envelope.keyVersion));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
