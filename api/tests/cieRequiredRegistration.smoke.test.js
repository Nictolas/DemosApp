const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  REGISTRATION_IDENTITY_MODES,
  getRegistrationIdentityMode,
  isCieRequiredForRegistration,
} = require('../services/identityRegistrationPolicy');

const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('registration identity policy defaults to progressive and can restore CIE pre-account', () => {
  assert.equal(getRegistrationIdentityMode({}), REGISTRATION_IDENTITY_MODES.PROGRESSIVE);
  assert.equal(isCieRequiredForRegistration({}), false);
  assert.equal(getRegistrationIdentityMode({ DEMOS_REGISTRATION_IDENTITY_MODE: 'cie_required' }), REGISTRATION_IDENTITY_MODES.CIE_REQUIRED);
  assert.equal(isCieRequiredForRegistration({ DEMOS_REGISTRATION_IDENTITY_MODE: 'cie_required' }), true);
  assert.throws(() => getRegistrationIdentityMode({ DEMOS_REGISTRATION_IDENTITY_MODE: 'invalid' }), /non valido/);
});

test('OAuth registration supports progressive account creation and preserves CIE-required path', () => {
  const source = read('api/routes/auth/oauth.js');
  assert.match(source, /completeOAuthRegistrationWithoutCie/);
  assert.match(source, /isCieRequiredForRegistration/);
  assert.match(source, /requiresCie:\s*false/);
  assert.match(source, /saveCieRegistrationTransaction/);
  assert.match(source, /requiresCie:\s*true/);
});

test('Passkey registration supports progressive account creation and preserves CIE-required path', () => {
  const source = read('api/routes/auth/webauthn.js');
  assert.match(source, /completePasskeyRegistrationWithoutCie/);
  assert.match(source, /isCieRequiredForRegistration/);
  assert.match(source, /requiresCie:\s*false/);
  assert.match(source, /saveCieRegistrationTransaction/);
  assert.match(source, /requiresCie:\s*true/);
});

test('CIE callback still finalizes verified registrations only after validated UserInfo', () => {
  const source = read('api/routes/auth/identity.js');
  const userInfoIndex = source.indexOf('fetchAndValidateCieUserInfo');
  const oauthIndex = source.indexOf('completeOAuthRegistrationAfterCie', userInfoIndex);
  const passkeyIndex = source.indexOf('completePasskeyRegistrationAfterCie', userInfoIndex);
  assert.ok(userInfoIndex > -1);
  assert.ok(oauthIndex > userInfoIndex);
  assert.ok(passkeyIndex > userInfoIndex);
});