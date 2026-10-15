# Android native push v0 - 2026-10-14

Scope: prepare the native Android push transport without changing the Google Play Alpha 1.0.5 (7) currently under review.

## Implemented in this branch

- Adds `@capacitor/push-notifications` 6.x, compatible with the existing Capacitor 6 stack.
- Keeps Firebase Web Messaging isolated to web/PWA through the existing `useFCM` native guard.
- Adds `useNativePush` for Android/Capacitor permission, registration token, foreground receive and notification-action handling.
- Native registration is fail-closed behind `VITE_ANDROID_NATIVE_PUSH_ENABLED=true`; without the Firebase Android config the app does not call `PushNotifications.register()`. The `android:sync:push` helper verifies the canonical config before setting this flag.
- Adds `usePushNotifications` as a transport selector (`native` vs `web`).
- Updates token synchronization to send the real native FCM registration token to `/api/fcm-tokens`.
- Stores the native registration token locally only so logout can deactivate the matching server token.
- Logout deletes the server-side token, unregisters the native Firebase token, clears local push state, then clears the auth session.
- Foreground native notifications are configured for alert + sound.
- Creates the Android notification channels already referenced by backend payloads: `demos_notifications` and `avvistamenti_notifications`. Channel creation is best-effort and never blocks FCM registration.
- Native notification taps prefer explicit `data.link` / `data.url`, then use a compatibility fallback for legacy payload types (`demos_notification`, `user_notification`, `political_opinion_change`, `avvistamento`, `operational_alert`). This prevents older Android payloads from opening the app without routing to the intended DEMOS screen.

## Required before release

1. Keep the verified Firebase Android `google-services.json` for package `community.demos` in `client/android/app/` locally and out of Git.
2. Build/sync native push through `npm run android:sync:push`; the helper validates Firebase project `demos-finale` + package `community.demos` and only then injects `VITE_ANDROID_NATIVE_PUSH_ENABLED=true`.
3. Re-run the focused Node integrity tests, Vite build, Capacitor sync and signed APK/AAB builds on the latest PR head.
4. Re-run the Android runtime smoke and verify the two expected notification channels exist before delivery tests.
5. E2E gate: permission -> FCM registration -> `/api/fcm-tokens` persistence -> receive foreground/background -> tap routing -> logout -> server token inactive + Firebase unregister.
6. Update Google Play Data Safety in the same release that first ships native push, including Firebase Installation ID under Device or other IDs as applicable.

Until all six gates pass, native push is code-complete scaffolding only and must not be represented as a released Android capability.

## Qualification history

### Head `2c01fa28` — qualified 2026-10-14

- `npm ci`: PASS.
- `node --test api/tests/fcmTokenIntegrity.test.js`: 9/9 PASS.
- `npm run android:sync:push`: PASS.
- Vite build + Capacitor sync: PASS; detected `@capacitor/push-notifications@6.0.5`.
- Gradle `assembleDebug bundleRelease`: PASS, including `signReleaseBundle`.
- `processDebugGoogleServices` / `processReleaseGoogleServices`: PASS.
- Merged Android manifest included `POST_NOTIFICATIONS` and the Capacitor/Firebase messaging services.
- Android 35 runtime reported platform `android`, plugin available and notification permission granted.
- Firebase initialization: PASS.
- Real `PushNotifications.register()`: PASS with a real FCM registration token emitted; token value was not exposed.
- Emulator restored afterward to Android 1.0.5 / versionCode 7 / minSdk 24 / targetSdk 36.

### Latest head after channel/tap hardening — requalification required

The PR now also contains Android-channel creation and legacy tap-routing fallbacks. Snyk is green on the updated head, but the focused test/build/sync/Gradle/runtime sequence above must be rerun before those previous PASS results can be attributed to the latest commit.

## Release boundary

Do not rebuild, replace or modify the Alpha 1.0.5 (7) currently under Google Play review for this work. Use a later versionCode after qualification. Production remains untouched by this branch.
