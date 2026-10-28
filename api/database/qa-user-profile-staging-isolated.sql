-- DEMOS isolated synthetic profile compatibility fixture, staging ONLY.
-- No real users. No public table writes or production migration.
-- This fixture is NOT a full production-schema clone or full E2E environment.
CREATE SCHEMA IF NOT EXISTS qa_user_profile_20261028;
REVOKE ALL ON SCHEMA qa_user_profile_20261028 FROM PUBLIC, anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS qa_user_profile_20261028.users (
 id uuid PRIMARY KEY,
 account_type varchar(24) NOT NULL DEFAULT 'PERSON' CHECK (account_type IN ('PERSON','ORGANIZATION','INSTITUTION')),
 ruolo text, cittadinanza varchar(32), genere varchar(16), data_nascita date,
 paese_residenza varchar(64), regione_residenza varchar(100), provincia_residenza varchar(100), comune_residenza varchar(150),
 grado_elezione varchar(12), paese_elezione text, regione_elezione text, provincia_elezione text, comune_elezione text,
 grado_candidatura varchar(12), paese_candidatura text, regione_candidatura text, provincia_candidatura text, comune_candidatura text,
 avatar_config text, facebook_url text, twitter_url text, instagram_url text, linkedin_url text, telegram_url text, website_url text, twitch_url text, youtube_url text,
 attivisti text, organizzazioni text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS qa_user_profile_20261028.user_profile (
 user_id uuid PRIMARY KEY REFERENCES qa_user_profile_20261028.users(id) ON DELETE CASCADE,
 genere text, data_nascita date, cittadinanza text,
 paese_residenza text, regione_residenza text, provincia_residenza text, comune_residenza text,
 grado_elezione text, paese_elezione text, regione_elezione text, provincia_elezione text, comune_elezione text,
 grado_candidatura text, paese_candidatura text, regione_candidatura text, provincia_candidatura text, comune_candidatura text,
 facebook_url text, twitter_url text, instagram_url text, linkedin_url text, telegram_url text, website_url text, twitch_url text, youtube_url text,
 avatar_config jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE qa_user_profile_20261028.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_user_profile_20261028.user_profile ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA qa_user_profile_20261028 FROM PUBLIC, anon, authenticated, service_role;
-- Explicit fixed UUIDs allow deterministic tests; all names and values are invented.
INSERT INTO qa_user_profile_20261028.users
 (id, account_type, ruolo, cittadinanza, regione_residenza, provincia_residenza, comune_residenza, grado_elezione, data_nascita, avatar_config)
 VALUES
 ('00000000-0000-4000-8000-000000000101','PERSON','E','it','TO','PI','Pisa',NULL,DATE '1990-01-01','{"color":"blue"}'),
 ('00000000-0000-4000-8000-000000000102','PERSON','E','it','TO','PI','Pisa',NULL,DATE '1991-01-01',NULL),
 ('00000000-0000-4000-8000-000000000103','PERSON','P','it','TO','PI','Lucca','CO',DATE '1970-01-01','{"hat":"gold"}'),
 ('00000000-0000-4000-8000-000000000104','PERSON','E','it','TO','PI','Pisa',NULL,NULL,NULL),
 ('00000000-0000-4000-8000-000000000105','ORGANIZATION',NULL,NULL,'TO','PI','Pisa',NULL,NULL,NULL),
 ('00000000-0000-4000-8000-000000000106','PERSON','P','it','TO','PI','Pisa','CO',DATE '1965-01-01',NULL),
 ('00000000-0000-4000-8000-000000000107','PERSON','E','it','TO','PI','Pisa',NULL,NULL,'{"cat":"pixel"}'),
 ('00000000-0000-4000-8000-000000000108','PERSON','E','it','TO','PI','Pisa',NULL,NULL,NULL)
 ON CONFLICT (id) DO NOTHING;
INSERT INTO qa_user_profile_20261028.user_profile (user_id,cittadinanza,regione_residenza,provincia_residenza,comune_residenza,grado_elezione,data_nascita,avatar_config)
 VALUES
 ('00000000-0000-4000-8000-000000000101','it','TO','PI','Pisa',NULL,DATE '1990-01-01','{"color":"blue"}'::jsonb),
 ('00000000-0000-4000-8000-000000000102','it','LA','RM','Roma',NULL,DATE '1991-01-01',NULL),
 ('00000000-0000-4000-8000-000000000104','it','TO','PI',NULL,NULL,NULL,NULL),
 ('00000000-0000-4000-8000-000000000105',NULL,'TO','PI','Pisa',NULL,NULL,NULL),
 ('00000000-0000-4000-8000-000000000106','it','TO','PI','Pisa','R',DATE '1965-01-01',NULL),
 ('00000000-0000-4000-8000-000000000107','it','TO','PI','Pisa',NULL,NULL,NULL),
 ('00000000-0000-4000-8000-000000000108','it','TO','PI','Pisa',NULL,NULL,'{"emoji":"cat"}'::jsonb)
 ON CONFLICT (user_id) DO NOTHING;
COMMENT ON SCHEMA qa_user_profile_20261028 IS 'DEMOS synthetic isolated profile QA, NOT exposed, NOT production clone. No real user data.';
