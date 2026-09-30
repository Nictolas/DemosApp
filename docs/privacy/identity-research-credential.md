# ADR: unlinkable credential candidate for Identity → Research

Status: **proposed / shadow only**

## Decision

Use `@cloudflare/privacypass-ts` as the first implementation candidate for the Identity → Research credential protocol, specifically **public-verifiable Privacy Pass tokens (Blind-RSA, RFC 9578)**.

Do not add the dependency to production yet.

## Why public-verifiable Blind-RSA

- The client blinds the token request before Identity/Issuer signs it.
- Research/Origin can verify the finalized token using the issuer public key.
- Research does not need the Identity issuer private key and does not need to call Identity during redemption.
- This fits Demos' desired separation: Identity proves eligibility; Research accepts a one-time proof without receiving the account identifier.
- The base public-verifiable flow is supported in browser environments; the public-metadata extension is not needed for V1.

## Current library compatibility

- Current upstream package observed during design review: `@cloudflare/privacypass-ts` 0.9.0.
- Upstream package is ESM-only.
- Upstream requires Node.js >= 20.
- Demos backend currently uses CommonJS and declares Node >= 18.
- Render build logs on 30/09/2026 show the production backend actually using Node 26.10.0.

The runtime is therefore currently compatible. Before adding the dependency we should still pin a supported Node >= 20 range explicitly, so future platform defaults cannot silently move the runtime. Server-side CommonJS code should use a narrow dynamic `import()` adapter rather than converting the whole backend to ESM as part of this privacy migration.

## V1 deployment shape

1. Client creates Research key material locally.
2. Client creates a Privacy Pass public-verifiable token request.
3. Identity authenticates the account, checks active political-opinion consent and one-issuance-per-epoch eligibility.
4. Identity signs the blinded request. It must not log the blinded request, final token or stable request correlation identifiers.
5. Client finalizes/unblinds the token.
6. Research verifies the token with the issuer public key and atomically records a digest in `research.spent_credentials` to prevent replay.
7. Research creates a participant keyed by the client-generated Research public key.

## Non-goals

- No demographic/public metadata in the credential V1.
- No custom Blind-RSA implementation.
- No account ID, user ID, email, IP-derived identifier or auth-session identifier in Research tables.
- No Identity callback during Research redemption.
- No automatic migration of existing opinion rows.

## Security conditions before production

- Render runtime compatibility verified (26.10.0 on 30/09/2026); pin a supported Node >= 20 range explicitly.
- Pin the Privacy Pass package version and commit lockfile.
- Validate the RFC 9578 example/test vectors in Demos' CI.
- Threat-model timing/IP/fingerprint correlation separately from cryptographic unlinkability.
- Do not share request IDs/log correlation IDs across Identity and Research.
- Perform a dedicated crypto/security review before large-scale rollout.

## References

- IETF RFC 9576 — Privacy Pass Architecture
- IETF RFC 9578 — Privacy Pass Issuance Protocols
- Cloudflare `privacypass-ts` repository and examples

## Process isolation

Research should be deployed as a separate process/service with its own `RESEARCH_DATABASE_URL`.

The Research process must not receive:
- the normal Demos `JWT_SECRET`;
- the main `DATABASE_URL`;
- Firebase/account-auth credentials;
- Identity-side credential issuance logs.

The initial scaffold includes a separate `research-server.js` / `research-app.js` and a DB pool that refuses to fall back to `DATABASE_URL`.

Using the same Supabase project can be acceptable for an early shadow/pilot only if separate PostgreSQL roles and grants actually prevent cross-domain access. Before meaningful scale, reassess whether Research should use a separate database/project for stronger compromise isolation.
