# Demos Privacy Pass POC

Small isolated proof of concept for the future **Identity → Research** unlinkable credential flow.

## Scope

This POC proves only the RFC 9578 public-verifiable Blind-RSA lifecycle:

1. Research/Origin creates a challenge.
2. Client creates a blinded token request.
3. Identity/Issuer signs the blinded request.
4. Client finalizes/unblinds the token.
5. Research verifies it with the Issuer public key.

It deliberately runs all roles in one Node process so we can validate the library API before designing HTTP boundaries.

## Run locally

```bash
cd poc/privacy-pass
npm install
npm run poc
```

Expected final property:

```json
{
  "tokenVerified": true
}
```

## Safety properties of this POC

- Uses `@cloudflare/privacypass-ts@0.9.0`.
- Uses public-verifiable Blind-RSA / PSS.
- Does not print tokens, blind values, nonces or key material.
- Does not import Demos account auth, database code, Supabase or Render config.
- Does not read or write real user data.
- Does not alter the production backend dependency tree.

## Not proven yet

This POC does **not** prove production unlinkability. A real deployment still needs:

- separate Identity and Research services;
- separate logging/observability;
- anti-replay storage;
- one-issuance-per-account/epoch logic;
- participant key ownership;
- timing/IP/fingerprint correlation mitigations;
- revocation/deletion/recovery flows;
- security review.

Reference implementation/API adapted from Cloudflare's public-verifiable example for `privacypass-ts`.
