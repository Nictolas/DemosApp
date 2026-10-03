# Research renewal redemption shadow route

Status: shadow only. Not mounted, not deployed, no production traffic.

## Purpose

Prepare the Research-owned renewal redemption edge without reconnecting Research to an Identity-authenticated request. The client presents two independent proofs: an opaque unlinkable renewal credential and a fresh participant-key proof issued by the Research renewal challenge route.

Shadow path:

- `POST /v1/renewal/redeem`

Allowed request fields are exactly `credential`, `epoch`, `participantPublicKey`, `challenge`, and `signature`. The route hard-codes the renewal purpose in the service layer rather than accepting a client-selected purpose.

## Privacy and replay boundary

- No JWT, account session, email, `accountId`, `userId` or Identity middleware is accepted.
- Credential, participant key, challenge and signature are canonical base64url values with bounded byte lengths before service invocation.
- The participant proof must consume a fresh one-time Research challenge.
- The opaque renewal credential is verified and redeemed through the existing single-use credential store.
- Replay, invalid proof, invalid credential and unknown participant outcomes share the same public error.
- A successful response is only `{ "renewed": true }`; participant IDs, status and timestamps are never exposed.
- The route has a dedicated conservative shadow limiter of 10 requests per minute.
- The route is intentionally absent from `research-app.js`.

## Activation gate

This file does not authorize production exposure. Before any mount or deployment, require audited production credential and participant-signature verifier adapters, distributed rate limiting, database readiness, security review and the DPIA decision covering low-traffic privacy/revocation trade-offs.
