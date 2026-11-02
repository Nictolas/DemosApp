-- DEMOS CR-13 | MANUAL migration only; do not apply without release gates.
-- Pre-deployment step for PR #525. PostgreSQL, run once with authorized DBA.
-- Existing rows remain unchanged (NULL means legacy notification).
-- A partial unique index prevents repeated idempotency keys and concurrent
-- duplicate recipient notifications. Index is not a replacement for recipient
-- read isolation in PR #494.
BEGIN;
ALTER TABLE public.notifiche_demos
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS notifiche_demos_idempotency_key_unique
  ON public.notifiche_demos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
COMMIT;

-- Read-only post-migration checks (separate manual operation):
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='notifiche_demos'
--   AND column_name='idempotency_key';
-- SELECT indexname FROM pg_indexes WHERE schemaname='public'
--   AND tablename='notifiche_demos' AND indexname='notifiche_demos_idempotency_key_unique';
--
-- Rollback (ONLY after disabling the new writer; assess existing rows first):
-- DROP INDEX IF EXISTS public.notifiche_demos_idempotency_key_unique;
-- ALTER TABLE public.notifiche_demos DROP COLUMN IF EXISTS idempotency_key;
