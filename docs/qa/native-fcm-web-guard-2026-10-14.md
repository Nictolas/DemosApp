# Native FCM web guard — 2026-10-14

Scope: prevent the existing Firebase Web Messaging path from running inside the Capacitor native app.

This change is intentionally separate from Android Alpha 1.0.5 (7) currently under Google Play review.

## Behavior

- Web/PWA: existing Firebase Web Messaging path remains available.
- Native Capacitor: `useFCM` exits before Notification API / service-worker registration and does not create or sync a web FCM token.
- Native push delivery is not implemented by this change; it remains a separate feature.

## Release boundary

Do not rebuild or replace Alpha 1.0.5 (7) for this change while Google Play review is in progress. Qualify and merge separately for a later Android build.
