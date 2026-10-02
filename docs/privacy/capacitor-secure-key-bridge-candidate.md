# Capacitor secure key bridge candidate

Candidate for the current Capacitor 6 Android app: `capacitor-secure-storage-plugin@0.10.0`.

## Acceptance constraints

This dependency is not installed by this commit. Before installation it must pass dependency/supply-chain review and a native Android build test.

The adapter must:
- run only when Capacitor reports a native Android platform;
- never invoke the plugin on web/PWA;
- expose only the narrow `SecureKeyBridge` contract;
- fail closed when native/plugin capability is unavailable;
- never implement a browser fallback.

The upstream plugin's web implementation is unsuitable for political-opinion key material because it uses browser LocalStorage. Demos must therefore reject web use before any plugin call.

## Native verification before activation

On a physical Android device verify: reinstall behavior, lock-screen/device-auth behavior if used, backup/restore behavior, Android Keystore-backed operation, ciphertext/key loss behavior, and that disabling/removing the plugin cannot trigger legacy matching fallback.
