-- DEMOS: use only E for new Elettore roles; leaves all existing accounts unchanged.
-- Requires reviewed deployment migration; do not run on production before approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.users ALTER COLUMN ruolo SET DEFAULT 'E';
DO $$
DECLARE d text;
BEGIN
 SELECT column_default INTO d FROM information_schema.columns
 WHERE table_schema='public' AND table_name='users' AND column_name='ruolo';
 IF d NOT LIKE '%''E''%' THEN
  RAISE EXCEPTION 'users.ruolo default was not set to E';
 END IF;
END $$;
COMMIT;
