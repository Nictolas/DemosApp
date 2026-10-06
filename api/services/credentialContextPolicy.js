const ALLOWED_CREDENTIAL_PURPOSES = new Set(['enroll', 'renew']);
const EPOCH_PATTERN = /^\d{4}-(?:Q[1-4]|M(?:0[1-9]|1[0-2]))$/;

const validateCredentialContext = ({ purpose, epoch }) => {
  if (!ALLOWED_CREDENTIAL_PURPOSES.has(purpose)) {
    throw new Error('Unsupported credential purpose');
  }
  if (typeof epoch !== 'string' || !EPOCH_PATTERN.test(epoch)) {
    throw new Error('Invalid credential epoch');
  }
  return true;
};

module.exports = { validateCredentialContext };
