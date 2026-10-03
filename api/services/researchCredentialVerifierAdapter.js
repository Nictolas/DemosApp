const FORBIDDEN_ADAPTER_METHODS = Object.freeze([
  'issue',
  'mint',
  'sign',
  'blindSign',
  'exportKey',
  'getPrivateKey',
  'privateKey'
]);

const assertVerifyOnlyCredentialProvider = (provider) => {
  if (!provider || typeof provider.verify !== 'function') {
    throw new Error('Research credential verification provider is required');
  }

  for (const forbidden of FORBIDDEN_ADAPTER_METHODS) {
    if (forbidden in provider) {
      throw new Error('Research credential provider exposes forbidden signing capability');
    }
  }

  return provider;
};

const normalizeCredentialVersion = (value) => {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1 || value > 255) {
    throw new Error('Invalid credential version');
  }
  return value;
};

const createResearchCredentialVerifierAdapter = ({ provider }) => {
  const verifyOnlyProvider = assertVerifyOnlyCredentialProvider(provider);

  return Object.freeze({
    async verify({ credentialBytes, purpose, epoch }) {
      try {
        const result = await verifyOnlyProvider.verify({
          credentialBytes,
          purpose,
          epoch
        });

        if (!result || result.valid !== true) {
          return { valid: false };
        }

        return {
          valid: true,
          credentialVersion: normalizeCredentialVersion(result.credentialVersion)
        };
      } catch {
        return { valid: false };
      }
    }
  });
};

module.exports = {
  FORBIDDEN_ADAPTER_METHODS,
  assertVerifyOnlyCredentialProvider,
  createResearchCredentialVerifierAdapter
};
