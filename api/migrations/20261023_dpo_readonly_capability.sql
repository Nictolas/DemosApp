-- DPO oversight is an application-level role, not a systems administrator.
-- This migration grants NO account DPO rights by itself.
-- Apply before deploying any code that checks users.is_dpo.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_dpo BOOLEAN NOT NULL DEFAULT FALSE;

DO $dpo$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_dpo_not_admin'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_dpo_not_admin
      CHECK (NOT (is_admin IS TRUE AND is_dpo IS TRUE));
  END IF;
END
$dpo$;
