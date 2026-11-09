-- DEMOS QA ONLY: staging users schema parity required by Proponi preflight.
-- Production's users.is_admin is boolean NOT NULL DEFAULT false.
-- No user receives new Admin privileges: existing accounts get FALSE.
-- Target only Demos-Staging fkeayjzvtuvzesljhjbc; never deploy on production.
BEGIN;
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='users'
               AND column_name='is_admin') THEN
    RAISE EXCEPTION 'users.is_admin already exists; reconcile before running';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='users'
                   AND column_name='id' AND udt_name='uuid') THEN
    RAISE EXCEPTION 'Not the expected DEMOS staging users schema';
  END IF;
END
$guard$;
ALTER TABLE public.users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
COMMIT;
