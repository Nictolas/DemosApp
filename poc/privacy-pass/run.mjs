import { publicVerif } from '@cloudflare/privacypass-ts';

const {
  BlindRSAMode,
  Client,
  Issuer,
  Origin,
  getPublicKeyBytes
} = publicVerif;

const mode = BlindRSAMode.PSS;

// POC only: all roles run in one process.
// Production Demos will separate Identity/Issuer from Research/Origin.
const keys = await Issuer.generateKey(mode, {
  modulusLength: 2048,
  publicExponent: Uint8Array.from([1, 0, 1])
});

const issuer = new Issuer(
  mode,
  'identity.demos.invalid',
  keys.privateKey,
  keys.publicKey
);

const issuerPublicKey = await getPublicKeyBytes(issuer.publicKey);
const client = new Client(mode);
const researchOrigin = new Origin(mode, ['research.demos.invalid']);

const redemptionContext = crypto.getRandomValues(new Uint8Array(32));
const challenge = researchOrigin.createTokenChallenge(
  issuer.name,
  redemptionContext
);

// Client blinds the request before Identity/Issuer receives it.
const tokenRequest = await client.createTokenRequest(
  challenge,
  issuerPublicKey
);

// Identity/Issuer signs the blinded request.
const tokenResponse = await issuer.issue(tokenRequest);

// Client finalizes/unblinds the token.
const token = await client.finalize(tokenResponse);

// Research/Origin verifies only with the issuer public key.
const valid = await researchOrigin.verify(token, issuer.publicKey);

if (!valid) {
  console.error('Privacy Pass POC failed');
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  protocol: 'Privacy Pass public-verifiable Blind-RSA',
  suite: 'PSS',
  issuer: issuer.name,
  researchOrigin: 'research.demos.invalid',
  tokenVerified: true,
  note: 'No token, nonce, blinded request or key material is printed.'
}, null, 2));
