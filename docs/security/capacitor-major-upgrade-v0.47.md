# CP-047 - Capacitor 7 Major Upgrade Isolation v0.47

## Scope

Local-only remediation of the critical Capacitor CLI / tar dependency chain. No GitHub push, GitHub Actions, deploy, production write, migration, or Action Runner activation.

## Upgrade accepted

- `@capacitor/core`: 6.2.1 -> 7.6.9
- `@capacitor/android`: 6.2.1 -> 7.6.9
- `@capacitor/cli`: 6.2.2 -> 7.6.9
- `@capacitor/haptics`: 6.0.3 -> 7.0.5
- CLI `tar`: 6.2.1 -> 7.5.22
- Gradle wrapper: 8.2.1 -> 8.11.1
- Android Gradle Plugin: 8.2.1 -> 8.7.2
- Google Services Gradle plugin: 4.4.0 -> 4.4.2
- Java source/target: 17 -> 21
- Android minSdk: 22 -> 23
- AndroidX versions aligned with a clean Capacitor 7.6.9 Android project.

The automatic migrator was not accepted blindly: it failed on the Gradle wrapper and on parsing the existing `variables.gradle`. Those two areas were reconciled against a locally generated clean Capacitor 7.6.9 Android template before validation.

## Dependency result

Production client audit before CP-047: 8 findings = 1 critical + 7 high.

Production client audit after CP-047: 6 findings = 0 critical + 6 high.

The critical `tar` chain is removed. Remaining production findings are the Tailwind 3 / `braces` / `chokidar` / `fast-glob` / `micromatch` family. Full client audit is 9 findings = 7 high + 2 moderate.

The package lock was regenerated from the CP-046 lock rather than accepting the broad migrator refresh. This reduced version-changing package entries from 227 to 55, keeping the dependency delta centered on Capacitor 7 and its transitive CLI dependencies.

## Local validation

- clean `npm ci --ignore-scripts` from the minimized lock: PASS
- `npm run test:security-preci`: PASS
- Security Agent tests: 328/328 PASS
- Vite production build: PASS
- `npx cap sync android`: PASS
- Gradle `assembleDebug` with JDK 21: PASS
- Android debug APK produced successfully
- `git diff --check`: PASS
- repository has no configured `lint` script; no lint command was invented or silently substituted.

A portable Temurin JDK 21 was used temporarily inside the repository for validation and removed after the successful build. Future Android validation requires JDK 21 or newer. `android/local.properties` is ignored by the repository and points to the already installed Android SDK; it is not part of the commit.

## Safety invariants

The AI Cybersecurity Agent remains shadow/read-only. This checkpoint changes mobile build dependencies only and does not add execution authority, external delivery, production credentials, database migrations, or production writes.

## Next recommended checkpoint

CP-048 - Tailwind 4 migration feasibility and production-high dependency remediation. Test it as an isolated major because the six remaining production findings are all in the Tailwind 3 dependency family. Firebase Admin 14 and Vite/build-tooling majors remain separate later checkpoints.
