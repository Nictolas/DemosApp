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

## Column-level verification — 07/11/2026

A second metadata-only `information_schema.columns` query revealed that table presence plus privilege/policy presence alone was **too optimistic**. The versioned SQL audit now checks **44 core column contracts** through `pg_catalog.pg_attribute` and returns `BLOCKED_MISSING_COLUMNS` before permitting a metadata pass.

The exact 10-relation audit, run read-only in Demos-Staging, reports:

| Core E2E relation | Final metadata result | Confirmed missing columns |
| --- | --- | --- |
| `user_consents` | `METADATA_PASS_NOT_E2E_GO` | none of the checked columns |
| `users` | `BLOCKED_MISSING_COLUMNS` | `cognome`, `paese_residenza`, `provincia_residenza` |
| `political_selections` | `BLOCKED_MISSING_COLUMNS` | `context`, `jurisdiction_id`, `political_office_id`, `selected_candidacy_id`, `selected_mandate_id`, `source`, `updated_at` |
| `political_candidacies`, `political_mandates`, `eventi`, `unita_elettorale` | `BLOCKED_NO_SELECT_GRANT` | none of the checked columns, but runtime read grants/policies absent |
| `unita_elettorale_territorio` | `BLOCKED_MISSING_RELATION` | relation absent |
| `user_political_territories`, `user_electoral_unit_memberships` | `OPTIONAL_SCHEMA_ABSENT` | optional canonical residence/membership fallback path absent |

**Only 1 of 8 mandatory relations meets the narrow combined structural + declared read-policy metadata test; 7/8 block E2E.** This does **not** authorize migration, ACL changes or a deploy.

Relevant repository DDL was located on `main`: `20261009_political_selections.sql`, `api/database/create-account-capabilities-model.sql`, and `20261009_political_territory_memberships.sql`. **Do not apply these scripts as-is to the shared staging:** `political_selections` already exists with three columns, so `CREATE TABLE IF NOT EXISTS` does not upgrade it, and the scripts also include backfills/DDL and other changes requiring separate review. Prepare a narrowly scoped, idempotent schema-difference plan and synthetic fixture-specific RLS/ACL review first. The missing legacy residence fields in `users` should not be silently populated with production personal data.

## Canonical uniqueness and migration collision — 07/11/2026

A read-only PostgreSQL catalog audit of `public.political_selections` confirmed an existing **legacy primary key on `(user_id, selected_user_id, selection_kind)`**. Its only unique index has those same three columns. In contrast, the currently proposed `writeCanonicalSelection` API requires `ON CONFLICT (user_id, selection_kind, political_office_id)`; the latter column does not even exist in this staging table.

The versioned metadata preflight now reports `canonical_selection_unique_key_ready=false` (and will return `BLOCKED_CANONICAL_CONFLICT_KEY_MISSING` if the columns are later added without a suitable *valid, unconditional, unique* index). The SQL was executed read-only on Demos-Staging, and the new contract checks this condition without querying application rows.

**Do not run `20261009_political_selections.sql` on the current staging unchanged**. Its `CREATE TABLE IF NOT EXISTS` does not convert an existing legacy relation; it can leave a mismatched primary key, missing columns and incompatible `ON CONFLICT` resolution. Furthermore, it includes an initial backfill whose source columns/fixture identities have not been reviewed for this schema. A safe future migration needs its own reviewed, transactional and idempotent conversion plan, with an explicit collision-resolution/rollback strategy before defining a canonical unique key. No production accounts, votes or other personal data should be copied into staging.

Proposed **review sequence**, not executed: snapshot staging schema metadata and rollback artifacts; inspect foreign-key dependencies and key collisions on authorized **synthetic fixture data only**; review additive columns and their constraints; review necessary unique/index conversion without dropping existing rows or silently choosing between duplicates; apply only a separately approved minimal RLS/ACL proposal; rerun this SQL gate under the actual runtime identity; then proceed to the expressly authorized application E2E. The deployment and any database writes remain separately gated.

## Required sequence (none automatically approved)

1. Keep `demos-staging` in bootstrap/NO-GO while the OPS-STG-001 team reviews the narrow route-to-table mapping, synthetic-only fixture design and rollback. Coordinate against PR #565, not a new Render instance.
2. Review any *proposed* schema/ACL work separately for **only the provincial route requirements**. No broad `GRANT`, no alteration to production, no direct privileges for `anon`/`authenticated`. This PR does **not** contain migrations to apply.
3. After separate authorizations and completed prerequisites, bring up the **same** staging service with an appropriate reversible application runtime and all background notifications/sync/dispatch disabled; verify the effective runtime DB identity and RLS results using synthetic identities only.
4. Only with real app readiness, perform Chrome E2E on synthetic Italian TN/BZ residents, an ordinary-province resident, missing/foreign residence, cross-province candidate/mandate, selection and removal via `political_selections`, matching of six existing C opinion IDs without duplicated responses, regional/provincial deduplication and consent revocation. Never use production accounts, production credentials or real user data.
5. Record the precise passing evidence; mark the final provincial E2E checkpoint complete **only** after those tests pass. Separate authorizations are still required for merge and release.

**Current state:** staging application E2E **NOT RUN / NO-GO**. The user's permission to perform tests does not constitute permission to deploy or relax ACLs. No percentages are changed solely by a metadata audit.
