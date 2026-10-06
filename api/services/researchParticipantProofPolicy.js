const READ_OPINIONS_PURPOSE = 'read-opinions-v1';
const RENEW_PARTICIPATION_PURPOSE = 'renew-participant-v1';
const PARTICIPANT_PROOF_PURPOSES = Object.freeze([
  READ_OPINIONS_PURPOSE,
  RENEW_PARTICIPATION_PURPOSE
]);
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const assertBufferLength = (value, expectedLength, label) => {
  if (!Buffer.isBuffer(value) || value.length !== expectedLength) {
    throw new Error(`Invalid ${label}`);
  }
};

const assertNoIdentityLeakage = (verification) => {
  for (const forbidden of [
    'accountId',
    'account_id',
    'userId',
    'user_id',
    'email',
    'subject',
    'sessionId',
    'session_id'
  ]) {
    if (Object.prototype.hasOwnProperty.call(verification, forbidden)) {
      throw new Error('Participant proof verifier leaked Identity linkage');
    }
  }
};

const verifyResearchParticipantProof = async ({
  participantPublicKey,
  challenge,
  signature,
  purpose = READ_OPINIONS_PURPOSE,
  verifier
}) => {
  assertBufferLength(participantPublicKey, 32, 'participant public key');
  assertBufferLength(signature, 64, 'participant signature');

  if (!PARTICIPANT_PROOF_PURPOSES.includes(purpose)) {
    throw new Error('Unsupported participant proof purpose');
  }
  if (typeof challenge !== 'string' || !CHALLENGE_PATTERN.test(challenge)) {
    throw new Error('Invalid participant proof challenge');
  }
  if (!verifier || typeof verifier.verify !== 'function') {
    throw new Error('Participant proof verifier is required');
  }

  const verification = await verifier.verify({
    purpose,
    participantPublicKey,
    challenge,
    signature
  });

  if (!verification || verification.valid !== true || verification.challengeFresh !== true) {
    throw new Error('Invalid or replayed participant proof');
  }

  assertNoIdentityLeakage(verification);

  if (verification.keyAlgorithm && verification.keyAlgorithm !== 'ed25519') {
    throw new Error('Unsupported participant proof algorithm');
  }

  return {
    participantPublicKey,
    purpose
  };
};

module.exports = {
  READ_OPINIONS_PURPOSE,
  RENEW_PARTICIPATION_PURPOSE,
  PARTICIPANT_PROOF_PURPOSES,
  verifyResearchParticipantProof
};
