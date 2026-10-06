const runPrivacyPassBlindRsaPoc = async () => {
  const { publicVerif } = await import('@cloudflare/privacypass-ts');
  const { BlindRSAMode, Client, Issuer, Origin, getPublicKeyBytes } = publicVerif;
  const mode = BlindRSAMode.PSS;

  const keys = await Issuer.generateKey(mode, {
    modulusLength: 2048,
    publicExponent: Uint8Array.from([1, 0, 1])
  });
  const issuer = new Issuer(mode, 'identity-shadow.invalid', keys.privateKey, keys.publicKey);
  const issuerPublicKey = await getPublicKeyBytes(issuer.publicKey);
  const client = new Client(mode);
  const origin = new Origin(mode, ['research-shadow.invalid']);

  const redemptionContext = crypto.getRandomValues(new Uint8Array(32));
  const challenge = origin.createTokenChallenge(issuer.name, redemptionContext);
  const blindedRequest = await client.createTokenRequest(challenge, issuerPublicKey);
  const blindResponse = await issuer.issue(blindedRequest);
  const token = await client.finalize(blindResponse);
  const valid = await origin.verify(token, issuer.publicKey);

  if (!valid) throw new Error('Privacy Pass Blind RSA POC verification failed');

  return {
    valid,
    blindedRequestBytes: blindedRequest.serialize().length,
    tokenBytes: token.serialize().length
  };
};

if (require.main === module) {
  runPrivacyPassBlindRsaPoc()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { runPrivacyPassBlindRsaPoc };
