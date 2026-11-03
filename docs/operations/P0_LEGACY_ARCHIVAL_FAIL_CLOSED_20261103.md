# DEMOS — Legacy archival verification gap: retirement on isolated PR #580

On 2026-11-03 a code review of the integrated P0 work found **three
additional legacy entrypoints** not covered by the original 12 Neon→Axiom
CLI retirement checks.

| Entrypoint | What was still executable | Failure mode |
| --- | --- | --- |
| `scripts/data-archival-strategy.js` | Direct `runArchival()` or imported `archiveOldData()` | `uploadToArchive()` **simulates an upload** and fabricates a receipt, while `deleteExpiredData()` executes SQL `DELETE` without a verified restore |
| `scripts/hard-disk-export.js` | CLI `export --delete` or imported `exportToHardDisk({deleteAfterExport:true})` | Export-to-disk scripts could delete DB rows without a verified, independently restorable copy |
| `scripts/automated-archival.js` | CLI `start` cron / `immediate` / imported scheduler methods | Old cron runner could reach archival functions outside the routes retired in #579 |

## Mitigation
- A new unconditional, non-configurable gate
  `api/services/legacyDataArchivalGate.js` blocks these three CLIs
  **before importing PostgreSQL, dotenv, or cron**, returning exit 78.
- The exported methods `exportToHardDisk`, `archiveOldData`,
  `runArchival`, `startAutomatedArchival`, `testArchival` and
  `runImmediateArchival` also reject immediately, even when imported.
- New synthetic Node test validates CLI arguments, no database queries,
  no cron scheduling, and no secret leakage; runs in the composite P0
  workflow and the focused Ops Admin workflow.
- **This guard does not touch the separately implemented Axiom→B2
  archiving, normal error logging, retention policies or backups.**
- Previous source code is preserved in Git history: this is a code-level
  fail-closed fix, not proof that cron jobs running outside this
  repository have been disabled, nor evidence of secret rotation.

The legacy README describes a historical procedure, **not** an approved
2026 operational runbook. Any re-enablement requires a new implementation
with a verified archive receipt, independent restore verification,
documented retention/DPO review and separate technical/release GO.

No database, cloud provider or deployment changed. PR #580 remains
**DRAFT / NO-GO**.


## Hybrid cloud legacy commands — additional safety check (2026-11-03)

The audit found another command family in `scripts/hybrid-cloud-backup.js`
still executable after the initial `cleanup` retirement:

- `backup` (also the default command) exported historical database logs to
  B2/S3/GCS without an independent read-back, digest/receipt verification
  or recovery test; the temporary export directory could be removed after
  partial uploads, while the script still printed a success summary.
- `check` and `stats` invoked the old external provider CLI and could
  incorrectly treat provider failures as zero stored objects.
- Imported `dailyBackup`, `checkExportNeeded` and `getCloudStorageSize`
  were callable even when the destructive `cleanup` method was blocked.

**Draft-only fix:** the CLI now refuses *all* invocations with exit 78
before importing database/environment/provider libraries. All four publicly
exported methods reject with `LEGACY_DATA_ARCHIVAL_RETIRED` before any
database query or cloud CLI call. No bypass is configured. Test
`legacy hybrid cloud backup, inventory and cleanup all fail closed`
covers the default, four explicit modes and imported methods with synthetic
dependencies. This change does **not** alter the modern
`api/services/axiomArchiveService.js` Axiom-to-B2 archiver.

The former implementation remains in Git history to support technical
review but is **not** a validated backup. An external scheduler running an
older deployed copy could still invoke it; runtime inventory and migration
of legitimate backup obligations are required before integrating this Draft.

**Release verdict: NO-GO** for GH-296 and for restore dependent on B2
until actual provider versioning, Object Lock, independently verified
GET/hash, SQL snapshot-to-journal binding, quarantined replay and DPO
approval are evidenced. No provider access, backup operation, deploy,
merge, production data, destructive action or paid resource was used.


## Direct retention service bypass and unbounded user-notification inventory (2026-11-03)

