const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { createResearchPublicHandlers } = require('../handlers/researchPublicHandlers');
const { canonicalResearchProofMessage } = require('../services/researchEd25519SignatureVerifier');

const rawPublicKey = (publicKey) => {
  const der = publicKey.export({ format: 'der', type: 'spki' });
  return der.subarray(der.length - 32);
};

const responseRecorder = () => {
  const state = {};
  return {
    state,
    res: {
      status(code) { state.statusCode = code; return this; },
      json(body) { state.body = body; return this; }
    }
  };
};

test('Research handler accepts one valid Ed25519 proof and rejects replay', async () => {
  const challenges = new Map();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const participantPublicKey = rawPublicKey(publicKey);
  const opinions = [{ question_id: 'q-1', answer_code: 'f' }, { question_id: 'q-2', answer_code: 'i' }];

  const client = {
    async query(sql, params) {
      if (/INSERT INTO research\.proof_challenges/i.test(sql)) {
        challenges.set(params[0].toString('hex'), params[1]);
        return { rows: [] };
      }
      if (/DELETE FROM research\.proof_challenges/i.test(sql)) {
        const digest = params[0].toString('hex');
        if (!challenges.has(digest) || challenges.get(digest) !== params[1]) return { rows: [] };
        challenges.delete(digest);
        return { rows: [{ issued_at: new Date() }] };
      }
      if (/FROM research\.current_opinion_responses/i.test(sql)) {
        assert.deepEqual(params[0], participantPublicKey);
        return { rows: opinions };
      }
      throw new Error('Unexpected query');
    }
  };

  const handlers = createResearchPublicHandlers({ getPool: () => client });
  const challengeResponse = responseRecorder();
  await handlers.issueChallenge({ body: {} }, challengeResponse.res);
  assert.equal(challengeResponse.state.statusCode, 201);

  const { challenge, purpose } = challengeResponse.state.body;
  const signature = crypto.sign(null, canonicalResearchProofMessage({ purpose, challenge }), privateKey);
  const request = {
    body: {
      participantPublicKey: participantPublicKey.toString('base64url'),
      challenge,
      signature: signature.toString('base64url')
    }
  };

  const first = responseRecorder();
  await handlers.readOpinionVector(request, first.res);
  assert.equal(first.state.statusCode, 200);
  assert.deepEqual(first.state.body, { opinions: { 'q-1': 'f', 'q-2': 'i' } });
  assert.deepEqual(Object.keys(first.state.body), ['opinions']);

  const replay = responseRecorder();
  await handlers.readOpinionVector(request, replay.res);
  assert.equal(replay.state.statusCode, 400);
  assert.deepEqual(replay.state.body, { error: 'Invalid or replayed Research proof' });
});
