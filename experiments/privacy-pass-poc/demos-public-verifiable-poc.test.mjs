import test from 'node:test';
import assert from 'node:assert/strict';
import { publicVerif } from '@cloudflare/privacypass-ts';

const {
  BlindRSAMode,
  Client,
  Issuer,
  Origin,
  getPublicKeyBytes
} = publicVerif;

async function createIdentityIssuer() {
  const keys = await Issuer.generateKey(BlindRSAMode.PSS, {
    modulusLength: 2048,
    publicExponent: Uint8Array.from([1, 0, 1])
  });

  const issuer = new Issuer(
    BlindRSAMode.PSS,
    'identity.demos.invalid',
    keys.privateKey,
    keys.publicKey
  );

  return {
    issuer,
    publicKeyBytes: await getPublicKeyBytes(issuer.publicKey)
  };
}

function createResearchVerifier() {
  return new Origin(
    BlindRSAMode.PSS,
    ['research.demos.invalid']
  );
}

async function runClientIssuance({ issuer, issuerPublicKeyBytes, research }) {
  const client = new Client(BlindRSAMode.PSS);

  // Research creates the challenge. No Demos account identifier is included.
  const redemptionContext = crypto.getRandomValues(new Uint8Array(32));
  const challenge = research.createTokenChallenge(
    issuer.name,
    redemptionContext
  );

  // Client blinds the request before Identity sees/signs it.
  const tokenRequest = await client.createTokenRequest(
    challenge,
    issuerPublicKeyBytes
  );

  // In Demos this is the ONLY step performed by authenticated Identity.
  const tokenResponse = await issuer.issue(tokenRequest);

  // Client unblinds/finalizes locally.
  return client.finalize(tokenResponse);
}

test('public-verifiable token can be issued by Identity and verified by Research without issuer private key', async () => {
  const { issuer, publicKeyBytes } = await createIdentityIssuer();
  const research = createResearchVerifier();

  const token = await runClientIssuance({
    issuer,
    issuerPublicKeyBytes: publicKeyBytes,
    research
  });

  const valid = await research.verify(token, issuer.publicKey);
  assert.equal(valid, true);
});

test('Research verifier is constructed without the Identity private key', async () => {
  const { issuer, publicKeyBytes } = await createIdentityIssuer();
  const research = createResearchVerifier();

  assert.equal('privateKey' in research, false);

  const token = await runClientIssuance({
    issuer,
    issuerPublicKeyBytes: publicKeyBytes,
    research
  });

  assert.equal(await research.verify(token, issuer.publicKey), true);
});
