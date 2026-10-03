# Research participant freshness

Shadow-only design. No production schema or data migration is applied by this change.

- A Research participant lease expires no later than 365 days after the relevant account-activity renewal.
- Expired/revoked participants are excluded by `research.current_opinion_responses`, so downstream aggregates built from the current view exclude them automatically.
- A sweep can mark due pseudonymous participants `expired`; it uses only Research participant expiry, never account_id/user_id/email.
- Identity-to-Research renewal/revocation signaling must remain unlinkable. This commit deliberately does not invent a direct account mapping.
- Production scheduling, deletion retention and aggregate materialization refresh remain separate controlled steps.
