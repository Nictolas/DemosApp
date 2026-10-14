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

## Required before release

1. Obtain the Firebase Android `google-services.json` for package `community.demos` from the canonical DEMOS Firebase project.
2. Add it to `client/android/app/` only after verifying `client.package_name == community.demos`.
3. Build/sync native push through `npm run android:sync:push`; the helper validates Firebase project `demos-finale` + package `community.demos` and only then injects `VITE_ANDROID_NATIVE_PUSH_ENABLED=true`.
4. Re-run `cap sync android`, signed APK/AAB builds and real-device/account tests.
5. E2E gate: permission -> FCM registration -> `/api/fcm-tokens` persistence -> receive foreground/background -> tap routing -> logout -> server token inactive + Firebase unregister.
6. Update Google Play Data Safety in the same release that first ships native push, including Firebase Installation ID under Device or other IDs as applicable.

Until all six gates pass, native push is code-complete scaffolding only and must not be represented as a released Android capability.

## Verified now

- Web build passes.
- Capacitor sync detects `@capacitor/push-notifications` 6.0.5.
- Android debug and release bundle builds pass; `signReleaseBundle` passes.
- Merged Android manifest includes `POST_NOTIFICATIONS` and the Capacitor/Firebase messaging services.
- Android 35 runtime reports platform `android`, native=true and PushNotifications plugin available.
- With no Firebase Android config, a forced direct `register()` reproduces the expected FirebaseApp initialization crash. The production hook is therefore explicitly gated and will not call native registration until the verified config + enable flag are present.

## Release boundary

Do not rebuild, replace or modify the Alpha 1.0.5 (7) currently under Google Play review for this work. Use a later versionCode after qualification.
