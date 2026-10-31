# GDPR B2 — synthetic object-version response binding (2026-10-30)

**Scope:** isolated operator-only read-only checker for a fixed, non-personal synthetic fixture on Draft PR #374. No provider was contacted in this work. **Production recovery remains NO-GO.**

## Failure mode

The pre-existing checker pinned `Bucket/Key/VersionId` in its two requests and compared the downloaded bytes with a committed fixture, but it did not verify that the **response** reported the requested `VersionId`. An intermediary or a malformed provider response could therefore return matching bytes without establishing which immutable version was actually served. Likewise, a contradictory `ContentLength` could be accepted when the bytes matched. The retention response and the object response could disagree without an explicit rejection.

## Synthetic-only hardening

`api/scripts/attest-gdpr-b2-synthetic-version-readonly.js` now:

1. Permits only `GetObjectRetention` and `GetObject` with the **exact** input fields `Bucket,Key,VersionId` for the reserved fixture. Optional range/requester fields and any other commands are rejected.
2. Requires `GetObject` to return the exact requested `VersionId`; missing or different IDs, and delete-marker responses, fail closed even when the bytes match.
3. If the object response includes `ObjectLockMode` or `ObjectLockRetainUntilDate`, requires `COMPLIANCE` and the **same retention timestamp** as the dedicated `GetObjectRetention` response. The separate retention command remains mandatory. Absent optional lock headers are not treated as proof.
4. Requires a declared `ContentLength`, when present, to equal the actual bounded downloaded byte count. The fixed fixture's SHA-256 and exact bytes are still checked. Error reports remain free of bucket, version, credential and SDK exception details.

The tests in `api/tests/gdprB2SyntheticVersionReadonly.test.js` cover absent/mismatched version IDs, contradictory lock and length metadata, delete markers, forbidden optional request fields, and a valid response with matching optional lock metadata. **All positive results still explicitly return `recoveryReady:false`.**

## Evidence boundary and next gates

This change strengthens a **mocked response-validation contract**, not the existence, integrity, freshness, immutability or completeness of real GDPR event versions. No B2 key, credential, object, bucket, database, staging service or production runtime was accessed or modified. A real provider may omit version headers; in that case the check must report NO-GO rather than weakening the identity requirement.

The operator-only synthetic probe is not a full journal inventory, and a successful fixture check cannot prove PostgreSQL commit order, snapshot provenance, external checkpoint continuity, writer fencing, isolation or restore. Those independent gates remain required under issue #296 before any production recovery admission. No merge or deploy authorized.

**Record final GitHub workflow conclusions and the exact commit SHA in the PR and issue only after CI completes.**
