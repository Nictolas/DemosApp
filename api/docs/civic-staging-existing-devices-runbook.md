# DEMOS civic push — staging with an existing GDPR device table

**Scope:** Demos-Staging only. No production change or real Firebase delivery.
The civic draft stays unmerged until all real-device and security gates pass.

## Evidence to re-check immediately before applying

The staging project must be the explicitly selected **Demos-Staging** project,
never production. Confirm via read-only metadata:

- `public.users` exists, has UUID `id`, has RLS and **does not** yet have `status`.
- `public.user_devices` exists with the eight required columns, has RLS
  enabled, holds **zero** device records, and grants no table read/write
  privileges to `anon` or `authenticated`.
- `public.eci`, `public.iniziative_ministero`, `public.notifiche_preferenze`
  and the three civic downstream tables are **absent**.
- The staging accounts are synthetic only. Never copy production
  accounts, tokens, preference rows or initiatives into this staging DB.

The checked 2 November 2026 staging snapshot contained two test accounts and
zero device records. The `users.status` column was missing, and `user_devices`
had a policy for the synthetic staging runtime. Refresh this before applying.

## Source-only schema, stop on mismatch

Run `api/database/20261102_civic_staging_existing_devices_fixture.sql`
on the verified staging project in a *single transaction*, with:

```sql
BEGIN;
SET LOCAL civic.fixture_environment = 'staging';
SET LOCAL civic.fixture_approval = 'I_APPROVE_SYNTHETIC_CIVIC_STAGING_SCHEMA';
-- Execute the entire fixture file here; do not paste its sample comments.
COMMIT;
```

The guard refuses missing approval, a different or partially prepared schema,
missing/mismatched `user_devices`, any existing device records, exposed
`user_devices` or RLS disabled. An error requires `ROLLBACK` and investigation,
not force-setting flags or deleting tables.

This fixture deliberately does **not** recreate or edit the existing
`user_devices` table or its existing grants, policies, FKs and comments. It
creates three empty source tables and the `users.status` column (default
`pending`). The existing synthetic users therefore remain *not active* for
civic delivery until deliberately marked `a` in a separate isolated test.

## Downstream schema, still no delivery

Only after the source fixture succeeds and its metadata is verified, apply the
reviewed `api/database/20261101_civic_new_initiative_notifications.sql` on
**staging**. It creates three opt-in fields (all `FALSE`), the outbox, a
database-identity marker and the delivery guard initialized as `blocked=TRUE`.
All three source tables must remain empty for the baseline. Never supply real
initiative records or tokens.

Run both read-only preflights:

- `api/scripts/civicStagingReadOnlyPreflight.sql`: all 7 tables must be
  `STRUCTURE_OK`, with RLS enabled.
- `api/scripts/civicStagingUsersReadOnlyPreflight.sql`:
  `users.status` must be `STRUCTURE_OK`.

Also check that the outbox is empty, the three opt-ins are OFF by default and
the delivery guard remains blocked. The preflight must report
`CLIENT_ROLE_EXPOSED` if `anon` or `authenticated` retain direct table access
(or outbox sequence USAGE), even while RLS is enabled. Confirm both roles have
**no** SELECT/INSERT/UPDATE/DELETE on all seven tables, and no USAGE on the
outbox sequence. Supabase default grants made the three civic-only tables
accessible to client SQL roles during the first 2 November staging apply; a
separate staging migration revoked these grants before any push or test data
was written. The draft production migration now revokes direct grants too.

## Dedicated synthetic runtime permission stage

A successful schema preflight does **not** guarantee the synthetic backend role
can read or update civic tables. The earlier DEMOS GDPR staging fixture
`demos_staging_runtime` login has RLS access only to the two synthetic user
IDs; the new civic tables initially give it no privileges or policies.

After confirming the source/schema baseline is empty, only the approved
**Demos-Staging** project may run
`api/database/20261102_civic_staging_runtime_access.sql` atomically:

```sql
BEGIN;
SET LOCAL civic.runtime_access_environment = 'staging';
SET LOCAL civic.runtime_access_approval = 'I_APPROVE_CIVIC_STAGING_RUNTIME_ACCESS';
-- Execute the entire civic staging runtime access SQL file here.
COMMIT;
```

The migration is designed to reject production, non-synthetic accounts,
nonempty device/notification tables, an already-unblocked guard, missing RLS,
and any existing civic policies. Do not override those rejections. It grants
only the named staging runtime role, never `anon`/`authenticated`. Preference
RLS is limited to the two existing synthetic users; the backend role may
**stop** delivery but cannot change the guard to `blocked=FALSE`.
The production schema/migration does not depend on this test-only role.

Then run `api/scripts/civicStagingRuntimeAccessReadOnlyPreflight.sql`:
all six new civic tables must report `STRUCTURE_OK`. Check it together with
the seven-table structural preflight, users preflight, and the blocked guard.
The synthetic PostgreSQL16 CI contract tests default-deny, valid role access,
cross-account rejection and attempted unlock rejection. The CI does not
prove Render's real runtime URL uses this role or a session-affine pool.

## Hard release gates still open

- Verify the real backend database/session pooler, GitHub ECI DB identity and
  actual scheduler. A local PostgreSQL CI success is not sufficient.
- Test staged backend authorization, account deletion, opt-out, token rotation
  and rollback without contacting real registered devices.
- Verify Firebase and Android/PWA separately with approved canary devices and
  the DPO; only then consider unblocking delivery.
- **No merge to `main`, no Render deployment, no public push** in this step.

Rollback of staging schema must be planned separately after checking whether
other staging tests depend on the created structures. Never run blanket `DROP
CASCADE` on the shared staging project.
