const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `start marker missing: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `end marker missing: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('OAuth: complete-registration avvia CIE senza creare users', () => {
  const source = read('api/routes/auth/oauth.js');
  const block = between(
    source,
    "router.post('/oauth/complete-registration'",
    "router.post('/oauth/registration/exchange'"
  );
  assert.match(block, /saveCieRegistrationTransaction/);
  assert.match(block, /requiresCie:\s*true/);
  assert.doesNotMatch(block, /INSERT INTO users/i);
  assert.doesNotMatch(block, /generateTokenPair/);
});

test('Passkey: register/verify avvia CIE senza creare users o JWT', () => {
  const source = read('api/routes/auth/webauthn.js');
  const block = between(
    source,
    "router.post('/webauthn/register/verify'",
    "router.post('/webauthn/login/options'"
  );
  assert.match(block, /saveCieRegistrationTransaction/);
  assert.match(block, /requiresCie:\s*true/);
  assert.doesNotMatch(block, /INSERT INTO users/i);
  assert.doesNotMatch(block, /generateTokenPair/);
});

test('la callback CIE finalizza sia OAuth sia Passkey solo dopo UserInfo verificata', () => {
  const source = read('api/routes/auth/identity.js');
  const userInfoIndex = source.indexOf('fetchAndValidateCieUserInfo');
  const oauthIndex = source.indexOf('completeOAuthRegistrationAfterCie', userInfoIndex);
  const passkeyIndex = source.indexOf('completePasskeyRegistrationAfterCie', userInfoIndex);
  assert.ok(userInfoIndex > -1);
  assert.ok(oauthIndex > userInfoIndex);
  assert.ok(passkeyIndex > userInfoIndex);
});

test('gli account personali vengono inseriti solo nei finalizer post-CIE', () => {
  assert.match(read('api/services/oauthRegistrationService.js'), /INSERT INTO users/i);
  assert.match(read('api/services/passkeyRegistrationService.js'), /INSERT INTO users/i);
});
