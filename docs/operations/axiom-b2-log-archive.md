# Axiom -> Backblaze B2 historical log archive

Status (verified on Render 2026-10-21): **active in production**, not pending activation. The DEMOS backend logs show hourly archive completions since at least 2026-10-20. The B2 credentials are not stored in the repository. This does **not** yet prove an independently verified download/restore; the new read-only check described below is needed.

## Purpose

Axiom remains the operational/read-query system for recent DEMOS logs. Backblaze B2 is the low-cost historical archive. The archive copies data out of Axiom; it never deletes from Axiom and it does not change the existing logging path.

The design intentionally does **not** encode a generic "GDPR = 7 years" retention rule. Retention must remain differentiated by log purpose and approved separately. Objects are already separated into `technical`, `audit`, and `security` prefixes so B2 lifecycle rules can later be applied independently.

## Safety properties

- Fail-closed in code unless `AXIOM_ARCHIVE_ENABLED=true`. **The current production service has this feature active according to its startup and hourly completion logs. Do not toggle/reset it on the assumption that it is disabled.**
- Requires explicit Axiom query credentials and explicit B2 S3-compatible credentials.
- Uses an EU B2 endpoint/region supplied through environment variables; nothing is hard-coded.
- Writes gzip-compressed JSON Lines (`.jsonl.gz`).
- Requests Backblaze-managed AES-256 server-side encryption (`SSE-B2` / `AES256`) for every uploaded object.
- Stores no user identifiers or PII in bucket names, object keys, or object metadata.
- Verifies each upload with `HEAD`: compressed byte length and a SHA-256 value stored in metadata must match before progress is committed.
- Advances the checkpoint only after all data objects and the manifest for a dataset were uploaded and verified.
- Uses a B2-resident checkpoint, so Render/local ephemeral disks are not relied on for progress state.
- On resume, checks the checkpoint's B2 SHA-256 metadata against the downloaded bytes and validates the dataset/manifest reference **before** using its date cursor. Corrupted, mismatched or untrusted checkpoints fail closed: the archiver does not advance or silently skip events. This is an integrity check against accidental corruption, not proof of cryptographic authenticity against a party who can replace both content and metadata.
- Processes backfills in bounded chunks and advances the checkpoint after every successful chunk, limiting memory usage and restart cost.
- Re-reads an overlap window on every run to catch late-arriving events.
- Gives every archived event a deterministic SHA-256 fingerprint. For eligible replayed audit/security events with a valid `axiom_delivery_id` UUID, the fingerprint is derived from dataset + delivery UUID, rather than Axiom per-ingestion metadata. Restore/import tooling can deduplicate overlaps using `archive_event_id`.
- Retries of the same archive chunk are idempotent at the data-object key level; the envelope uses the deterministic chunk end rather than wall-clock retry time.
- Recursively splits saturated Axiom query windows instead of silently accepting a result that may have been truncated.
- If a query is still saturated at the minimum window size, the run fails and the checkpoint does not advance.

## Source datasets

Default source datasets:

- `AXIOM_DATASET` (currently `centralized_logs`)
- `AXIOM_REALTIME_DATASET` (currently `real-time`)

They can be overridden with `AXIOM_ARCHIVE_DATASETS`.

Records are generally archived without modifying the event body. **Exception:** eligible audit/security events carrying a valid `axiom_delivery_id` are canonically normalized before archival: ingestion-only Axiom metadata `_id` and `_sysTime` is removed, and the UUID is lowercased so retries cannot create distinct stored events. Partitioning now prioritizes explicit `log_type=security|audit` and legacy `securityEvent|auditEvent` flags, then pre-existing `type`+`severity` and `action`+`resource` shapes, and finally known message prefixes for legacy security/audit records. Other events remain `technical`.

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

`archive_event_id` is SHA-256 over the source dataset and canonical serialization for ordinary/legacy events. For a valid `axiom_delivery_id` on explicitly tagged audit/security events, it instead hashes dataset + a fixed `axiom-delivery` label + normalized UUID. Different events with the same UUID and conflicting canonicalized content cause archival to **fail without advancing the checkpoint**, rather than silently dropping either event. This deduplicates events within each fetched archive window; the same ID may still exist in physically separate overlapping objects. Consumers restoring multiple objects must deduplicate by `archive_event_id`. This is not deduplication inside Axiom itself.

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

Production bucket created on 2026-10-06: `demos-log-archive-eu` in EU Central, private, encryption enabled, Object Lock disabled. S3 endpoint: `https://s3.eu-central-003.backblazeb2.com`.  Use the exact S3 endpoint and region shown in the bucket details, for example the documented endpoint pattern:

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

