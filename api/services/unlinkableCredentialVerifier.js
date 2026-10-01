const crypto = require('crypto');
const { validateCredentialContext } = require('./credentialContextPolicy');

const digestPresentedCredential = (credentialBytes) => {
  if (!Buffer.isBuffer(credentialBytes) || credentialBytes.length < 32) {
    throw new Error('Invalid presented credential bytes');
  }
  return crypto.createHash('sha256').update(credentialBytes).digest();
};

const verifyUnlinkableCredential = async ({
  credentialBytes,
  purpose,
  epoch,
  verifier
}) => {
  validateCredentialContext({ purpose, epoch });
  if (!verifier || typeof verifier.verify !== 'function') {
    throw new Error('Unlinkable credential verifier is required');
  }

  const verification = await verifier.verify({
    credentialBytes,
    purpose,
    epoch
  });

  if (!verification || verification.valid !== true) {
    throw new Error('Invalid unlinkable credential');
  }

  // The verifier may return cryptographic metadata, but never an Identity handle.
  for (const forbidden of ['accountId', 'account_id', 'userId', 'user_id', 'email', 'subject']) {
    if (Object.prototype.hasOwnProperty.call(verification, forbidden)) {
      throw new Error('Credential verifier leaked Identity linkage');
    }
  }

  return {
    credentialDigest: digestPresentedCredential(credentialBytes),
    credentialVersion: verification.credentialVersion || 1
  };
};

module.exports = {
  digestPresentedCredential,
  verifyUnlinkableCredential
};
