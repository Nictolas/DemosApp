# ADR: unlinkable participation credential POC

Status: POC candidate only; not approved for production.

## Decision for the next experiment

Use the IETF Privacy Pass publicly verifiable token flow (RFC 9578 token type 0x0002),
backed by Blind RSA / RSABSSA from RFC 9474, as the first concrete unlinkability POC.

Candidate implementation: @cloudflare/privacypass-ts / @cloudflare/blindrsa-ts.

## Why this is the first candidate

- Blind issuance directly addresses the required issuer-to-redemption unlinkability property.
- RFC 9578 defines a publicly verifiable Blind-RSA token flow and anti-linkability considerations.
- RFC 9474 defines the underlying RSA blind-signature primitive.
- The TypeScript implementation fits the existing Node-oriented stack and uses WebCrypto.
- Demos currently needs a one-shot participation credential, not selective disclosure of a
  multi-attribute credential.

## Alternatives considered

BBS/BBS+ is valuable for zero-knowledge selective disclosure and has an active W3C
cryptosuite, but it is broader than the current one-shot-token requirement. The Microsoft
Node reference implementation also explicitly describes itself as not production-ready.
BBS remains a future candidate if Demos needs privacy-preserving attribute disclosure.

## Privacy constraints for the POC

1. Identity authenticates/authorizes the account before issuance, but signs only a blinded
   request and must never receive the final token or Research participant public key.
2. The client generates token material locally and retains blinding state locally.
3. Research verifies the finalized token with issuer public material only.
4. Research derives its one-shot spent digest locally from the presented token.
5. Neither issuer request nor verifier output may carry account_id, user_id, email,
   OIDC subject, participant_id, or opinion data across the boundary.
6. purpose/epoch binding must not become a per-user tag. Values are shared by cohorts.
7. Issuer logs must not contain blinded-message bytes or response bytes in production.
8. Network/timing correlation remains a separate metadata risk and needs mitigation.

## Production gate

Do not wire this into routes or production merely because the cryptographic POC works.
Before integration: pin/review dependency versions, validate official RFC vectors, define
issuer key rotation and storage, assess timing/network correlation, run a focused security
review, and test the complete flow against isolated PostgreSQL.
