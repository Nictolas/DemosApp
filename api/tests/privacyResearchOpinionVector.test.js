const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  READ_OPINIONS_PURPOSE,
  verifyResearchParticipantProof
} = require('../services/researchParticipantProofPolicy');
const {
  readCurrentResearchOpinionVector
} = require('../services/researchOpinionVectorService');
const {
  digestChallenge,
  issueResearchProofChallenge,
  consumeResearchProofChallenge
} = require('../services/researchProofChallengeStore');
const {
  createResearchParticipantProofVerifier
} = require('../services/researchParticipantProofVerifier');

const participantPublicKey = Buffer.alloc(32, 3);
const signature = Buffer.alloc(64, 4);
const challenge = 'A'.repeat(43);

const validVerifier = {
  async verify(input) {
    assert.equal(input.purpose, READ_OPINIONS_PURPOSE);
    assert.deepEqual(input.participantPublicKey, participantPublicKey);
    assert.equal(input.challenge, challenge);
    assert.deepEqual(input.signature, signature);
    return {
      valid: true,
      challengeFresh: true,
      keyAlgorithm: 'ed25519'
    };
  }
};

test('participant proof is fail-closed on invalid, stale or identity-linking verification', async () => {
  await assert.rejects(
    () => verifyResearchParticipantProof({
      participantPublicKey,
      challenge,
      signature,
      verifier: { async verify() { return { valid: false, challengeFresh: true }; } }
    }),
    /Invalid or replayed/
  );

  await assert.rejects(
    () => verifyResearchParticipantProof({
      participantPublicKey,
      challenge,
      signature,
      verifier: { async verify() { return { valid: true, challengeFresh: false }; } }
    }),
    /Invalid or replayed/
  );

  await assert.rejects(
    () => verifyResearchParticipantProof({
      participantPublicKey,
      challenge,
      signature,
      verifier: {
        async verify() {
          return {
            valid: true,
            challengeFresh: true,
            userId: 'identity-link'
          };
        }
      }
    }),
    /leaked Identity linkage/
  );
});

test('Research vector read authenticates pseudonymously and returns only opinion map', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [
          { question_id: 'energia_nucleare', answer_code: 'f' },
          { question_id: 'caccia', answer_code: 'c' },
          { question_id: 'ignored', answer_code: 'x' }
        ]
      };
    }
  };

  const result = await readCurrentResearchOpinionVector(
    client,
    { participantPublicKey, challenge, signature },
    validVerifier
  );

  assert.deepEqual(result, {
    opinions: {
      energia_nucleare: 'f',
      caccia: 'c'
    }
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /research\.current_opinion_responses/i);
  assert.match(calls[0].sql, /research\.participants/i);
  assert.match(calls[0].sql, /participant_public_key\s*=\s*\$1/i);
  assert.deepEqual(calls[0].params, [participantPublicKey]);

  const serialized = JSON.stringify(result);
  for (const forbidden of [
    'participant_id',
    'participantPublicKey',
    'userId',
    'accountId',
    'email'
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('Research vector services import no Identity auth or main database connector', () => {
  const proofSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchParticipantProofPolicy.js'),
    'utf8'
  );
  const vectorSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchOpinionVectorService.js'),
    'utf8'
  );
  const combined = proofSource + '\n' + vectorSource;

  assert.doesNotMatch(combined, /require\([^\n]*middleware\/auth/);
  assert.doesNotMatch(combined, /require\([^\n]*config\/database/);
  assert.doesNotMatch(combined, /process\.env\.DATABASE_URL/);
  assert.doesNotMatch(combined, /\bFROM\s+identity\./i);
  assert.doesNotMatch(combined, /\bJOIN\s+identity\./i);
  assert.doesNotMatch(combined, /\bJWT_SECRET\b/);
  assert.doesNotMatch(combined, /firebase/i);
  assert.doesNotMatch(combined, /console\./);
});

test('no opinion query runs when participant proof fails', async () => {
  let queryCount = 0;
  const client = {
    async query() {
      queryCount += 1;
      return { rows: [] };
    }
  };

  await assert.rejects(
    () => readCurrentResearchOpinionVector(
      client,
      { participantPublicKey, challenge, signature },
      { async verify() { return { valid: false, challengeFresh: true }; } }
    ),
    /Invalid or replayed/
  );

  assert.equal(queryCount, 0);
});


test('Research proof challenge stores only a digest and enforces bounded TTL', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [{}] };
    }
  };

  const issued = await issueResearchProofChallenge(client, {
    ttlSeconds: 120,
    randomBytes: () => Buffer.alloc(32, 8)
  });

  assert.equal(issued.challenge, Buffer.alloc(32, 8).toString('base64url'));
  assert.equal(issued.purpose, READ_OPINIONS_PURPOSE);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO research\.proof_challenges/i);
  assert.equal(Buffer.isBuffer(calls[0].params[0]), true);
  assert.deepEqual(calls[0].params[0], digestChallenge(issued.challenge));
  assert.equal(calls[0].params[1], READ_OPINIONS_PURPOSE);
  assert.equal(calls[0].params.includes(issued.challenge), false);

  await assert.rejects(
    () => issueResearchProofChallenge(client, {
      ttlSeconds: 10,
      randomBytes: () => Buffer.alloc(32, 8)
    }),
    /Invalid Research proof challenge TTL/
  );
});

