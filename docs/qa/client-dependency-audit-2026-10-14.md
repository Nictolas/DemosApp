# Client dependency security hardening — 2026-10-14

## Scope

Isolated dependency hardening for `client/`. No Google Play artifact, Android versionCode/versionName, backend production, or Play Alpha release is changed by this work.

## Baseline

Fresh `npm ci` on main (`37db1f4e`) reported:

- all client dependencies: 46 vulnerabilities — 1 low, 17 moderate, 23 high, 5 critical;
- `npm audit --omit=dev`: 40 vulnerabilities — 15 moderate, 20 high, 5 critical.

## Changes

- applied only the non-forcing `npm audit fix` path and retained compatible lockfile updates;
- removed unused client-side `express`, `cors`, and `dotenv` dependencies;
- removed unused `tailwindcss-animate` and `@originjs/vite-plugin-commonjs`;
- removed duplicate build tooling from runtime dependencies (`vite`, `postcss`, `autoprefixer`, `tailwindcss`, `@vitejs/plugin-react`) while retaining it under `devDependencies`;
- moved `@capacitor/cli` to `devDependencies` (the CLI is build tooling, not browser runtime);
- upgraded Firebase Web SDK from 10.14.1 to 11.10.0; the app uses the modular `firebase/app` and `firebase/messaging` entry points;
- compatible lock updates include `@capacitor/android` 6.2.2, `@capacitor/cli` 6.2.2, DOMPurify 3.4.17, Express transitive fixes removed from the client tree, updated Babel/Rollup/PostCSS support packages, and other non-breaking transitive patches.

## Result

After the changes:

- all client dependencies: 15 vulnerabilities — 3 moderate, 11 high, 1 critical;
- `npm audit --omit=dev`: 4 high, 0 critical.

The remaining production-audit findings are inherited from the Firebase umbrella package through its installed Firestore/gRPC dependency graph. DEMOS currently imports Firebase App + Messaging only. The production Vite bundle contains no `grpc-js` or `undici` code strings; the remaining `firestore` occurrence is in Firebase's internal product/version-name map.

The remaining critical finding in the full audit is in `tar` under Capacitor CLI build tooling. A Capacitor 7.6.9 migration removes that critical advisory, but `cap sync` switches Android compilation to Java 21; the current Android toolchain is Java 17 and the experimental Gradle build correctly failed with `invalid source release: 21`. That major migration is therefore deferred instead of forcing a toolchain change into the current release line.

Vite 8 and Tailwind 4 are also major migrations and are intentionally not forced as part of this hardening pass.

## Qualification

PASS on the retained Capacitor 6 / Java 17 line:

- `node --test api/tests/fcmTokenIntegrity.test.js`: 5/5;
- `npm ci`;
- `npm run build`;
- `npx cap sync android`;
- Gradle `clean assembleDebug`;
- Android build remains on the existing release metadata; no Play artifact was rebuilt or uploaded.
