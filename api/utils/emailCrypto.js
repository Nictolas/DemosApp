/**
 * Cifratura email a riposo (AES-256-GCM).
 * Se un attaccante ottiene il DB ma non la chiave, non può leggere le email.
 * Richiede EMAIL_ENCRYPTION_KEY (32 byte, es. base64 o stringa 32 caratteri).
 */
const crypto = require('crypto');

const PREFIX = 'enc:v1:';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const raw = process.env.EMAIL_ENCRYPTION_KEY;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 16) return null;
  if (Buffer.isEncoding('base64') && trimmed.length >= 44) {
    try {
      const buf = Buffer.from(trimmed, 'base64');
      return buf.length === KEY_LENGTH ? buf : null;
    } catch (_) {
      return null;
    }
  }
  return crypto.scryptSync(trimmed, 'demos-email-salt', KEY_LENGTH);
}

/**
 * Cifra una stringa (es. email). Restituisce "enc:v1:base64iv:base64tag:base64ciphertext".
 * Se EMAIL_ENCRYPTION_KEY non è impostata, restituisce null (salva in chiaro).
 */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  const key = getKey();
  if (!key) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + iv.toString('base64') + ':' + tag.toString('base64') + ':' + enc.toString('base64');
  } catch (e) {
    console.error('emailCrypto.encrypt error:', e?.message);
    return null;
  }
}

/**
 * Decifra un valore salvato. Se non è nel formato enc:v1:..., restituisce il valore così com'è (email in chiaro legacy).
 */
function decrypt(value) {
  if (value == null || value === '') return value;
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return value;
  try {
    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return value;
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ciphertext = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (e) {
    console.error('emailCrypto.decrypt error:', e?.message);
    return value;
  }
}

module.exports = { encrypt, decrypt };