test('Research proof challenge consumption is atomic, one-shot and expiry-aware', async () => {
  const seen = new Set();
  const client = {
    async query(sql, params) {
      assert.match(sql, /^DELETE FROM research\.proof_challenges/im);
      assert.match(sql, /expires_at > NOW\(\)/i);
      assert.match(sql, /RETURNING issued_at/i);
      assert.equal(params.length, 2);

      const key = Buffer.from(params[0]).toString('hex') + '|' + params[1];
      if (seen.has(key)) return { rows: [] };
      seen.add(key);
      return { rows: [{ issued_at: '2026-10-01T00:00:00Z' }] };
    }
  };

  const challengeValue = Buffer.alloc(32, 6).toString('base64url');
  assert.equal(
    await consumeResearchProofChallenge(client, {
      challenge: challengeValue,
      purpose: READ_OPINIONS_PURPOSE
    }),
    true
  );
  assert.equal(
    await consumeResearchProofChallenge(client, {
      challenge: challengeValue,
      purpose: READ_OPINIONS_PURPOSE
    }),
    false
  );
});

test('participant verifier consumes freshness only after a valid signature', async () => {
  let deleteCalls = 0;
  let available = true;
  const client = {
    async query(sql) {
      assert.match(sql, /^DELETE FROM research\.proof_challenges/im);
      deleteCalls += 1;
      if (!available) return { rows: [] };
      available = false;
      return { rows: [{ issued_at: '2026-10-01T00:00:00Z' }] };
    }
  };

  const invalidVerifier = createResearchParticipantProofVerifier({
    client,
    signatureVerifier: { async verify() { return false; } }
  });
  const invalid = await invalidVerifier.verify({
    purpose: READ_OPINIONS_PURPOSE,
    participantPublicKey,
    challenge,
    signature
  });
  assert.deepEqual(invalid, {
    valid: false,
    challengeFresh: false,
    keyAlgorithm: 'ed25519'
  });
  assert.equal(deleteCalls, 0);

  const verifier = createResearchParticipantProofVerifier({
    client,
    signatureVerifier: { async verify() { return true; } }
  });

  const first = await verifier.verify({
    purpose: READ_OPINIONS_PURPOSE,
    participantPublicKey,
    challenge,
    signature
  });
  const replay = await verifier.verify({
    purpose: READ_OPINIONS_PURPOSE,
    participantPublicKey,
    challenge,
    signature
  });

  assert.equal(first.valid, true);
  assert.equal(first.challengeFresh, true);
  assert.equal(replay.valid, true);
  assert.equal(replay.challengeFresh, false);
  assert.equal(deleteCalls, 2);
});

test('shadow schema challenge table contains no participant or Identity identifier', () => {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', 'supabase', 'schemas', 'privacy_first_shadow.sql'),
    'utf8'
  );
  const match = schema.match(
    /create table if not exists research\.proof_challenges \(([\s\S]*?)\n\);/i
  );
  assert.ok(match, 'missing research.proof_challenges shadow table');

  const block = match[1].toLowerCase();
  assert.match(block, /challenge_digest\s+bytea\s+primary\s+key/);
  assert.match(block, /expires_at\s+timestamptz\s+not\s+null/);

  for (const forbidden of [
    'participant_id',
    'participant_public_key',
    'account_id',
    'user_id',
    'email'
  ]) {
    assert.equal(block.includes(forbidden), false);
  }

  const shadowConfig = require('../config/privacyResearchShadow');
  assert.equal(
    shadowConfig.expectedTables.includes('research.proof_challenges'),
    true
  );
});
