const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sexFromVerifiedCieGender, persistVerifiedCieSex } = require('../utils/cieSex');

test('il claim CIE firmato usa M/F/NULL e non inferisce il genere', () => {
  assert.equal(sexFromVerifiedCieGender('male'), 'M');
  assert.equal(sexFromVerifiedCieGender('female'), 'F');
  for (const invalid of [undefined, null, '', 'other', '0', '1', 0, 1, 'm', 'M', 'Female', 'u', 'd', 'a']) {
    assert.equal(sexFromVerifiedCieGender(invalid), null);
  }
});

test('persistenza sesso CIE richiede valore verificato, UUID e aggiornamento di una sola riga', async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rowCount: 1 };
    }
  };
  assert.equal(await persistVerifiedCieSex(client, 'user-1', null), false);
  assert.equal(calls.length, 0);
  await assert.rejects(persistVerifiedCieSex(client, 'user-1', '0'), /non valido/);
  assert.equal(calls.length, 0);
  assert.equal(await persistVerifiedCieSex(client, 'user-1', 'M'), true);
  assert.deepEqual(calls[0].params, ['M', 'user-1']);
  assert.match(calls[0].sql, /sesso = \$1/);
  assert.match(calls[0].sql, /sesso IS NULL OR sesso = \$1/);
  assert.match(calls[0].sql, /account_type = 'PERSON'/);
  await assert.rejects(
    persistVerifiedCieSex({ query: async () => ({ rowCount: 0 }) }, 'user-1', 'F'),
    /Conflitto/
  );
});

test('le API utente non accettano sesso CIE dal browser', () => {
  const read = relative => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');
  for (const file of ['api/routes/users/search.js', 'api/routes/users/profile.js']) {
    const source = read(file);
    assert.doesNotMatch(source, /'nome', 'cognome', 'sesso'/);
  }
  const callback = read('api/routes/auth/identity.js');
  assert.match(callback, /verifiedCieSex: userInfo\.sesso/);
  assert.match(callback, /sesso: userInfo\.sesso/);
  const admin = read('client/src/pages/Utenti/index.tsx');
  assert.match(admin, /user\.sesso === 'M' \|\| user\.sesso === 'F'/);
  assert.doesNotMatch(admin, /user\.genere \|\| 'N\/A'/);
});
