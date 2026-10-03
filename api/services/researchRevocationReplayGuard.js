const crypto = require('crypto');

function replayToken(capability) {
  if (!Buffer.isBuffer(capability) || capability.length < 32) throw new Error('Opaque capability required');
  return crypto.createHash('sha256').update(Buffer.from('demos:relay-replay:v1')).update(capability).digest('base64url');
}

function createReplayGuard() {
  const seen = new Set();
  return {
    accept(capability) {
      const token = replayToken(capability);
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    },
    size() { return seen.size; },
  };
}

module.exports = { replayToken, createReplayGuard };
