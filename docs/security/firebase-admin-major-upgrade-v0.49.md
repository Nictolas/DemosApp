# CP-049 - Firebase Admin 14 Major Upgrade Isolation v0.49

## Scope

Local-only upgrade of Firebase Admin to remove the remaining API production dependency findings. No GitHub push, GitHub Actions, deploy, migration, production write, real FCM delivery, or Action Runner activation.

## Upgrade accepted

- `firebase-admin`: 13.10.0 -> 14.5.0
- DEMOS already requires Node `>=22.0.0`, matching Firebase Admin 14's Node requirement.
- The package-only major bump was explicitly rejected during validation because Firebase Admin 14 no longer exposes the legacy namespace members used by DEMOS (`admin.apps`, `admin.credential.cert`, `admin.messaging`).
- `api/services/firebaseAdmin.js` now uses the v14 modular entry points from `firebase-admin/app` and `firebase-admin/messaging`.
- The service preserves the narrow compatibility surface used by existing routes by returning a facade that exposes `admin.messaging()` backed by `getMessaging(app)`.
- Existing route code therefore does not need a broad notification-path rewrite in the same checkpoint.

## Safety and compatibility

The Firebase service remains fail-closed when credentials are absent. The compatibility tests do not use production credentials and do not call `messaging.send()`, so no real push notification is delivered.

A permanent local compatibility test covers:

1. required Firebase Admin 14 modular entry points;
2. fail-closed behavior without Firebase credentials;
3. the `admin.messaging()` facade used by existing DEMOS routes.

The compatibility test was also added to the local pre-CI gate so future dependency or service changes cannot silently reintroduce the namespace break.

## Dependency result

API production audit before CP-049:

- 4 moderate findings
- 0 high
- 0 critical

The affected chain was Firebase Admin 13 / Firestore / google-gax / uuid.

API production audit after CP-049:

- 0 findings
- 0 moderate
- 0 high
- 0 critical

The full API audit still reports 3 high findings, all in development tooling:

- `nodemon` (direct)
- `chokidar` (transitive)
- `braces` (transitive)

These are not part of the production dependency graph and are intentionally not remediated with `npm audit fix --force` in this checkpoint.

## Local validation

- clean `npm ci --ignore-scripts`: PASS
- installed `firebase-admin@14.5.0`: PASS
- Firebase Admin compatibility tests: 3/3 PASS
- Security Agent suite: 328/328 PASS
- local `npm run test:security-preci`: PASS
- Vite production build: PASS
- `git diff --check`: PASS
- no production Firebase credentials used
- no FCM message sent

## Safety invariants

The AI Cybersecurity Agent remains shadow/read-only. CP-049 changes a notification dependency and its local compatibility layer only; it does not grant the AI Agent execution authority or activate notification delivery on its behalf.

## Next recommended checkpoint

CP-050 - build/development tooling isolation. Address the remaining client Vite/esbuild/@originjs findings and the API nodemon/chokidar/braces development-only findings without weakening the local pre-CI gate or introducing forced upgrades.
