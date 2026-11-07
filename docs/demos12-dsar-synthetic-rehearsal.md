# DEMOS 12 — DSAR synthetic rehearsal (draft, not executed)

Status: **DRAFT / NO-GO**. Scope: PR #502 only. This document is a test plan, not evidence of a completed DSAR, legal approval, or a deployed process.

## Preconditions
- Use an isolated, disposable PostgreSQL 17 database and synthetic UUIDs, names and HTTPS example.org URLs only.
- Run against the exact checked-out PR commit, recording its full SHA and the test command/output.
- Do not use DEMOS production, DEMOS10 unified staging, real profiles, real email addresses, or real notifications.
- Keep feature flags off in deployed environments. If a local test needs a flag, enable it only in the disposable process and record it.
- Verify migrations and route contracts on the disposable database; stop if the schema is incompatible.

## Scenario A — request from a proposer
1. Create synthetic users A (proposer), B (different authenticated user), and an Admin in the isolated database.
2. Create a pending proposal owned by A and an approved proposal with an unrelated synthetic title.
3. Verify B cannot read A's private proposal, obtain A's proposer UUID through the Admin list, or change either proposal.
4. Simulate A's account erasure through the canonical application service. Assert pending/rejected proposals are deleted, while approved/withdrawn records are detached from A only when the schema contract allows it; assert the public response remains minimized.
5. Verify no identifying proposer information survives in public directory payloads, nested JSONB, API errors, notifications or test logs.

## Scenario B — request from the person named by a third party
1. Create an approved synthetic Activist/Organization proposal, distinct from the proposer account.
2. Register a **fictional** rectification/objection ticket, with a case ID and timestamps but no real personal data.
3. Confirm an authenticated non-Admin cannot withdraw or edit the approved record. Test Admin withdrawal using the existing authorized endpoint.
4. Confirm the approved public directory no longer returns the withdrawn item; test first page, page beyond 100 records, and an old cursor. Record whether a background client refreshes when foregrounded.
5. Check that notification failure cannot roll back the withdrawal. Do not claim that withdrawal equals permanent erasure: retained audit, backups, caches and notification artifacts need separate review.

## DSAR workflow acceptance
- Record reception timestamp, classification (proposer vs named person), identity verification proportional to risk, action taken, recipients where applicable, response timestamp and closure.
- Article 12 GDPR: normally respond within one month; any permitted extension and reasons must be communicated within the first month. Do not require identity documents automatically.
- Articles 15–19 GDPR: assess access, rectification, erasure, restriction and recipient notification as applicable; record justified exceptions.
- Do not store real case content or personal identifiers in project-wide Google Sheets; use a restricted case register with an approved retention period.
- For Art. 14 third-party notice, Art. 9 political data, Art. 10 judicial data (especially Grazia), Art. 5(1)(e) retention, and Art. 35 DPIA screening: require separate documented human decisions. A public source or proposer consent does not establish legal basis for the named person.

## Evidence required before marking PASS
- Exact HEAD SHA, clean disposable database fixture, test commands, assertion counts, failure modes and redacted logs.
- CI results for that exact SHA, plus a human-reviewed evidence record in the privacy sheet.
- Actual mailbox intake and Android/staging end-to-end testing are **separate release gates** and are not proven by this rehearsal.

**Current result: NOT RUN.** This plan introduces no production/staging changes, migration, feature flag, or real DSAR.
