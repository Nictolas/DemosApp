# Research renewal verifier wiring

Status: shadow-only composition. Not mounted, not deployed, no production traffic.

## What is wired

The renewal redemption shadow surface now has a composition layer that can wire two independent verifier adapters without importing Identity authentication or account state:

- participant proof: real Ed25519 verification via Node `crypto`, bound to the Research proof domain and followed by one-time Research challenge consumption;
- unlinkable credential: a strict verify-only adapter around an injected public credential verification provider.

The credential adapter intentionally exposes only `verify`. Providers exposing issuance, signing, blind-signing, private-key export or private-key access capabilities are rejected. Provider exceptions fail closed and provider metadata is not propagated across the adapter boundary.

## What is deliberately not wired yet

This change does **not** select or install the production Blind-RSA/Privacy Pass verifier implementation. The existing isolated Privacy Pass POC remains the reference for that choice. Production credential verification therefore still requires an audited public-key-only provider before the route can be considered deployable.

## Isolation guarantees

- no Identity JWT/session/account middleware;
- no account/user/email fields;
- no private signing key in Research;
- no environment-secret lookup in the composition layer;
- no mount in `research-app.js`;
- no new production endpoint or traffic.

## Next gate

Before production activation: select and audit the concrete unlinkable credential verifier, pin its dependency/version, verify key-distribution and rotation, use distributed rate limiting, complete DB readiness/security review, and resolve the DPIA decision for low-traffic revocation latency versus privacy cohort size.
