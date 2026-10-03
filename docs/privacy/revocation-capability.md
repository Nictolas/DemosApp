# Offline revocation capability — shadow design

Goal: permit deletion/revocation when the user's normal Research device/key is unavailable without adding an account identifier to Research.

1. The client generates at least 256 random bits as a revocation capability during enrollment.
2. Research receives and stores only SHA-256(capability) alongside the pseudonymous participant.
3. A recovery copy may be escrowed on the Identity side only if encrypted under a dedicated recovery design. Identity must never receive the Research participant id/public key or Research digest.
4. On account deletion, or a separately verified deceased-account workflow, the recovery capability can be presented to Research. Research hashes it, revokes the matching pseudonymous participant and does not need the civil identity.
5. The capability is a bearer deletion secret. Logs must never contain it. Rate limiting, authenticated deletion workflow, encryption-at-rest/escrow key management and one-time destruction remain mandatory before production.

Privacy limitation: if Identity itself sends the capability directly to Research, timing/network metadata could correlate the deletion event. Production should use a client-mediated or delayed/batched relay and a dedicated security review. This commit therefore defines only the Research-side shadow primitive and schema field; it does not implement Identity escrow or a production endpoint.

## Identity escrow persistence

The shadow Identity store persists only an authenticated-encryption envelope under the account. It has no Research participant identifier, public key, credential digest or opinion data. Production key custody/rotation and capability relay remain disabled and require separate approval.

## Authorized release workflow

Identity may recover an escrowed capability only after an explicit authorization decision supplied by the future account-deletion/deceased-account workflow. The relay callback receives exactly `{ capability }`; no account or participant identifier is passed. The Identity escrow is deleted only after relay acceptance and only if its key version has not changed concurrently. Rejection leaves the escrow available for retry. Plaintext capability memory is zeroed in `finally`. This shadow helper is not an endpoint and does not define who may authorize a real deletion.

## Identity authorization policy

The shadow release workflow no longer accepts a raw `authorized=true`. Identity evaluates one of three explicit reasons: confirmed self-deletion, inactivity reaching 365 days, or independently verified deceased status. Unknown reasons and malformed/future activity timestamps fail closed. The reason remains inside Identity; the relay still receives only the opaque capability. Production definitions for who verifies a death, how self-deletion is strongly authenticated, and the authoritative activity timestamp source remain separate controls.

## Authoritative inactivity source

For the shadow inactivity decision, callers no longer supply the activity timestamp. Identity reads `MAX(active_sessions.last_activity)` for the account and evaluates the 365-day threshold internally. Missing or malformed activity fails closed. This reuses the existing session activity source rather than creating a parallel client-controlled timestamp. Before production, coverage of every authentication path and retention of `active_sessions` must be verified so the source is complete enough for account-lifecycle decisions.

## Authentication activity coverage audit

Audit found that refresh/logout updated `active_sessions`, but initial OAuth and WebAuthn token issuance did not. A central `recordIssuedSession` helper now creates/updates the session immediately when those flows issue a refresh token, so `last_activity` reflects successful initial login as well as refresh. The CIE callback currently verifies/links identity and does not itself issue Demos login tokens, so it is not a separate activity-producing login path. Production retention/cleanup of `active_sessions` still needs review before automatic 365-day deletion is enabled.
