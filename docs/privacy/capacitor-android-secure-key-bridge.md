# Capacitor Android secure key bridge adapter

This adapter is compile-time isolated from any third-party secure-storage package. It accepts an injected plugin port and a Capacitor runtime probe.

Security properties:
- checks native Android before every storage operation, not only at initialization;
- never calls the plugin on web/PWA or another platform;
- normalizes only known string/value response shapes and fails on unexpected payloads;
- implements the narrow SecureKeyBridge consumed by the opinion-key provider.

The third-party package is intentionally not imported or installed yet. This keeps the repository lockfile/native build unchanged while the adapter contract and downgrade protections are tested. After dependency approval, a tiny composition module can bind the real plugin to this port.
