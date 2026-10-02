const RESEARCH_RATE_LIMIT_KEY_PREFIX = 'demos:research:rate-limit:';

const ATOMIC_INCREMENT_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {count, ttl}"
].join('\n');

const normalizeAtomicResult = ({ result, nowMs }) => {
  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error('Research atomic rate-limit result is invalid');
  }

  const totalHits = Number(result[0]);
  const ttlMs = Number(result[1]);

  if (!Number.isInteger(totalHits) || totalHits < 1) {
    throw new Error('Research atomic rate-limit hit count is invalid');
  }
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error('Research atomic rate-limit TTL is invalid');
  }

  return {
    totalHits,
    resetTime: new Date(nowMs + ttlMs)
  };
};

const createResearchAtomicRateLimitBackend = ({
  evalScript,
  now = () => Date.now()
}) => {
  if (typeof evalScript !== 'function') {
    throw new Error('Research atomic rate-limit evalScript dependency is required');
  }
  if (typeof now !== 'function') {
    throw new Error('Research atomic rate-limit clock is required');
  }

  return {
    async increment({ key, windowMs }) {
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key)) {
        throw new Error('Research atomic rate-limit key is invalid');
      }
      if (!Number.isInteger(windowMs) || windowMs <= 0) {
        throw new Error('Research atomic rate-limit windowMs is invalid');
      }

      const result = await evalScript({
        script: ATOMIC_INCREMENT_SCRIPT,
        keys: [RESEARCH_RATE_LIMIT_KEY_PREFIX + key],
        args: [String(windowMs)]
      });

      return normalizeAtomicResult({
        result,
        nowMs: Number(now())
      });
    }
  };
};

module.exports = {
  RESEARCH_RATE_LIMIT_KEY_PREFIX,
  ATOMIC_INCREMENT_SCRIPT,
  normalizeAtomicResult,
  createResearchAtomicRateLimitBackend
};
