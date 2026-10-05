# CP-046 - Controlled non-major dependency remediation v0.46

Date: 2026-10-05
Branch: `security/agent-foundation-v0`
Mode: local only; shadow/read-only unchanged.

## Scope

- No `npm audit fix --force`.
- No intentional major-version upgrades.
- No deploy, migration, production write, Action Runner, or GitHub Actions.
- Every accepted dependency change must pass the CP-045 local pre-CI gate.

## API remediation

- Pinned `@fastify/busboy` to `3.2.2` through an explicit npm override.
- Updated only its lockfile record instead of accepting npm's unrelated large lockfile rewrite.
- Production audit moved from 5 findings (1 high, 4 moderate) to 4 findings (0 high, 4 moderate).
- Remaining production findings are the `firebase-admin` / Firestore / google-gax / uuid chain; npm requires `firebase-admin` 14.x, a major upgrade, to clear them.
- Full API audit remains 7 findings: 4 moderate plus 3 high in the development-only nodemon -> chokidar -> braces chain.

## Client remediation

Accepted patch/minor updates include patched releases in the current dependency majors, including DOMPurify, Express, PostCSS, protobufjs, websocket-driver, Vite/Rollup/Babel/browser tooling and related transitive packages.

Additional explicit same-major overrides:

- `@grpc/grpc-js` -> `1.14.5`
- `undici` -> `6.29.0`

These overrides remove the Firebase/grpc/undici vulnerability cluster without changing the Firebase major.

## Audit delta

Client production:
- Before CP-046: 37 total = 1 low, 14 moderate, 19 high, 3 critical.
- After CP-046: 8 total = 0 low, 0 moderate, 7 high, 1 critical.

Client full dependency graph:
- Before CP-046: 43 total = 2 low, 16 moderate, 22 high, 3 critical.
- After CP-046: 11 total = 0 low, 2 moderate, 8 high, 1 critical.

## Residual risk requiring a later checkpoint

Production client findings now collapse mainly into two families:

1. Capacitor CLI / `tar`: the remaining critical tar advisories require moving away from the current Capacitor 6 dependency chain; npm proposes Capacitor 8.x, which is a major upgrade.
2. Tailwind tooling / `braces`: `braces` 3.0.3 is the newest published 3.x release and remains affected; this propagates through chokidar/micromatch/fast-glob/Tailwind. There is no clean same-major patch available.

Full client audit additionally retains Vite/esbuild and `@originjs/vite-plugin-commonjs` tooling findings that require a major Vite/toolchain change or plugin replacement.

## Validation

- `npm ci --ignore-scripts --dry-run` accepted both API and client lock graphs.
- CP-045 local pre-CI gate: PASS.
- Security Agent tests: 328/328 PASS.
- Client Vite production build: PASS on Vite 5.4.21.
- `git diff --check`: included in the gate and PASS.

## Next checkpoint

CP-047 should isolate and test the major-upgrade paths, starting with the critical Capacitor/tar chain, then Firebase Admin 14 and the Vite/build-tooling major path. No major upgrade should be accepted without a dedicated compatibility matrix and the full local security gate.
