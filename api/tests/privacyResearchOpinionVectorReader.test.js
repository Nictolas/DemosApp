const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  READ_OPINIONS_PURPOSE
} = require('../services/researchParticipantProofPolicy');
const {
  canonicalResearchProofMessage
} = require('../services/researchEd25519SignatureVerifier');
const {
  createResearchOpinionVectorReader
} = require('../services/researchOpinionVectorReader');

const rawPublicKey = (publicKey) =>
  publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);

test('non-live Research reader verifies proof before returning only the opinion vector', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const participantPublicKey = rawPublicKey(publicKey);
  const challenge = crypto.randomBytes(32).toString('base64url');
  const signature = crypto.sign(
    null,
    canonicalResearchProofMessage({ purpose: READ_OPINIONS_PURPOSE, challenge }),
    privateKey
  );

  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/^DELETE FROM research\.proof_challenges/im.test(sql)) {
        return { rows: [{ issued_at: '2026-10-02T00:00:00Z' }] };
      }
      assert.match(sql, /research\.current_opinion_responses/i);
      assert.deepEqual(params, [participantPublicKey]);
      return { rows: [
        { question_id: 'energia_nucleare', answer_code: 'f' },
        { question_id: 'caccia', answer_code: 'c' }
      ] };
    }
  };

  const reader = createResearchOpinionVectorReader({ client });
  const result = await reader.read({ participantPublicKey, challenge, signature });

  assert.deepEqual(result, {
    opinions: { energia_nucleare: 'f', caccia: 'c' }
  });
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /^DELETE FROM research\.proof_challenges/im);
  assert.match(queries[1].sql, /SELECT r\.question_id, r\.answer_code/i);

  const serialized = JSON.stringify(result);
  for (const forbidden of ['participantPublicKey', 'participant_id', 'userId', 'accountId', 'email']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('non-live Research reader runs no opinion SELECT when signature is invalid', async () => {
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  let queryCalls = 0;
  const client = {
    async query() {
      queryCalls += 1;
      return { rows: [] };
    }
  };

  const reader = createResearchOpinionVectorReader({ client });

  await assert.rejects(
    () => reader.read({
      participantPublicKey: rawPublicKey(publicKey),
      challenge: crypto.randomBytes(32).toString('base64url'),
      signature: Buffer.alloc(64)
    }),
    /Invalid or replayed participant proof/
  );
  assert.equal(queryCalls, 0);
});
