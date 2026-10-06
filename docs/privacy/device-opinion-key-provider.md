# Device opinion key provider

The repository currently has Capacitor core/Android and haptics, but no secure-storage/keystore plugin. Therefore this change does **not** add a new native dependency and does not pretend browser localStorage is a keystore.

The provider boundary accepts only an injected secure platform bridge. If no verified bridge is available, the production-safe behavior is fail-closed. There is deliberately no localStorage/sessionStorage fallback for AES key material.

A later native integration must implement `SecureKeyBridge` with Android Keystore-backed storage (and the equivalent platform secure storage for other native targets), then pass security review before the privacy matching gate can be enabled.
