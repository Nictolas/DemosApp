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
