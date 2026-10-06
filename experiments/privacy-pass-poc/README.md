# Demos Privacy Pass POC

Isolated proof-of-concept for the proposed **Identity → Research** unlinkable credential flow.

This directory is deliberately outside `api/`:

- it is not installed by the production Render build;
- it does not change Demos runtime dependencies;
- it does not create API routes;
- it does not write to Supabase;
- it does not contain production keys or secrets.

## Library and exact dependency tree

The public Privacy Pass API remains pinned for the POC:

```
@cloudflare/privacypass-ts 0.9.0
```

The published 0.9.0 package pins `@cloudflare/blindrsa-ts 0.4.5`. An exact npm audit found that tree vulnerable through `sjcl <=1.0.8` (high severity, GHSA-2w8x-224x-785m). The isolated POC therefore overrides BlindRSA to `0.4.6`, matching the newer upstream dependency line and resolving `sjcl 1.0.9`.

`package-lock.json` is committed. The repeat production-dependency audit reports **0 vulnerabilities** at the high-severity gate. Because BlindRSA 0.4.6 requires Node >=24, this POC now declares Node >=24; the validation run uses Node 26.

This override is a POC compatibility measure, not production approval. Prefer an upstream Privacy Pass release that natively includes the fixed dependency before production adoption.

## What the tests demonstrate

The first test follows the upstream public-verifiable Blind-RSA flow:

1. **Identity/Issuer** owns the signing private key.
2. **Research/Origin** creates a token challenge.
3. **Client** creates a blinded token request.
4. **Identity** signs the blinded request.
5. **Client** finalizes/unblinds the token.
6. **Research** verifies the token using only the issuer public key.

The Research verifier integration test then passes a real finalized token through the Demos verify-only provider boundary. It additionally requires:

- the token challenge digest to match a Research challenge deterministically bound to `purpose + epoch`;
- the token key ID to match an accepted issuer public key;
- Blind-RSA verification to succeed with that public key;
- the same token to fail if `purpose` or `epoch` is changed.

The shadow rotation policy supports a bounded old/new public-key overlap: at most two verification keys may be active for one epoch, and a token must resolve by key ID + epoch to exactly one key.

This is the cryptographic primitive we want for:

> authenticated Demos account → one eligibility credential → pseudonymous Research participant

without sending `account_id`, email or the Identity session to Research.

## What this does NOT prove

A successful cryptographic test does **not** prove that a deployed system is unlinkable.

IP address, timestamps, request IDs, cookies, device fingerprints, analytics SDKs or shared infrastructure can still correlate issuance and redemption. Those risks remain governed by the Demos threat model.

It also does not yet implement or authorize:

- production key provisioning or authenticated public-key distribution;
- audited issuer infrastructure;
- production mounting of Research renewal routes;
- distributed rate limiting;
- consent enforcement and operational DPIA decisions;
- network/timing separation;
- production deletion/revocation scheduling.

The deterministic 32-byte redemption context used for `purpose + epoch` is a Demos shadow design choice and must receive protocol/security review before production activation.

## Run in an isolated environment

```bash
cd experiments/privacy-pass-poc
npm ci --ignore-scripts
npm test
npm audit --omit=dev --audit-level=high
```
