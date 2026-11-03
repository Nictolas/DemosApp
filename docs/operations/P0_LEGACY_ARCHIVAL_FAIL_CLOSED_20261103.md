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
