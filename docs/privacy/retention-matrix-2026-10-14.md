# DEMOS retention matrix — verified technical state (2026-10-14)

This document records the observed technical behavior of `main` and the production runtime. It is **not** a legal opinion and must be used as the factual baseline before changing Privacy Policy, GDPR export text or Google Play Data Safety declarations.

## Production facts verified on 2026-10-14

- Canonical account deletion is `DELETE /api/user/delete-account` and delegates to `PrivacyErasureLedgerService.enforceAccountDeletion`.
- The production data-retention scheduler is **not running**. Render logs report `Job di data retention non in esecuzione`.
- Axiom is active in production. Render startup logs report `Axiom archive job enabled (17 * * * * UTC)`.
- The Axiom→B2 job completed observed production runs on 7, 12 and 13 October 2026 with no matching `Axiom archive failed` entries in the inspected window. Those runs used 24 × 15-minute chunks per dataset, archived 0 records and remained `caughtUp:false`; the backlog grew because each run could recover only about six source-hours while the Render Free web process did not reliably stay awake for every hourly cron.
- On 14 October 2026 the existing worker was accelerated **without adding a new service or paid scheduler** by setting `AXIOM_ARCHIVE_CHUNK_MINUTES=360`, `AXIOM_ARCHIVE_MAX_WINDOW_MINUTES=360` and `AXIOM_ARCHIVE_RUN_ON_START=true` on production Render. Deploy `dep-db7ll5favr4c738n2m5g` reached LIVE on `main` commit `58edd586`.
- The first post-change run completed without error for both `centralized_logs` and `real-time`: 24 chunks per dataset, `count:0`, `remainingMs:2648279446` (~30.65 days). The backlog immediately before that run was about 36.6 days, so one execution recovered about six days of source time as designed. Observed load remained low (~0.03 CPU core, ~100 MB memory).
- Static code verification confirms the production loggers actually ingest into `centralized_logs` and `real-time`, and both emit `_time` as an ISO timestamp. This makes dataset-name/timestamp mismatch substantially less likely; `count:0` still requires verification against a recent Axiom window known to contain data and against the provider’s actual retention.
- Repository documentation says B2 lifecycle retention for `technical`, `audit` and `security` is still to be defined/approved.
- Dedicated follow-up: GitHub issue #147 (`Axiom→B2 archive does not catch up and archives 0 records`).

## Canonical matrix

| Category | Primary storage / code | Account deletion behavior | Periodic retention actually verified | Residual / exception | Status |
|---|---|---|---|---|---|
| User account/profile | `users`, `user_profile`, related direct links | User row and many account-linked rows are deleted by `PrivacyErasureLedgerService` | No production automatic expiry verified | None should be claimed beyond explicit provider/legal exceptions | VERIFIED FOR ACCOUNT DELETION |
| Political opinions and civic votes linked to the user | `opinioni_risposte`, known `voti_*`, consent tables and related account links | Known user-linked rows are deleted schema-aware during account deletion; political-consent revocation also deletes opinions | No production 5-year automatic deletion verified | Some aggregate/anonymous outputs may survive if no longer personal data | VERIFIED FOR ACCOUNT DELETION; PERIODIC RETENTION NOT VERIFIED |
| Communications / reactions / supporter relations | `comunicazioni`, `reazioni`, `sostenitori`, related notification tables | User-authored rows and direct social links are deleted/unlinked during account deletion | No independent periodic retention verified | Read arrays are unlinked rather than deleting unrelated communications | VERIFIED FOR ACCOUNT DELETION |
| Auth providers / identity verification | `user_auth_providers`, `identity_verifications`, session infrastructure | Direct provider links and pseudonymous CIE verification link are deleted with the account | Session token lifetime is separate from data-retention policy | Server-side session/revocation records must be assessed separately | VERIFIED FOR ACCOUNT DELETION |
| Local audit logs | `audit_logs` / `AuditService` | Deleted for the user only when `AXIOM_ENABLED !== 'true'` | Legacy cleanup code contains 365-day local cleanup logic, but production Axiom path bypasses local deletion | Production uses Axiom, so provider retention controls the effective log history | PROVIDER-DEPENDENT |
| Axiom logs | Axiom datasets | Canonical account deletion does not delete provider records | Axiom is confirmed active; exact provider retention was not independently read from provider configuration | Current repository comments claiming a fixed legal retention are not sufficient evidence | ACTIVE; RETENTION UNVERIFIED |
| Axiom → Backblaze B2 archive | `axiomArchiveJob`, `axiomArchiveService` | No per-user deletion path verified in the archive | Archive is executable and checkpoint progress is now demonstrated: first accelerated run recovered ~6 days and reduced backlog to ~30.65 days | Still need a recent known-populated Axiom window, consecutive decreasing backlog or `caughtUp:true`, and approved B2 lifecycle rules | CATCH-UP PROGRESS VERIFIED; #147 OPEN |
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
4. Resolve #147: keep catch-up demonstrably progressing, verify a recent source window known to contain events, and reach `caughtUp:true` or equivalent qualified state. Do not create a paid scheduler without explicit approval.
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
