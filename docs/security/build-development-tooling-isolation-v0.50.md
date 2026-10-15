# CP-050 - Build and development tooling isolation v0.50

Date: 2026-10-05
Mode: local-only, shadow/read-only

## Scope
Close the remaining development-tooling audit findings identified after CP-049 without `npm audit fix --force`, production writes, deploys, migrations, Action Runner, or GitHub Actions.

## Client
- Removed unused `@originjs/vite-plugin-commonjs` (no code/config references), eliminating its legacy esbuild 0.14 chain.
- Upgraded Vite 5.4.21 to 7.3.6 and `@vitejs/plugin-react` to 5.1.4.
- Kept Vite 8 out of this checkpoint to reduce migration risk.
- Full and production npm audits: 0 findings.
- Vite production build and Capacitor Android sync: green.

## API
- `nodemon` 3.1.14 still depended on vulnerable `chokidar` 3.6.0 -> `braces` 3.0.3.
- Removed nodemon rather than applying the unsafe audit downgrade/force suggestion.
- Replaced the development command with Node's native `node --watch server.js`; API baseline already requires Node >=22.
- Full and production npm audits: 0 findings.

## Validation
- Local security pre-CI gate: PASS.
- Security Agent: 328/328 tests pass.
- Firebase Admin 14 compatibility: 3/3 tests pass, fail-closed without credentials.
- Client production build: PASS on Vite 7.3.6.
- Capacitor Android sync: PASS.
- `git diff --check`: PASS.
- API full/prod audit: 0 findings.
- Client full/prod audit: 0 findings.

## Guardrails
Security Agent remains shadow/read-only. No GitHub push/Actions, deploy, migration, production write, notification send, or Action Runner execution was performed.

## Next
CP-051 should return to the functional Security Agent roadmap now that the scoped dependency/tooling debt is cleared: close remaining Phase 0/1/2 evidence gaps and deterministic RT01-RT06 coverage before any L1/L2 automation work.
