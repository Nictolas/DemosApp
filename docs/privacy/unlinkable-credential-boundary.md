# Unlinkable credential boundary (shadow design)

Status: design/POC only. Not wired to production.

## Security requirement

A normal signed token (including a normal Ed25519/JWT signature) is not sufficient for the
Identity -> Research boundary because the issuer can observe the exact token/message and later
correlate it when Research redeems it.

The production credential scheme must provide issuer-unlinkable presentation: after issuance,
the Identity issuer must not be able to determine which valid presentation was redeemed by
Research. It must also support purpose/epoch binding and proof verification without returning
an account/user/email/OIDC subject to Research.

## Application contract

Research receives only:
- opaque credential presentation bytes;
- purpose and epoch;
- a participant public key generated outside Identity.

A cryptographic verifier must return only validity and non-identifying cryptographic metadata.
The application hashes the presented credential locally for one-shot anti-replay. Any verifier
output containing an Identity handle is rejected.

## Explicitly not claimed yet

This scaffold does not implement blind issuance or anonymous credentials. A concrete,
reviewed scheme/library must be selected and tested before production integration. Candidate
families should be evaluated for blind issuance/unlinkable presentation, maintained
implementations for the deployed runtime, security review/audit history, and operational key
management.

Do not replace this boundary with a plain JWT, bearer token, deterministic signed blob, or
ordinary Ed25519 signature and call it unlinkable.
