# Identity revocation escrow envelope (shadow)

Status: design/helper only. No endpoint, persistence, KMS secret, schema change or production deployment is introduced by this checkpoint.

## Boundary

Identity may retain an encrypted copy of the opaque Research revocation capability so account deletion or another authorized Identity event can later request revocation without storing a permanent Identity-to-Research participant mapping.

The envelope uses AES-256-GCM with a fresh 96-bit IV. The Identity account identifier is authenticated only as AAD and is not serialized into the envelope. `keyVersion` supports explicit key rotation. The helper fails closed for malformed envelopes, wrong account context, wrong key, or authentication failure.

The plaintext capability remains a bearer deletion secret and must never be logged. Production persistence must store only the authenticated ciphertext envelope inside the Identity trust domain. Keys must come from an approved KMS/secret-management boundary; they must not be stored beside ciphertext.

## Anti-correlation constraint

This checkpoint does **not** define direct Identity-to-Research delivery. A direct revocation request can correlate an Identity event with a Research participant through timing and network metadata even when the capability itself is opaque. Before activation, choose and review a client-mediated or delayed/batched relay with replay protection and bounded deletion latency.

## Rotation and retention

Decrypt with the envelope's `keyVersion`, then re-encrypt under the current version when rotation is required. Delete the escrow envelope when the Identity account no longer requires it and after the corresponding Research deletion/revocation workflow has reached its documented terminal state.

No Research participant identifier, public key, opinion vector, credential digest, email, or civil-identity attribute belongs in this envelope.
