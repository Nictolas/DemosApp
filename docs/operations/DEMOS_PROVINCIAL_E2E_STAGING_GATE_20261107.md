# DEMOS — provincial representative staging E2E gate (07/11/2026)

**PR:** #627 (Draft; NOT LIVE). **Dependencies:** #624 and #557 merged in `main`.
**Permitted scope of this audit:** metadata-only SELECT on *Demos-Staging* Supabase project `fkeayjzvtuvzesljhjbc`, plus read-only GitHub/Render checks. No production access, DDL, grants, policy change, deploy, fixture insert or E2E call was made.

## Verified runtime blockers

- Render's authorized shared service `demos-staging` (`srv-db52l1g473hc739ld250`) is still running `node staging/unified_staging_bootstrap.js` from the OPS-STG-001 branch. Its liveness is not application readiness; `/health/ready` intentionally returns 503. A green offline CI or the previously successful runtime lock audit does not change that.
- 07/11/2026 SQL metadata audit through the Supabase connector: **8 mandatory relations** are needed for the basic provincial representative/candidate/selection paths examined. **3/8 passed the narrow metadata check**, while **5/8 blocked**:
  - **Table absent** in `public`: `unita_elettorale_territorio`.
  - **Present with RLS enabled, but no SELECT privilege or applicable read policy for `demos_staging_runtime`**: `political_mandates`, `political_candidacies`, `eventi`, `unita_elettorale`.
  - **Metadata checks only passed**: `users`, `user_consents`, `political_selections`. This does **not** demonstrate that any synthetic row passes its actual RLS predicate or that a real API request will succeed.
- `user_political_territories` and `user_electoral_unit_memberships` are absent in `public`. The current API has legacy fallback for these two structures, so they are reported separately as **optional compatibility gaps**, not silently counted as mandatory failures. Their absence still needs a documented choice before claiming canonical-territory coverage.
- Audit SQL: `api/qa/provincial_staging_prerequisites_readonly.sql`. It inspects only PostgreSQL catalogs/privileges/policy *presence*, not user rows, policy predicates or credentials. The matching Node CI contract prevents accidental widening into application-row reads or DDL.
- The broader OPS-STG-001 audit also found 21 of 35 application tables without the necessary runtime SELECT+RLS-policy pair. Provincial checks are a subset, **not** authorization to grant access to all 21.

## Required sequence (none automatically approved)

1. Keep `demos-staging` in bootstrap/NO-GO while the OPS-STG-001 team reviews the narrow route-to-table mapping, synthetic-only fixture design and rollback. Coordinate against PR #565, not a new Render instance.
2. Review any *proposed* schema/ACL work separately for **only the provincial route requirements**. No broad `GRANT`, no alteration to production, no direct privileges for `anon`/`authenticated`. This PR does **not** contain migrations to apply.
3. After separate authorizations and completed prerequisites, bring up the **same** staging service with an appropriate reversible application runtime and all background notifications/sync/dispatch disabled; verify the effective runtime DB identity and RLS results using synthetic identities only.
4. Only with real app readiness, perform Chrome E2E on synthetic Italian TN/BZ residents, an ordinary-province resident, missing/foreign residence, cross-province candidate/mandate, selection and removal via `political_selections`, matching of six existing C opinion IDs without duplicated responses, regional/provincial deduplication and consent revocation. Never use production accounts, production credentials or real user data.
5. Record the precise passing evidence; mark the final provincial E2E checkpoint complete **only** after those tests pass. Separate authorizations are still required for merge and release.

**Current state:** staging application E2E **NOT RUN / NO-GO**. The user's permission to perform tests does not constitute permission to deploy or relax ACLs. No percentages are changed solely by a metadata audit.
