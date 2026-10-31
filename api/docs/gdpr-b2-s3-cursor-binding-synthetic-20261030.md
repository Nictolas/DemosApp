# GDPR B2 — S3 continuation cursor binding (synthetic, 30 October 2026)

## Failure mode
The S3-shaped `ListObjectVersions` pagination fixture compared `NextKeyMarker/NextVersionIdMarker` from page N to `KeyMarker/VersionIdMarker` on page N+1, but never bound the continuation to the last version actually returned on page N. A fabricated cursor, echoed consistently on the next page, could pass the model even when the version list appeared otherwise complete.

## Draft-only change
`api/tests/fixtures/gdprB2S3VersionPaginationSynthetic.js` now requires that each truncated, delete-marker-free normalized page continue from the exact `Key` and `VersionId` of its last returned version. The regression `api/tests/gdprB2S3VersionPaginationSynthetic.test.js` covers a fabricated key+version pair, a rewind to an earlier returned entry and a changed version ID, all echoed by the following page. The existing GitHub Actions B2/PG17 workflow executes this test file.

This requirement is **only a property of the normalized synthetic model**, not a blanket claim that every S3-compatible provider uses identical pagination semantics in every configuration. An independently reviewed real B2 adapter must validate its documented marker semantics, enumerate all pages and historical versions with a read-only, scoped credential, and compare an external durable witness. The simulated response cannot attest actual completeness, provenance, COMPLIANCE retention or absence of missing historical versions.

## Safety and release gate
No B2 request, real credentials, personal data, production SQL, deploy, merge or restore. PR #374 stays Draft; issue #296 stays OPEN; recovery stays **NO-GO** until independent journal integrity/completeness, isolation and restore evidence is verified. A passing CI test is not a production recovery attestation.
