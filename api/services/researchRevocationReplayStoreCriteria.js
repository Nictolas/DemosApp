const REQUIRED_CAPABILITIES = Object.freeze([
  'atomicCreateIfAbsent',
  'nativeExpiry',
  'boundedRetention',
  'failClosed',
  'opaqueKeysOnly',
  'noIdentityMetadata',
]);

function evaluateReplayStoreCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Candidate description required');
  }

  const missing = REQUIRED_CAPABILITIES.filter((key) => candidate[key] !== true);
  return {
    eligible: missing.length === 0,
    missing,
  };
}

module.exports = { REQUIRED_CAPABILITIES, evaluateReplayStoreCandidate };
