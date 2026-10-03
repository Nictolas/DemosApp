# Privacy Pass dependency audit — isolated POC

Status: isolated experiment only. This document does not authorize a production dependency or deployment.

## Exact tree

The POC keeps `@cloudflare/privacypass-ts` pinned to `0.9.0` and now commits an npm lockfile generated with Node 26 / npm 11. The production `api/package.json` still does not depend on Privacy Pass.

The first exact-tree audit exposed a real blocker in the published `0.9.0` package: it pins `@cloudflare/blindrsa-ts` `0.4.5`, which pulled vulnerable `sjcl <=1.0.8` and caused `npm audit --omit=dev --audit-level=high` to report three high-severity findings (GHSA-2w8x-224x-785m).

Cloudflare's current upstream tree has already moved BlindRSA to `0.4.6`, whose dependency tree resolves `sjcl 1.0.9`. The isolated Demos POC therefore uses an npm `overrides` entry forcing `@cloudflare/blindrsa-ts` `0.4.6` while leaving `@cloudflare/privacypass-ts` pinned at `0.9.0`.

After the override, the generated lockfile resolves:

- `@cloudflare/privacypass-ts 0.9.0`;
- `@cloudflare/blindrsa-ts 0.4.6`;
- `sjcl 1.0.9`;
- Node requirement `>=24` for the isolated POC.

The repeat audit completed with `found 0 vulnerabilities` at the high-severity gate.

## Production gate

The override is acceptable for an isolated compatibility POC only. Before production adoption:

- prefer a new upstream `@cloudflare/privacypass-ts` release that natively pins the fixed BlindRSA dependency;
- rerun real Blind-RSA issuance/finalization/verification tests against the exact lockfile;
- re-run npm audit and independent dependency review;
- review upstream changelog/source compatibility between BlindRSA 0.4.5 and 0.4.6;
- do not copy the POC dependency into the production API until the security review explicitly approves it.
