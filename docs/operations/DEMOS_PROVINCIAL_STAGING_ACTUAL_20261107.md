# DEMOS — Provincial selections: real Demos-Staging operations (07 Nov 2026)

**Scope:** authorized staging-only PostgreSQL project `Demos-Staging`, PG17. This is **not** production, a production migration, a Render application deployment, a release GO or evidence of runtime RLS.

## Authority, isolation and sequence

The owner explicitly removed the former single-staging restriction on 07 Nov 2026, permitting existing free staging environments to be used separately for development, tests and staging-only schema remediation. The canonical Roadmap `STAGING — DIRETTIVA`, `CHECKLIST MASTER / OPS-STG-001` and `COORDINAMENTO CHAT` have been updated. No spending, production data, releases or destructive provider changes were authorized.

The target project was verified separately through the Supabase project metadata. Transactions used bounded lock and statement timeouts and precondition guards. No production project, data or credentials were accessed. Initial read-only SQL established that the legacy `public.political_selections` table held exactly two existing GDPR **synthetic** choices, with both owners and selected subjects within the approved synthetic fixture set, and no other entries. Those two choices must be preserved without fabricating a political office.

## Staging changes actually performed and independently re-read

1. Applied the exact `api/qa/provincial_preserve_fixture_legacy_schema_upgrade_CANDIDATE.sql` revision from Draft PR #627 with scoped, explicit transaction-local operator acknowledgment. The guarded, transactional conversion committed. It preserved **2/2** legacy synthetic selections, marked `legacy_unmapped` without assigning office or jurisdiction, changed the legacy composite primary key to `id`, and installed the canonical unique index `(user_id, selection_kind, political_office_id)`. Verification confirmed 2 preserved rows, 0 mapped historic rows, new `PRIMARY KEY (id)`, valid canonical uniqueness and RLS still enabled. No historical selections were deleted or recategorized as provincial.
2. Added nullable `users.cognome`, `paese_residenza`, `provincia_residenza`, `regione_residenza`, `comune_residenza` to satisfy the actual residence-fallback code, with no bulk population of existing users. The PR's read-only metadata preflight and its contract tests were updated to cover the last two columns; these were absent from the earlier preflight.
3. Created `public.unita_elettorale_territorio` with an FK to `unita_elettorale`, generic province/region territory columns, metadata JSONB, corresponding indexes, RLS enabled and an `id` primary key. The PK was added after the Supabase performance advisor pointed out the new relation lacked one.
4. Granted the dedicated `demos_staging_runtime` role SELECT only on `eventi`, `political_candidacies`, `political_mandates`, `unita_elettorale`, `unita_elettorale_territorio`. Added eight narrowly scoped RLS policies for users, consents, selections, candidacies, mandates, events, electoral units and their territory mappings. The new policies are addressed **only** to `demos_staging_runtime` and reference the four dedicated provincial QA synthetic identities or their events. Existing GDPR fixture policies remain intact. No `anon` or `authenticated` grants/policies were created.
5. Inserted a separate small QA cohort, not using GDPR fixture IDs: **4 synthetic person accounts** (resident and candidate/politician for each of Trento and Bolzano), **4 political consent records**, **2 QA election events**, **2 electoral units**, **2 province mappings**, **2 candidacies** and **2 active mandates**, all tagged as test data. The new records remain in this staging database for subsequent authorized E2E. No real identities, events, mandates or opinions were imported.

## Verified results

- Re-ran the repository's read-only SQL metadata preflight **after** the final schema/ACL changes: **8/8 mandatory relations** return `METADATA_PASS_NOT_E2E_GO`. Before these changes only 1/8 passed. This is narrow proof of table/column shape, grants, RLS enablement and declared policies, **not** proof of runtime-effective row access.
- An aggregate SQL verification showed **4/4 QA users**, **4/4 consent rows**, **2 candidate records** matching their event and province mapping, **2 matching mandate records** and the original **2 preserved unmapped synthetic legacy choices**.
- An actual PostgreSQL transactional QA write inserted a voter selecting the **same synthetic subject for two offices**, exercised canonical `ON CONFLICT DO UPDATE`, and verified **2 rows / 2 distinct offices / 1 distinct selected person / 1 updated choice**. The transaction then executed **ROLLBACK**, so no new provincial/region selection was persisted. Existing GDPR fixture choices remained unchanged.
- The Supabase SQL connector refused `SET LOCAL ROLE demos_staging_runtime` with `42501 permission denied`. **Do not retry by impersonation, widening role grants or weakening RLS.** Runtime-effective RLS and app-level E2E must be verified by a genuine authorized staging connection as that role.
- Latest PR #627 head after column-preflight test correction: **9d6b2c5607da37db696a2faffe9734a03511c7bc**, GitHub Actions **10/10 completed SUCCESS**, including provincial contract and cross-main checks.
- The shared Render service `demos-staging` remains bootstrap-only, starting `staging/unified_staging_bootstrap.js`. This does not prevent using another staging environment under the owner's revised policy, but it is not proof the provincial app itself has been tested in Chrome.

## Remaining acceptance work — execute without blocking on the unified bootstrap

Find/use a free **app-capable** staging service with a genuine, restricted `demos_staging_runtime` database connection and the right PR #627 build. Verify account/session auth, residence TN/BZ isolation, candidate and mandate listing, select/change/remove, notification audience consent and revocation with only the new synthetic cohort. Test by Chrome in an authenticated browser or isolated browser runner. Collect run/deploy evidence and rollback before claiming E2E. The service must not dispatch FCM, execute production jobs, or use production provider keys.

The user's Windows computer connectors were unavailable at this check (DeskMCP tunnel offline and Desktop Commander device offline), so a live Chrome UI test was **not** performed. A successful GitHub CI or direct privileged SQL transaction cannot substitute for it.

## Reversibility and cleanup

The QA cohort can be retired after E2E sign-off by a scoped transaction with **verified fixture identities and row counts**, deleting **only** the QA event/candidacy/mandate/mapping/unit/consent/account rows and checking no unexpected references before commit. Do not delete the original GDPR fixture choices or drop the canonical schema as a shortcut. To reverse schema/ACL changes, write a separate data-preserving migration and first verify all consumers; there is no approved destructive rollback of the canonical selection table. The new scoped RLS policies and SELECT grants are individually addressable and can be reviewed/revoked separately if the QA role is decommissioned.

**Result:** real staging database schema and synthetic SQL tests progressed; final technical checklist remains **11/12 (~92%)** because authenticated app + Chrome E2E and effective runtime RLS are still outstanding. Production, Google Play, provider billing, and merge remain unchanged.
