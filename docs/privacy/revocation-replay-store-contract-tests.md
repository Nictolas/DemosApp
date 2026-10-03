# Replay store contract test suite

This shadow checkpoint defines reusable storage-agnostic tests for future replay-store adapters.

Every candidate adapter must demonstrate:
- exactly one successful consume among concurrent attempts for the same opaque token;
- rejection while the token is inside its TTL;
- acceptance only after expiry;
- storage unavailability must surface as an error rather than silently accepting the token.

The suite passes no account ID, participant ID, public key, email, opinion vector or other identity metadata to the adapter.

The current in-memory POC is used only to prove that the suite itself is executable. Passing these tests in one process does not prove distributed atomicity. A future real adapter must run the same contract tests against its isolated test instance before any production provisioning or activation.
