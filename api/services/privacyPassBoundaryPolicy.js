const FORBIDDEN_BOUNDARY_KEYS = new Set([
  'account_id', 'accountId', 'user_id', 'userId', 'email', 'subject',
  'participant_id', 'participantId', 'opinion', 'opinions'
]);

const assertNoIdentityResearchLinkage = (value, path = '$') => {
  if (!value || typeof value !== 'object') return true;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_BOUNDARY_KEYS.has(key)) {
      throw new Error('Forbidden unlinkable-credential boundary field at ' + path + '.' + key);
    }
    assertNoIdentityResearchLinkage(nested, path + '.' + key);
  }
  return true;
};

const buildBlindIssuanceEnvelope = ({ blindedRequest, purpose, epoch }) => {
  if (!(blindedRequest instanceof Uint8Array) || blindedRequest.length === 0) {
    throw new Error('Missing blinded issuance request');
  }
  const envelope = { blindedRequest, purpose, epoch };
  assertNoIdentityResearchLinkage(envelope);
  return envelope;
};

const buildResearchPresentation = ({ token, purpose, epoch }) => {
  if (!(token instanceof Uint8Array) || token.length === 0) {
    throw new Error('Missing finalized token');
  }
  const presentation = { token, purpose, epoch };
  assertNoIdentityResearchLinkage(presentation);
  return presentation;
};

module.exports = {
  assertNoIdentityResearchLinkage,
  buildBlindIssuanceEnvelope,
  buildResearchPresentation
};
