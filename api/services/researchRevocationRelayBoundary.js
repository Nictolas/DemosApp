const blocked = new Set(['accountId','userId','email','participantId','participantPublicKey','credentialDigest','opinionVector','requestedAt']);
function validateRelayItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid relay item');
  for (const key of Object.keys(item)) if (blocked.has(key)) throw new Error('Correlating relay metadata forbidden');
  if (Object.keys(item).length !== 1 || !Buffer.isBuffer(item.capability) || item.capability.length < 32) {
    throw new Error('Opaque revocation capability required');
  }
  return item;
}
function buildRelayBatch(items, minimumBatchSize = 8) {
  if (!Number.isSafeInteger(minimumBatchSize) || minimumBatchSize < 2) throw new Error('Invalid batch threshold');
  if (!Array.isArray(items) || items.length < minimumBatchSize) throw new Error('Relay batch below privacy threshold');
  return { version: 1, items: items.map((item) => ({ capability: Buffer.from(validateRelayItem(item).capability) })) };
}
module.exports = { validateRelayItem, buildRelayBatch };
