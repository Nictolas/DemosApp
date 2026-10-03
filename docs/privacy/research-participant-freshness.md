# Research participant freshness

Shadow-only design. No production schema or data migration is applied by this change.

- A Research participant lease expires no later than 365 days after the relevant account-activity renewal.
- Expired/revoked participants are excluded by `research.current_opinion_responses`, so downstream aggregates built from the current view exclude them automatically.
- A sweep can mark due pseudonymous participants `expired`; it uses only Research participant expiry, never account_id/user_id/email.
- Identity-to-Research renewal/revocation signaling must remain unlinkable. This commit deliberately does not invent a direct account mapping.
- Production scheduling, deletion retention and aggregate materialization refresh remain separate controlled steps.

## Renewal boundary

A `renew` unlinkable credential may extend only an already-known pseudonymous participant key. Redemption is one-shot through `research.spent_credentials` and the participant lease is reset to 365 days from redemption. Research receives no account identifier. Identity issuance policy still needs to enforce that only an active account may receive the blind renewal credential; production wiring remains disabled.

## Identity renewal eligibility

Identity may record a blind `renew` issuance only when `identity.participation_eligibility` is active/eligible and the supplied account activity is less than 365 days old. The Identity policy never receives a Research participant identifier, participant public key or credential digest. The actual blind-signing transport remains a separate cryptographic boundary; this shadow policy does not deploy it.
