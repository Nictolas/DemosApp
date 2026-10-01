const READ_OPINIONS_PURPOSE = 'read-opinions-v1';
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
  verifier
}) => {
  assertBufferLength(participantPublicKey, 32, 'participant public key');
  assertBufferLength(signature, 64, 'participant signature');

  if (typeof challenge !== 'string' || !CHALLENGE_PATTERN.test(challenge)) {
    throw new Error('Invalid participant proof challenge');
  }
  if (!verifier || typeof verifier.verify !== 'function') {
    throw new Error('Participant proof verifier is required');
  }

  const verification = await verifier.verify({
    purpose: READ_OPINIONS_PURPOSE,
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
    purpose: READ_OPINIONS_PURPOSE
  };
};

module.exports = {
  READ_OPINIONS_PURPOSE,
  verifyResearchParticipantProof
};
