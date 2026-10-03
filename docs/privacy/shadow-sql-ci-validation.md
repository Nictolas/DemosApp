# Shadow SQL CI validation

The security gate validates the privacy-first shadow DDL against a disposable PostgreSQL 16 service.

The job creates only CI-only roles and a minimal `public.users` table, then opens one transaction, loads `privacy_first_shadow.sql` followed by `privacy_first_cutover_replay_rpc_shadow.sql` with `ON_ERROR_STOP`, and rolls the transaction back. Any SQL syntax error, missing referenced object, invalid grant target, or PL/pgSQL creation error fails CI.

No Supabase project, production database, migration, secret, or persistent environment is touched. The bootstrap file is CI-only and must never be used as a production migration.
