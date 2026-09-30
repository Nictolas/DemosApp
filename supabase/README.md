# Privacy-first shadow schema

This directory starts a declarative schema draft for the Demos privacy-first redesign.

## Important

`schemas/privacy_first_shadow.sql` is not applied automatically and is not yet a production migration.

Do not run it in production until all of the following are complete:

1. threat-model review for Identity -> Research credential issuance;
2. selection of a maintained standards-based unlinkable-token implementation;
3. local/test application of the schema;
4. generation and review of a versioned migration with Supabase CLI;
5. explicit review of schema/table grants and Data API exposed schemas;
6. Supabase Security Advisor review;
7. end-to-end migration and rollback tests.

The project currently connects from the Render backend through PostgreSQL directly. Internal schemas are intentionally designed without anon/authenticated grants.

Supabase's 2026 platform changes make Data API table exposure increasingly explicit; this design still treats grants and RLS as independent defense layers and does not rely on defaults.

## Non-negotiable invariant

There must be no persistent database mapping from an account identifier (`users.id`, email, auth identifiers) to `research.participants.participant_id`.

The Identity domain may record that an account received an enrollment/renewal credential. Research may record that a credential digest was spent. Neither side stores the final cross-domain mapping.

## Migration workflow

When the design is approved, use Supabase CLI locally to generate the real migration rather than inventing a migration filename manually. Review grants/RLS explicitly because schema privileges are not reliably represented by declarative diff tooling.
