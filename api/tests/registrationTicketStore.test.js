const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRegistrationTicket,
  consumeRegistrationTicket,
  TICKET_TTL_SECONDS
} = require('../services/registrationTicketStore');

function fakeRedis() {
  const data = new Map();
  return {
    data,
    async set(key, value, options = {}) {
      assert.equal(options.ex, TICKET_TTL_SECONDS);
      data.set(key, value);
      return 'OK';
    },
    async getdel(key) {
      const value = data.has(key) ? data.get(key) : null;
      data.delete(key);
      return value;
    }
  };
}

test('ticket registrazione e opaco, one-time e non espone userId nella chiave Redis', async () => {
  const redis = fakeRedis();
  const ticket = await createRegistrationTicket({ userId: 'user-secret-123' }, redis);

  assert.match(ticket, /^[A-Za-z0-9_-]{40,}$/);
  const [redisKey] = [...redis.data.keys()];
  assert.match(redisKey, /^registration:exchange:[a-f0-9]{64}$/);
  assert.doesNotMatch(redisKey, /user-secret-123/);

  assert.deepEqual(await consumeRegistrationTicket(ticket, redis), { userId: 'user-secret-123' });
  await assert.rejects(
    consumeRegistrationTicket(ticket, redis),
    /non trovato, scaduto o gia utilizzato/
  );
});
