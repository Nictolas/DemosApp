function createMemoryReplayStore({ now = () => Date.now() } = {}) {
  const entries = new Map();

  return {
    async consumeOnce({ token, ttlSeconds }) {
      const current = now();
      const expiresAt = entries.get(token);
      if (expiresAt !== undefined && expiresAt > current) return false;
      entries.set(token, current + ttlSeconds * 1000);
      return true;
    },
    sweepExpired() {
      const current = now();
      for (const [token, expiresAt] of entries) {
        if (expiresAt <= current) entries.delete(token);
      }
      return entries.size;
    },
  };
}

module.exports = { createMemoryReplayStore };
