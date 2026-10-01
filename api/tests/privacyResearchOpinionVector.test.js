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
