import test from 'node:test';
import assert from 'node:assert/strict';
import { publicVerif, Token } from '@cloudflare/privacypass-ts';
import providerModule from '../../api/services/researchPrivacyPassCredentialProvider.js';

const {
  BlindRSAMode,
  Client,
  Issuer,
  Origin,
  getPublicKeyBytes
} = publicVerif;
const {
  buildCredentialRedemptionContext,
  createResearchPrivacyPassCredentialProvider
} = providerModule;

const ISSUER_NAME = 'identity.demos.invalid';
const ORIGIN_INFO = ['research.demos.invalid'];

async function createIssuer() {
  const keys = await Issuer.generateKey(BlindRSAMode.PSS, {
    modulusLength: 2048,
    publicExponent: Uint8Array.from([1, 0, 1])
  });
  return new Issuer(
    BlindRSAMode.PSS,
    ISSUER_NAME,
    keys.privateKey,
    keys.publicKey
  );
}

async function issueCredential({ issuer, purpose, epoch }) {
  const origin = new Origin(BlindRSAMode.PSS, ORIGIN_INFO);
  const redemptionContext = buildCredentialRedemptionContext({ purpose, epoch });
  const challenge = origin.createTokenChallenge(
    issuer.name,
    new Uint8Array(redemptionContext)
  );
  const client = new Client(BlindRSAMode.PSS);
  const issuerPublicKeyBytes = await getPublicKeyBytes(issuer.publicKey);
  const tokenRequest = await client.createTokenRequest(challenge, issuerPublicKeyBytes);
  const tokenResponse = await issuer.issue(tokenRequest);
  return client.finalize(tokenResponse);
}

test('Demos Research provider verifies a real Blind-RSA Privacy Pass token and binds it to purpose+epoch', async () => {
  const issuer = await createIssuer();
  const token = await issueCredential({
    issuer,
    purpose: 'renew',
    epoch: '2026-Q4'
  });
  const provider = createResearchPrivacyPassCredentialProvider({
    privacyPass: { publicVerif, Token },
    issuerPublicKey: issuer.publicKey,
    issuerName: issuer.name,
    originInfo: ORIGIN_INFO
  });

  assert.deepEqual(
    await provider.verify({
      credentialBytes: Buffer.from(token.serialize()),
      purpose: 'renew',
      epoch: '2026-Q4'
    }),
    { valid: true, credentialVersion: 1 }
  );

  assert.deepEqual(
    await provider.verify({
      credentialBytes: Buffer.from(token.serialize()),
      purpose: 'renew',
      epoch: '2027-Q1'
    }),
    { valid: false }
  );

  assert.deepEqual(
    await provider.verify({
      credentialBytes: Buffer.from(token.serialize()),
      purpose: 'enroll',
      epoch: '2026-Q4'
    }),
    { valid: false }
  );
});
