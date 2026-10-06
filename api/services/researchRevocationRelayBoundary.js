const crypto = require('node:crypto');

const blocked = new Set([
  'accountId', 'userId', 'email', 'participantId', 'participantPublicKey',
  'credentialDigest', 'opinionVector', 'requestedAt', 'requestId', 'receiptId'
]);

function validateRelayItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid relay item');
  for (const key of Object.keys(item)) if (blocked.has(key)) throw new Error('Correlating relay metadata forbidden');
  if (Object.keys(item).length !== 1 || !Buffer.isBuffer(item.capability) || item.capability.length < 32) {
    throw new Error('Opaque revocation capability required');
  }
  return item;
}

function assertMinimumBatch(items, minimumBatchSize) {
  if (!Number.isSafeInteger(minimumBatchSize) || minimumBatchSize < 2) throw new Error('Invalid batch threshold');
  if (!Array.isArray(items) || items.length < minimumBatchSize) throw new Error('Relay batch below privacy threshold');
}

function copyDistinctItems(items) {
  const seen = new Set();
  return items.map((item) => {
    const capability = Buffer.from(validateRelayItem(item).capability);
    const key = capability.toString('base64');
    if (seen.has(key)) throw new Error('Relay privacy threshold requires distinct opaque capabilities');
    seen.add(key);
    return { capability };
  });
}

function shuffleRelayItems(items, randomInt = crypto.randomInt) {
  if (typeof randomInt !== 'function') throw new Error('Relay shuffle source required');
  const shuffled = items.map((item) => ({ capability: Buffer.from(item.capability) }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    if (!Number.isSafeInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new Error('Relay shuffle source returned invalid index');
    }
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function buildRelayBatch(items, minimumBatchSize = 8, randomInt = crypto.randomInt) {
  assertMinimumBatch(items, minimumBatchSize);
  const distinct = copyDistinctItems(items);
  return { version: 1, items: shuffleRelayItems(distinct, randomInt) };
}

function validateRelayBatch(batch, minimumBatchSize = 8) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw new Error('Invalid relay batch envelope');
  const keys = Object.keys(batch).sort();
  if (keys.length !== 2 || keys[0] !== 'items' || keys[1] !== 'version' || batch.version !== 1) {
    throw new Error('Invalid relay batch envelope');
  }
  assertMinimumBatch(batch.items, minimumBatchSize);
  return { version: 1, items: copyDistinctItems(batch.items) };
}

module.exports = {
  validateRelayItem,
  validateRelayBatch,
  shuffleRelayItems,
  buildRelayBatch
};
