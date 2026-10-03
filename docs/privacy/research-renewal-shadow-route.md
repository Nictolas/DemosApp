# Research renewal challenge shadow route

Status: shadow only. Not mounted, not deployed, no production traffic.

## Purpose

Expose the renewal proof challenge as a Research-owned public surface without reintroducing an Identity-authenticated request boundary.

Shadow path:

- `POST /v1/renewal/proof-challenges`

The request body must be an empty object. Identity-shaped fields are rejected by the shared Research public payload policy.

## Privacy boundary

- No JWT, account session, email, `accountId`, `userId` or Identity middleware is accepted.
- The route uses the Research challenge rate limiter before the handler.
- The handler asks `researchVerifiedRenewalService` for a challenge whose purpose is `renew-participation`.
- The route returns only the opaque challenge and its purpose.
- The route is intentionally absent from `research-app.js`; creating it does not expose a new production endpoint.

## Activation gate

Before any mount or deployment, require a separate review of public exposure policy, distributed rate-limit readiness, database readiness and the DPIA decision covering low-traffic revocation latency versus the privacy cohort threshold.