## Read-only recovery drill: last committed batch

After obtaining authorized access to the existing Render runtime environment (or an isolated environment with the **same restricted read credentials**), run:

```bash
cd api
npm run archive:axiom:verify-latest -- centralized_logs
npm run archive:axiom:verify-latest -- real-time
```

This command **does not** execute Axiom queries or PUT/DELETE B2 objects, does not advance checkpoints and does not print raw events. **New safety limit:** before reading each checkpoint, manifest or data object it calls B2 `HEAD` and refuses compressed objects over **8 MiB**; the subsequent GET is range-limited and streamed with a strict byte count. Gzip expansion is capped at **32 MiB**, and verification refuses over **60,000 records per object**. These limits prevent unexpectedly large downloads and decompression bombs during a recovery drill; historically larger objects require a separately approved, bounded recovery procedure. The production restore has still **not** been performed. It reads the latest checkpoint from B2, downloads the linked manifest, verifies both SHA-256 values, downloads each referenced compressed data object, checks its hash and event fingerprint, decompresses it and verifies counts. It prints the checkpoint time, category totals and verified object counts. A no-data batch is valid and has an empty object list.

A successful result is evidence of recoverability **for the latest archived batch only**, not a guarantee that the full historical archive or every retention class is complete. The production execution has not yet been performed as of 2026-10-21.

## Read-only cross-object overlap reconciliation (new)

For an incident drill where **two or more data object keys** from the same
dataset may overlap, use an authorized environment with restricted B2 read
credentials. Supply **the actual keys from existing manifests**; do not guess
or modify object names:

```bash
cd api
npm run archive:axiom:verify-overlap -- real-time \
  "demos/axiom-archive/v1/data/audit/year=2026/month=10/day=21/real-time/<first-object>.jsonl.gz" \
  "demos/axiom-archive/v1/data/audit/year=2026/month=10/day=21/real-time/<second-object>.jsonl.gz"
```

The bracketed names above are **placeholders**, not known B2 keys. The command
rejects invalid paths and requires 2–12 distinct data-object keys of the
same dataset; it performs **GET only**, validates compressed SHA-256 metadata,
decompresses up to 32 MiB per object, validates each event's fingerprint,
reconciles duplicated `archive_event_id` values **across objects**, and fails
if the same ID has incompatible event payloads or categories. It first checks object size and integrity metadata with a read-only **HEAD**
request, refuses objects larger than **8 MiB before downloading them**, then
uses a byte-range-limited GET and bounded streaming to prevent unexpectedly
large transfers. It prints only
the counts `objectsExamined`, `recordsExamined`, `uniqueEvents`,
`duplicateCopies` and aggregate categories. It does **not** print
identifying events, write a merged archive, perform PUT/DELETE operations or
alter checkpoints. At most 60,000 events are examined per invocation;
larger audits require a carefully scoped multi-batch plan.

These are **reconciliation statistics for selected objects**, not proof of
global deduplication across all historical files. Neither Axiom query results
nor data already present in separate B2 objects are physically removed.
This CLI has synthetic tests only until restricted credentials are made
available in an isolated authorized environment. Confirm the operator's
authority and the scope before querying B2.

## Production verification and continuity checklist

1. **Do not create a second archive job, reset checkpoints, or re-enable a feature that is already active.** Preserve the existing hourly job on Render.
2. Validate real B2 access in the authorized service environment without printing secrets.
3. Run the read-only restore drill below separately for `centralized_logs` and `real-time`; it must verify checkpoint, manifest, object hashes, gzip restoration, event fingerprints and counts.
4. Verify restoration periodically, especially after SDK/configuration changes. Alert independently if B2 is unavailable, a hash fails, or the last checkpoint is stale.
5. Review the B2 object's real lifecycle configuration and retention before activating any deletion policy. Retention must be approved by the privacy/DPIA owner per event category.
6. Keep the archive job decoupled from reliable *source* audit delivery: an outbox/retry mechanism is still needed for audit events that fail to reach Axiom in the first place.

## Files

- `api/services/axiomArchiveService.js` - query, deduplication, gzip, B2 upload, manifest/checkpoint, integrity verification.
- `api/jobs/axiomArchiveJob.js` - guarded cron scheduler and single-run mutex.
- `api/scripts/run-axiom-archive.js` - one-shot archive runner.
- `api/scripts/verify-axiom-archive-object.js` - restore/integrity verifier for one object.
- `api/tests/axiomArchiveService.test.js` - local tests with no live credentials.
