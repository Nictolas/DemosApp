# DEMOS retention matrix — verified technical state (2026-10-14)

This document records the observed technical behavior of `main` and the production runtime. It is **not** a legal opinion and must be used as the factual baseline before changing Privacy Policy, GDPR export text or Google Play Data Safety declarations.

## Production facts verified on 2026-10-14

- Canonical account deletion is `DELETE /api/user/delete-account` and delegates to `PrivacyErasureLedgerService.enforceAccountDeletion`.
- The production data-retention scheduler is **not running**. Render logs report `Job di data retention non in esecuzione`.
- Axiom is active in production. Render startup logs report `Axiom archive job enabled (17 * * * * UTC)`.
- Historical Axiom→B2 runs on 7, 12 and 13 October used 24 × 15-minute chunks per dataset, archived 0 records and remained `caughtUp:false`; the backlog grew because each run could recover only about six source-hours while the Render Free web process did not reliably stay awake for every hourly cron.
- On 14 October 2026 the existing worker was accelerated **without adding a new Render service or paid scheduler** by setting `AXIOM_ARCHIVE_CHUNK_MINUTES=360`, `AXIOM_ARCHIVE_MAX_WINDOW_MINUTES=360` and `AXIOM_ARCHIVE_RUN_ON_START=true` on production. Production remained on `main` commit `58edd586`.
- Controlled run-on-start qualification reduced the backlog approximately `30.65d → 24.70d → 18.71d → 12.72d → 6.72d → 17.5h → 0`.
- Real source records were reached and archived: one run produced `centralized_logs count=20` and `real-time count=1`; a later run produced 21 more `centralized_logs` records; the final run produced 12 more `centralized_logs` records.
- Final deploy `dep-db7mvpqj9qps73d1bbp0` returned `caughtUp:true` and `remainingMs:0` for both `centralized_logs` and `real-time`. This qualifies source query/dataset names, checkpoint progression and the B2 archive path through the current source state.
- Scheduling remains a separate limitation: the in-process cron is not reliable on Render Free during spin-down. Runtime evidence showed a scheduled 11:17Z run was not executed after the service received SIGTERM and stopped. `AXIOM_ARCHIVE_RUN_ON_START=true` helps on cold start but is not a reliable scheduler by itself.
- PR DRAFT #153 proposes, but does not activate, a GitHub Actions wakeup every six hours. Because the repository is private, Actions minutes/budget must be checked before any merge. No paid Render Cron Job has been created.
- Repository documentation says B2 lifecycle retention for `technical`, `audit` and `security` is still to be defined/approved.
- Dedicated follow-up: GitHub issue #147 (`Axiom→B2 catch-up qualified; scheduling reliability and lifecycle remain`).

## Canonical matrix

