const crypto = require('crypto');

const KEY_DOMAIN = 'demos.research.rate-limit.v1';

const createOpaqueRateLimitKey = ({ rawKey, keySecret }) => {
  if (typeof rawKey !== 'string' || rawKey.length === 0) {
    throw new Error('Research rate-limit key is required');
  }
  if (!Buffer.isBuffer(keySecret) || keySecret.length < 32) {
    throw new Error('Research rate-limit key secret must be at least 32 bytes');
  }

  return crypto
    .createHmac('sha256', keySecret)
    .update(KEY_DOMAIN)
    .update('\0')
    .update(rawKey)
    .digest('base64url');
};

class ResearchDistributedRateLimitStore {
  constructor({ backend, keySecret }) {
    if (!backend || typeof backend.increment !== 'function') {
      throw new Error('Research distributed rate-limit backend.increment is required');
    }
    this.backend = backend;
    this.keySecret = keySecret;
    this.windowMs = null;
  }

  init(options = {}) {
    if (!Number.isInteger(options.windowMs) || options.windowMs <= 0) {
      throw new Error('Research rate-limit windowMs must be a positive integer');
    }
    this.windowMs = options.windowMs;
  }

  async increment(rawKey) {
    if (!this.windowMs) {
      throw new Error('Research distributed rate-limit store is not initialized');
    }

    const key = createOpaqueRateLimitKey({ rawKey, keySecret: this.keySecret });
    const result = await this.backend.increment({ key, windowMs: this.windowMs });

    if (
      !result ||
      !Number.isInteger(result.totalHits) ||
      result.totalHits < 1 ||
      !(result.resetTime instanceof Date)
    ) {
      throw new Error('Research distributed rate-limit backend returned invalid result');
    }

    return {
      totalHits: result.totalHits,
      resetTime: result.resetTime
    };
  }

  async decrement(rawKey) {
    if (typeof this.backend.decrement !== 'function') return;
    const key = createOpaqueRateLimitKey({ rawKey, keySecret: this.keySecret });
    await this.backend.decrement({ key, windowMs: this.windowMs });
  }

  async resetKey(rawKey) {
    if (typeof this.backend.resetKey !== 'function') return;
    const key = createOpaqueRateLimitKey({ rawKey, keySecret: this.keySecret });
    await this.backend.resetKey({ key });
  }
}

module.exports = {
  KEY_DOMAIN,
  createOpaqueRateLimitKey,
  ResearchDistributedRateLimitStore
};
