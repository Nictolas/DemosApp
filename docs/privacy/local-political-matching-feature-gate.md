# Client feature gate: local political matching

The privacy-first client path is disabled unless both conditions are true:

- `VITE_PRIVACY_LOCAL_POLITICAL_MATCHING=true`
- `VITE_RESEARCH_PUBLIC_BASE_URL` is non-empty.

The Research request uses `credentials: 'omit'`, sends exactly `{ scope }`, and never sends the citizen opinion vector or an account identifier. The citizen vector is accepted only by the local ranking function after the public political vectors have been returned.

No production environment value is configured by this commit.
