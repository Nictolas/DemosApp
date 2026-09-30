# Demos Privacy Pass POC

Isolated proof-of-concept for the proposed **Identity → Research** unlinkable credential flow.

This directory is deliberately outside `api/`:

- it is not installed by the production Render build;
- it does not change Demos runtime dependencies;
- it does not create API routes;
- it does not write to Supabase;
- it does not contain production keys or secrets.

## Library

Pinned for the POC:

```
@cloudflare/privacypass-ts 0.9.0
```

The upstream package was re-verified on 30/09/2026. It is ESM-only and requires Node >=20.

## What the test demonstrates

The test follows the upstream public-verifiable Blind-RSA flow:

1. **Identity/Issuer** owns the signing private key.
2. **Research/Origin** creates a token challenge.
3. **Client** creates a blinded token request.
4. **Identity** signs the blinded request.
5. **Client** finalizes/unblinds the token.
6. **Research** verifies the token using only the issuer public key.

This is the cryptographic primitive we want for:

> authenticated Demos account → one eligibility credential → pseudonymous Research participant

without sending `account_id`, email or the Identity session to Research.

## What this does NOT prove

A successful cryptographic test does **not** prove that a deployed system is unlinkable.

IP address, timestamps, request IDs, cookies, device fingerprints, analytics SDKs or shared infrastructure can still correlate issuance and redemption. Those risks remain governed by the Demos threat model.

It also does not yet implement:

- one credential per account/epoch;
- anti-replay persistence;
- participant key/recovery;
- consent enforcement;
- network/timing separation;
- deletion/revocation flow.

## Run in an isolated environment

```bash
cd experiments/privacy-pass-poc
npm install
npm test
```

Before any production adoption, generate and commit a lockfile for this package and review the dependency tree/security advisories.
