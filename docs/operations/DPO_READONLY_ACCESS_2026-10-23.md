# DPO read-only rollout (draft)

This branch adds a separate privacy reviewer role, a minimal aggregated overview, and a dedicated page. No one receives this role automatically. No production migration or deployment is authorized by this draft.

Rollout: review permissions; apply migration first; deploy API/client; test missing/valid/revoked grants; grant only to a verified non-Admin DPO account.

Existing Admin routes are not shared. Never give the DPO server, DB, provider, secret-management, mass-delete or configuration permissions.

The old no-email Admin was deactivated, not deleted. Its six political selections are preserved pending canonical erasure and impact review. One Admin account remains active.

Whether the Garante administrator-login log exception applies still requires review of who actually administers the cloud services. RP-09/10/17 and PR #218 remain open.
