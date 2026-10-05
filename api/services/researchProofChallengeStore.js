const crypto = require('crypto');
const {
  READ_OPINIONS_PURPOSE,
  PARTICIPANT_PROOF_PURPOSES
} = require('./researchParticipantProofPolicy');

const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 300;
const DEFAULT_TTL_SECONDS = 120;
const MAX_EXPIRED_CHALLENGE_PURGE_PER_ISSUE = 256;

const normalizeTtlSeconds = (value = DEFAULT_TTL_SECONDS) => {
  if (!Number.isInteger(value) || value < MIN_TTL_SECONDS || value > MAX_TTL_SECONDS) {
    throw new Error('Invalid Research proof challenge TTL');
  }
  return value;
};

const assertSupportedPurpose = (purpose) => {
  if (!PARTICIPANT_PROOF_PURPOSES.includes(purpose)) {
    throw new Error('Unsupported Research proof challenge purpose');
  }
};

const digestChallenge = (challenge) => {
  if (typeof challenge !== 'string' || challenge.length < 43) {
    throw new Error('Invalid Research proof challenge');
  }
  return crypto.createHash('sha256').update(challenge, 'utf8').digest();
};

const issueResearchProofChallenge = async (
  client,
  {
    purpose = READ_OPINIONS_PURPOSE,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    randomBytes = crypto.randomBytes
  } = {}
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research proof challenge issuance requires a PostgreSQL client');
  }
  assertSupportedPurpose(purpose);
  if (typeof randomBytes !== 'function') {
    throw new Error('Research proof challenge random source is required');
  }

  const ttl = normalizeTtlSeconds(ttlSeconds);
  const raw = randomBytes(32);
  if (!Buffer.isBuffer(raw) || raw.length !== 32) {
    throw new Error('Research proof challenge random source returned invalid bytes');
  }

  const challenge = raw.toString('base64url');
  const challengeDigest = digestChallenge(challenge);
  const expiresAt = new Date(Date.now() + ttl * 1000);

  await client.query(
    `WITH stale_challenges AS (
       SELECT ctid
       FROM research.proof_challenges
       WHERE expires_at <= NOW()
       ORDER BY expires_at
       LIMIT $4
     ), purged_challenges AS (
       DELETE FROM research.proof_challenges p
       USING stale_challenges s
       WHERE p.ctid = s.ctid
     )
     INSERT INTO research.proof_challenges (
       challenge_digest, purpose, expires_at
     )
     VALUES ($1, $2, $3)`,
    [challengeDigest, purpose, expiresAt, MAX_EXPIRED_CHALLENGE_PURGE_PER_ISSUE]
  );

  return {
    challenge,
    purpose,
    expiresAt: expiresAt.toISOString()
  };
};

const consumeResearchProofChallenge = async (
  client,
  {
    challenge,
    purpose = READ_OPINIONS_PURPOSE
  }
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research proof challenge consumption requires a PostgreSQL client');
  }
  assertSupportedPurpose(purpose);

  const challengeDigest = digestChallenge(challenge);
  const result = await client.query(
    `DELETE FROM research.proof_challenges
     WHERE challenge_digest = $1
       AND purpose = $2
       AND expires_at > NOW()
     RETURNING issued_at`,
    [challengeDigest, purpose]
  );

  return result.rows.length === 1;
};

module.exports = {
  MIN_TTL_SECONDS,
  MAX_TTL_SECONDS,
  DEFAULT_TTL_SECONDS,
  MAX_EXPIRED_CHALLENGE_PURGE_PER_ISSUE,
  digestChallenge,
  issueResearchProofChallenge,
  consumeResearchProofChallenge
};