**RP-10 already protected the HTTP Admin write actions and disabled the normal startup
scheduler, but did not protect imported methods.** An old worker or script
could still call:
- `DataRetentionService.deleteExpiredData`, `deleteAllExpiredData` or
  `performFullCleanup`: dynamic `UPDATE users SET ... = NULL` over an old
  seven-policy list, including sensitive political preferences; SQL columns
  and legal bases are not confirmed against the current schema.
- `dataRetentionJob.start`, `performDailyCleanup`, `performImmediateCleanup`:
  direct scheduling and cleanup outside the HTTP handler.
- `DataRetentionService.sendRetentionNotifications` and
  `dataRetentionJob.sendWeeklyNotifications`: the legacy function **does not
  send notices**; it runs up to seven unbounded
  `SELECT id,email,nome,cognome FROM users` scans and collects account IDs
  in memory, potentially exposing large volumes of PII to the Admin GET.

**Draft-only mitigation:** new unconditional `RETENTION_LEGACY_CLEANUP_RETIRED`
guard in three destructive service methods, the notifications method, and
the four imported job methods (`start`, `performDailyCleanup`,
`performImmediateCleanup`, `sendWeeklyNotifications`), before SQL, audit,
or timers. GET `/api/admin/data-retention/notifications` is now
410/no-store after normal authentication and Admin authorization.
The read-only `/policies` response explicitly returns
`policy_status: legacy_unreviewed`, `automated_cleanup_enabled: false`,
and `valid_legal_basis_confirmed: false`. Admin stop/status remain available.

**Regression:** synthetic faked DB/audit dependencies throw on contact; tests
verify zero queries, audit writes or timers from every blocked function.
HTTP contract checks anonymous 401, non-Admin 403, Admin 410/no-store for
the notifications endpoint and the policy status metadata.

**Legal and recovery limits:** historical defaults of five years for
political opinions or seven years for generic user profiles and audit
logs are **not** validated GDPR retention periods and should not be
automatically justified by ordinary accounting records rules.
Retention needs per-purpose documentation, current SQL schema mapping,
lawful deletion mechanisms, data-subject rights, backup constraints,
and DPO/controller approval. Retiring this legacy pathway does not
implement a correctly approved periodic cleanup.
Independent B2/SQL restore and erasure replay stay NO-GO under GH-296.

No production data, credentials, provider resources, staging, account
records, merge, deployment or paid resource are changed.


## Legacy application backup helpers and status secret redaction (2026-11-03)

The Admin legacy backup endpoints for list, create, restore, cleanup and
config already returned 410. A deeper audit found two residual flaws:

1. Imported `BackupService` methods such as `exportAllData`,
   `exportIncrementalData`, `insertRecords`, `getBackupList`,
   `verifyBackupIntegrity`, `cleanupOldBackups` and `logBackupOperation`
   still operated directly on SQL, local backup files or audit actions.
   In particular, `exportAllData` could read entire users, votes and
   privacy tables, while `cleanupOldBackups` could unlink local archives.
2. The remaining Admin `GET /api/admin/backup/job/status` returned
   `backupJob.getStatus().config`, which embedded the raw
   `BACKUP_ENCRYPTION_KEY` from `getBackupConfig`. The separate
   `/config` route was retired, but status was not redacted.

**Draft-only mitigation:** all 11 direct I/O-capable legacy
`BackupService` helpers fail closed with `LEGACY_APP_BACKUP_RETIRED`
before database, filesystem or audit operations. The seven
corresponding executable `BackupJob` operations (including direct
backup, cleanup, integrity test and system notifications) also reject
before side effects. `BackupJob.start` was already retired.
`backupJob.getStatus()` remains readable to Admin but now masks
the key value as `***HIDDEN***` (or null when unset); `stop()` remains
available. Configuration inspection from the job status remains
historical/read-only and is not evidence that backup is running.

**CI regression:** faked PostgreSQL pool, filesystem and notification
sender all throw on access; test checks zero side effects on imported
methods and verifies the serialized status does not contain a synthetic
encryption secret. Test reports no conclusion about real provider B2.

Modern PostgreSQL/provider backup and Axiom-to-B2 archiving were not
modified. Before any release, review externally deployed schedulers
and the GDPR backup/restore policy separately. GH-296 stays NO-GO.
No merge, deployment, account read, provider request or real data
mutation was performed.
