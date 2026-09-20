const test = require('node:test');
const assert = require('node:assert/strict');

const {
  atomicGetAndDelete
} = require('../services/webauthnAtomicConsume');

test('usa GETDEL nativo quando disponibile', async () => {
  const calls = [];
  const client = {
    getdel: async (key) => {
      calls.push(['getdel', key]);
      return 'value';
    },
    eval: async () => {
      throw new Error('EVAL non dovrebbe essere chiamato');
    }
  };

  const result = await atomicGetAndDelete(client, 'challenge:key');

  assert.equal(result, 'value');
  assert.deepEqual(calls, [['getdel', 'challenge:key']]);
});

test('usa EVAL atomico quando GETDEL non è disponibile', async () => {
  const calls = [];
  const client = {
    eval: async (script, keys, args) => {
      calls.push({ script, keys, args });
      return 'value';
    }
  };

  const result = await atomicGetAndDelete(client, 'challenge:key');

  assert.equal(result, 'value');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].keys, ['challenge:key']);
  assert.deepEqual(calls[0].args, []);
  assert.match(calls[0].script, /redis\.call\("GET"/);
  assert.match(calls[0].script, /redis\.call\("DEL"/);
});

test('fallisce in modo chiuso se Redis non supporta né GETDEL né EVAL', async () => {
  await assert.rejects(
    () => atomicGetAndDelete({}, 'challenge:key'),
    /Redis GETDEL o EVAL richiesto per consumo challenge WebAuthn/
  );
});
