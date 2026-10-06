# Axiom -> Backblaze B2 historical log archive

Status: implemented locally behind a fail-closed feature flag. Backblaze account created on 2026-10-06 in EU Central; private bucket, restricted application key and production activation are still pending. No production deployment or B2 credentials are included in the repository.

## Purpose

Axiom remains the operational/read-query system for recent DEMOS logs. Backblaze B2 is the low-cost historical archive. The archive copies data out of Axiom; it never deletes from Axiom and it does not change the existing logging path.

The design intentionally does **not** encode a generic "GDPR = 7 years" retention rule. Retention must remain differentiated by log purpose and approved separately. Objects are already separated into `technical`, `audit`, and `security` prefixes so B2 lifecycle rules can later be applied independently.

## Safety properties

- Disabled unless `AXIOM_ARCHIVE_ENABLED=true`.
- Requires explicit Axiom query credentials and explicit B2 S3-compatible credentials.
- Uses an EU B2 endpoint/region supplied through environment variables; nothing is hard-coded.
- Writes gzip-compressed JSON Lines (`.jsonl.gz`).
- Requests Backblaze-managed AES-256 server-side encryption (`SSE-B2` / `AES256`) for every uploaded object.
- Stores no user identifiers or PII in bucket names, object keys, or object metadata.
- Verifies each upload with `HEAD`: compressed byte length and a SHA-256 value stored in metadata must match before progress is committed.
- Advances the checkpoint only after all data objects and the manifest for a dataset were uploaded and verified.
- Uses a B2-resident checkpoint, so Render/local ephemeral disks are not relied on for progress state.
- Processes backfills in bounded chunks and advances the checkpoint after every successful chunk, limiting memory usage and restart cost.
- Re-reads an overlap window on every run to catch late-arriving events.
- Gives every archived event a deterministic SHA-256 fingerprint; restore/import tooling can deduplicate overlaps safely.
- Retries of the same archive chunk are idempotent at the data-object key level; the envelope uses the deterministic chunk end rather than wall-clock retry time.
- Recursively splits saturated Axiom query windows instead of silently accepting a result that may have been truncated.
- If a query is still saturated at the minimum window size, the run fails and the checkpoint does not advance.

## Source datasets

Default source datasets:

- `AXIOM_DATASET` (currently `centralized_logs`)
- `AXIOM_REALTIME_DATASET` (currently `real-time`)

They can be overridden with `AXIOM_ARCHIVE_DATASETS`.

Records are archived without modifying the event body. For storage/lifecycle partitioning only:

- record with `type` + `severity` -> `security`
- record with `action` + `resource` -> `audit`
- everything else -> `technical`

This matches the field shapes currently emitted by the DEMOS Axiom writers. The original source dataset is retained in every archive envelope.

## B2 object layout

```text
<AXIOM_ARCHIVE_PREFIX>/
  control/
    centralized_logs.json
    real-time.json
  manifests/
    year=YYYY/month=MM/day=DD/<dataset>/<end>_<hash>.json
  data/
    technical/year=YYYY/month=MM/day=DD/<dataset>/<start>_<end>_<hash>.jsonl.gz
    audit/year=YYYY/month=MM/day=DD/<dataset>/<start>_<end>_<hash>.jsonl.gz
    security/year=YYYY/month=MM/day=DD/<dataset>/<start>_<end>_<hash>.jsonl.gz
```

A data line is an envelope:

```json
{
  "archive_event_id": "sha256...",
  "source_dataset": "real-time",
  "category": "security",
  "event_time": "2026-10-06T12:34:56.000Z",
  "archived_at": "2026-10-06T13:00:00.000Z",
  "event": {}
}
```

`archive_event_id` is SHA-256 over the source dataset and a canonical serialization of the original event.

## Scheduling

The application job is loaded only when `AXIOM_ARCHIVE_ENABLED=true`.

Default cron:

```text
17 * * * *
```

This means once per hour at minute 17, UTC. `AXIOM_ARCHIVE_RUN_ON_START=false` prevents an unplanned backfill every time a service boots.

## Initial backfill

When there is no checkpoint, the service starts from `AXIOM_ARCHIVE_INITIAL_LOOKBACK_HOURS` before the safe archive end time. The example value is `720` hours (30 days), matching the historical design target, but the first production run must set this deliberately based on the retention still present in Axiom and expected query volume.

The normal steady-state settings use:

- 5 minute overlap (`AXIOM_ARCHIVE_OVERLAP_SECONDS=300`)
- 2 minute safety lag (`AXIOM_ARCHIVE_SAFETY_LAG_SECONDS=120`)
- 15 minute archive chunks
- at most 24 chunks per scheduled run by default (6 hours of source time)
- 15 minute maximum base query windows
- adaptive recursive splitting at the query limit

## Backblaze setup requirements

Create a **private** Backblaze B2 bucket in an EU region. Use the exact S3 endpoint and region shown in the bucket details, for example the documented endpoint pattern:

```text
https://s3.<region>.backblazeb2.com
```

Create a dedicated application key restricted to this archive bucket (and, when possible, the archive prefix) with only the object read/write permissions required by `GET`, `PUT`, and `HEAD`. Do not grant delete capability to the runtime archive key.

Required runtime variables:

```text
B2_S3_ENDPOINT
B2_S3_REGION
B2_BUCKET_NAME
B2_S3_ACCESS_KEY_ID
B2_S3_SECRET_ACCESS_KEY
```

Never commit real values.

Backblaze documents that the S3-compatible API works with AWS SDK for JavaScript v3 and that SSE-B2 uses AES-256. The implementation uses `@aws-sdk/client-s3` with a custom B2 endpoint and explicitly requests `AES256` on uploads.

## Local commands

Run unit/integration-style tests with in-memory fake Axiom/B2 clients:

```bash
npm run test:axiom-archive
```

Run a single real archive iteration after environment variables are intentionally configured:

```bash
npm run archive:axiom
```

Verify/download/decompress an archived object and re-check every event fingerprint:

```bash
npm run archive:axiom:verify -- "demos/axiom-archive/v1/data/...jsonl.gz"
```

## Production rollout checklist

1. Merge only after tests/lint/security checks pass.
2. Create the private EU B2 bucket.
3. Enable/confirm B2 server-side encryption.
4. Create a dedicated restricted application key; no delete permission.
5. Add B2 secrets only in the deployment secret store.
6. Keep `AXIOM_ARCHIVE_ENABLED=false` during configuration.
7. Run one controlled one-shot archive with a short initial lookback.
8. Verify the uploaded `.jsonl.gz` object with `archive:axiom:verify`.
9. Increase the initial backfill horizon deliberately and complete the available Axiom history.
10. Set the steady-state hourly schedule and enable the job.
11. Define B2 lifecycle rules separately for `technical`, `audit`, and `security` only after retention periods are approved.
12. Perform a periodic restore/integrity drill; do not rely only on successful uploads.

## Files

- `api/services/axiomArchiveService.js` - query, deduplication, gzip, B2 upload, manifest/checkpoint, integrity verification.
- `api/jobs/axiomArchiveJob.js` - guarded cron scheduler and single-run mutex.
- `api/scripts/run-axiom-archive.js` - one-shot archive runner.
- `api/scripts/verify-axiom-archive-object.js` - restore/integrity verifier for one object.
- `api/tests/axiomArchiveService.test.js` - local tests with no live credentials.
