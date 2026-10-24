const crypto = require('crypto');
const { getPool } = require('../config/database');
const { derivePersonKey } = require('./identityVerificationService');
const { getClient } = require('./redisCache');

const TTL_SECONDS = 10 * 60;

function keyFor(userId) {
  if (typeof userId !== 'string' || !userId) throw new Error('Account mancante');
  const digest = crypto.createHash('sha256').update(userId).digest('hex');
  return `cie:public-name-proof:${digest}`;
}

// Bind the fresh signed CIE response to the same person already verified on
// this DEMOS account; a CIE for another person must NEVER certify the profile.
async function assertSameVerifiedPerson(userId, fiscalNumber, db = getPool()) {
  const result = await db.query(
    `SELECT person_key FROM identity_verifications
     WHERE user_id = $1 AND provider = 'CIE' AND status = 'verified'
     LIMIT 1`,
    [userId]
  );
  const stored = result.rows[0]?.person_key;
  const derived = derivePersonKey(fiscalNumber);
  if (typeof stored !== 'string' || !/^[a-f0-9]{64}$/.test(stored)) {
    throw new Error('Identita CIE non corrispondente all\'account');
  }
  if (!crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(derived, 'hex'))) {
    throw new Error('Identita CIE non corrispondente all\'account');
  }
}

function assertNames(names) {
  for (const field of ['givenName', 'familyName']) {
    const value = names?.[field];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 150) {
      throw new Error('Dati anagrafici certificati incompleti');
    }
  }
}

async function savePublicNameProof(userId, names, client = getClient()) {
  if (!client) throw new Error('Redis richiesto per il riconoscimento CIE');
  assertNames(names);
  // Names live only in this short-lived store until the user submits a
  // political recognition request. Do not store the fiscal number.
  await client.set(keyFor(userId), JSON.stringify({
    givenName: names.givenName.trim(),
    familyName: names.familyName.trim()
  }), { ex: TTL_SECONDS });
}

function parseProof(raw) {
  if (raw == null) return null;
  const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
  assertNames(result);
  return { givenName: result.givenName, familyName: result.familyName };
}

async function peekPublicNameProof(userId, client = getClient()) {
  if (!client) return null;
  return parseProof(await client.get(keyFor(userId)));
}

async function consumePublicNameProof(userId, client = getClient()) {
  if (!client || typeof client.getdel !== 'function') {
    throw new Error('Consumo atomico Redis GETDEL necessario');
  }
  return parseProof(await client.getdel(keyFor(userId)));
}

module.exports = {
  TTL_SECONDS,
  assertSameVerifiedPerson,
  savePublicNameProof,
  peekPublicNameProof,
  consumePublicNameProof
};
