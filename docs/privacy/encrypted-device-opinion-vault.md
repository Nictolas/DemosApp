# Encrypted device opinion vault

The shadow encrypted vault uses AES-256-GCM through WebCrypto. Browser storage contains only a versioned ciphertext envelope (algorithm, random IV, ciphertext). The cryptographic key is supplied by a separate `DeviceOpinionVaultKeyProvider`; the vault never serializes the key beside the ciphertext.

This is still **not production activation**. A production key provider must bind key material to the device/platform security boundary where available (for example native secure storage / OS keystore through the mobile shell) and define recovery/multi-device behavior. A key stored in the same browser storage as the ciphertext would defeat the separation and is not an acceptable production provider.

No existing opinion data is migrated or deleted by this module.