| Category | Primary storage / code | Account deletion behavior | Periodic retention actually verified | Residual / exception | Status |
|---|---|---|---|---|---|
| User account/profile | `users`, `user_profile`, related direct links | User row and many account-linked rows are deleted by `PrivacyErasureLedgerService` | No production automatic expiry verified | None should be claimed beyond explicit provider/legal exceptions | VERIFIED FOR ACCOUNT DELETION |
| Political opinions and civic votes linked to the user | `opinioni_risposte`, known `voti_*`, consent tables and related account links | Known user-linked rows are deleted schema-aware during account deletion; political-consent revocation also deletes opinions | No production 5-year automatic deletion verified | Some aggregate/anonymous outputs may survive if no longer personal data | VERIFIED FOR ACCOUNT DELETION; PERIODIC RETENTION NOT VERIFIED |
| Communications / reactions / supporter relations | `comunicazioni`, `reazioni`, `sostenitori`, related notification tables | User-authored rows and direct social links are deleted/unlinked during account deletion | No independent periodic retention verified | Read arrays are unlinked rather than deleting unrelated communications | VERIFIED FOR ACCOUNT DELETION |
| Auth providers / identity verification | `user_auth_providers`, `identity_verifications`, session infrastructure | Direct provider links and pseudonymous CIE verification link are deleted with the account | Session token lifetime is separate from data-retention policy | Server-side session/revocation records must be assessed separately | VERIFIED FOR ACCOUNT DELETION |
| Local audit logs | `audit_logs` / `AuditService` | Deleted for the user only when `AXIOM_ENABLED !== 'true'` | Legacy cleanup code contains 365-day local cleanup logic, but production Axiom path bypasses local deletion | Production uses Axiom, so provider retention controls the effective log history | PROVIDER-DEPENDENT |
| Axiom logs | Axiom datasets | Canonical account deletion does not delete provider records | Axiom is confirmed active; exact provider retention was not independently read from provider configuration | Current repository comments claiming a fixed legal retention are not sufficient evidence | ACTIVE; RETENTION UNVERIFIED |
| Axiom → Backblaze B2 archive | `axiomArchiveJob`, `axiomArchiveService` | No per-user deletion path verified in the archive | Production catch-up reached `caughtUp:true` / `remainingMs:0` for both datasets and archived real records from populated windows | Scheduling reliability on Render Free remains limited; provider retention and approved B2 lifecycle rules remain separate gaps | ARCHIVE PATH QUALIFIED; SCHEDULING/LIFECYCLE OPEN |
| Privacy erasure ledger | `privacy_erasure_ledger` | Intentionally retained across account deletion because it is written before cleanup and is not deleted by `enforceAccountDeletion` | No TTL/retention rule exists in the service | Stores `subject_user_id` in clear text. Repository search found no external consumer/lookup requiring that clear identifier; a versioned keyed-HMAC pseudonym is technically plausible but not yet implemented | RETAINED; RETENTION/MINIMIZATION GAP |
| Automatic retention engine | `DataRetentionService`, `dataRetentionJob` | Separate from account deletion | Production scheduler is not running | Service applies multiple conceptual categories through `UPDATE users`, including categories whose real data lives elsewhere; it must not be treated as authoritative retention enforcement | NOT AUTHORITATIVE / DISABLED IN PROD |

## Consequences for public text

Until the remaining gaps are resolved, public documentation should **not** claim that DEMOS automatically deletes profile data after 7 years, political votes/opinions after 5 years, or audit logs after 7 years as an implemented production mechanism.

A technically accurate interim description is:

- account-linked personal data is deleted through the canonical account-deletion flow;
- limited records may be retained where technically or legally necessary, including privacy-erasure evidence and security/audit provider data;
- exact retention for external log/archive providers must follow verified provider configuration and an approved retention decision;
- anonymous or genuinely aggregated statistics may remain when they are no longer personal data.

## Remaining decisions before closing #141

1. Decide and implement the minimization model for `privacy_erasure_ledger.subject_user_id`. Current code evidence does not show a runtime lookup dependency on the clear identifier; prefer a versioned keyed pseudonym (for example HMAC-SHA256 with a dedicated secret) if replay/idempotency requirements remain satisfied.
2. Set an explicit ledger retention period and deletion/rotation procedure.
3. Verify the actual Axiom dataset retention from provider configuration.
4. Define a reliable Axiom→B2 scheduling strategy compatible with approved cost constraints. Do not treat the in-process Render Free cron as reliable; PR #153 is only a DRAFT proposal and must not be merged before Actions quota/budget is checked.
5. Define B2 lifecycle rules separately for `technical`, `audit` and `security`.
6. Repair or retire `DataRetentionService` so it cannot be presented as an implemented multi-table retention engine while it only updates `users`.
7. Only after 1–6, align `PrivacyPolicy.tsx`, GDPR export metadata, `eliminazione-account.html`, internal retention docs and Google Play Data Safety.

## Evidence paths

- `api/routes/user/delete-account.js`
- `api/services/privacyErasureLedgerService.js`
- `api/services/dataRetentionService.js`
- `api/jobs/dataRetentionJob.js`
- `api/jobs/axiomArchiveJob.js`
- `api/services/axiomArchiveService.js`
- `api/services/centralizedLogger.js`
- `api/services/auditService.js`
- `api/routes/user/gdpr-rights.js`
- `client/src/pages/PrivacyPolicy.tsx`
- `docs/operations/axiom-b2-log-archive.md`
- `CONFIGURAZIONE_LOG_PRODUZIONE.md`
- GitHub issue #147
- GitHub PR #153
