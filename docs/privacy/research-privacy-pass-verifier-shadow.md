# Research Privacy Pass credential verifier — shadow

Status: shadow only. No production mount, no production issuer key, no runtime dependency added to `api/package.json`.

## Boundary

Research verifies a finalized public-verifiable Blind-RSA Privacy Pass token using only the issuer public key. The provider rejects the token unless all three checks succeed:

1. the token's challenge digest matches a Demos Research challenge bound to credential `purpose + epoch`;
2. the token key ID matches the configured issuer public key;
3. the Blind-RSA signature verifies with the issuer public key.

The Demos context is converted to a 32-byte redemption context as SHA-256 over a domain-separated canonical string. Changing `purpose` or `epoch` therefore changes the expected challenge digest and causes verification to fail.

## Isolation

The concrete library remains pinned only in `experiments/privacy-pass-poc/` at `@cloudflare/privacypass-ts` 0.9.0. The production API receives the library implementation and issuer public key by injection; it does not import the package or hold issuer private-key/signing capability.

The POC integration test generates a real Blind-RSA key pair, issues/finalizes a token, and verifies the serialized token through the same Research provider boundary. The same token must fail under a different purpose or epoch.

## Activation gates

Before production use:

- generate and review an exact lockfile/dependency tree for the isolated POC;
- independently review the deterministic redemption-context construction against RFC 9578 / the authentication scheme and Demos threat model;
- define issuer public-key distribution, rotation and pinning;
- ensure no issuer private key or signing API enters Research;
- complete distributed rate limiting, DB readiness, security review and DPIA decisions;
- mount routes only after an explicit production-readiness checkpoint.
