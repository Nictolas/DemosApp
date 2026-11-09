-- OPS-STG-001 P4: staging-only cooldown bookkeeping, no personal data copied.
-- Based on repository 20261009_preference_cooldowns.sql. New table stays
-- DEFAULT DENY pending separate fixture-only runtime authorization.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $p4_guard$
BEGIN
  IF (SELECT count(*) FROM public.civic_runtime_identity
      WHERE id=1 AND md5(db_identity::text)='0cbb6ace68a9f11956904e2a37898ec8') <> 1
     OR (SELECT count(*) FROM public.civic_runtime_identity) <> 1 THEN
    RAISE EXCEPTION 'OPS_STG_P4_WRONG_DATABASE';
  END IF;
  IF (SELECT count(*) FROM public.civic_push_delivery_guard
      WHERE id=1 AND blocked IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'OPS_STG_P4_DELIVERY_NOT_BLOCKED';
  END IF;
  IF to_regclass('public.preference_change_cooldowns') IS NOT NULL
     OR to_regclass('public.idx_preference_change_cooldowns_last_changed') IS NOT NULL THEN
    RAISE EXCEPTION 'OPS_STG_P4_ALREADY_EXISTS';
  END IF;
END
$p4_guard$;

CREATE TABLE public.preference_change_cooldowns (
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  last_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT preference_change_cooldowns_pkey PRIMARY KEY (user_id, scope)
);
CREATE INDEX idx_preference_change_cooldowns_last_changed
  ON public.preference_change_cooldowns(last_changed_at);
COMMENT ON TABLE public.preference_change_cooldowns IS
  'A single timestamp per synthetic user and scope. No vote history.';
ALTER TABLE public.preference_change_cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preference_change_cooldowns FROM PUBLIC, anon, authenticated;
COMMIT;
