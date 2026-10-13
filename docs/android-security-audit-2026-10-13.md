# Android release security audit — 2026-10-13

Scope: branch `release/android-package-align-20261013`, intended package `community.demos`.

## Findings

- Native permissions currently declared: `INTERNET` only.
- No native camera, microphone, geolocation, contacts, storage, or advertising-ID permission is declared.
- Capacitor uses HTTPS as the Android scheme; production cleartext HTTP is unnecessary.
- Android backup was enabled in the generated manifest even though the app handles authenticated sessions/account data.
- `FileProvider` was not exported, but its path configuration allowed the entire external-storage root (`external-path path="."`). No Capacitor Share/Filesystem plugin is currently declared in `client/package.json`.
- Push notification code currently uses Firebase Web Messaging. `@capacitor/push-notifications` and native `POST_NOTIFICATIONS` are not present, so native Android background/closed-app push should not be treated as complete.
- The client synchronizes an FCM token to `/api/fcm-tokens` for authenticated mobile users after notification permission. Google Play Data Safety should therefore be checked for the applicable “Device or other IDs” disclosure and notification functionality purpose.

## Hardening applied in this branch

- Disable Android application backup.
- Explicitly disable cleartext HTTP traffic.
- Restrict `FileProvider` from the whole external-storage root to app cache only.

## Deliberately deferred

- Native Capacitor push integration and `POST_NOTIFICATIONS`: functional change, to be implemented/tested separately after the current Play review.
- Any Play Console Data Safety declaration change: verify the existing declaration before changing it.
- Merge to `main`: wait for a successful local Android build/smoke test with DeskMCP.
