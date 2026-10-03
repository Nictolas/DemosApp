# Offline revocation capability — shadow design

Goal: permit deletion/revocation when the user's normal Research device/key is unavailable without adding an account identifier to Research.

1. The client generates at least 256 random bits as a revocation capability during enrollment.
2. Research receives and stores only SHA-256(capability) alongside the pseudonymous participant.
3. A recovery copy may be escrowed on the Identity side only if encrypted under a dedicated recovery design. Identity must never receive the Research participant id/public key or Research digest.
4. On account deletion, or a separately verified deceased-account workflow, the recovery capability can be presented to Research. Research hashes it, revokes the matching pseudonymous participant and does not need the civil identity.
5. The capability is a bearer deletion secret. Logs must never contain it. Rate limiting, authenticated deletion workflow, encryption-at-rest/escrow key management and one-time destruction remain mandatory before production.

Privacy limitation: if Identity itself sends the capability directly to Research, timing/network metadata could correlate the deletion event. Production should use a client-mediated or delayed/batched relay and a dedicated security review. This commit therefore defines only the Research-side shadow primitive and schema field; it does not implement Identity escrow or a production endpoint.
